import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createCanvas } from '@napi-rs/canvas';
import { XMLParser } from 'fast-xml-parser';
import { Types } from 'mongoose';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Connection, Model } from 'mongoose';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { AiService } from '../ai/ai.service.js';
import { Produto } from '../produtos/Schemas/Schemas.produtos.js';
import type { ProdutoDocument } from '../produtos/Schemas/Schemas.produtos.js';
import { Cliente } from '../clientes/Schemas/clientes.schemas.js';
import type { ClienteDocument } from '../clientes/Schemas/clientes.schemas.js';
import type { ConfirmInvoiceImportDto } from './dto/confirm-invoice-import.dto.js';
import type { CreateManualInvoiceImportDto } from './dto/create-manual-invoice-import.dto.js';
import {
  InvoiceImport,
  InvoiceImportDocument,
} from './entities/invoice-import.entity.js';

type AuthenticatedUser = {
  userId: string;
  companyId?: string;
  empresaid?: string;
};
export type UploadedInvoiceFile = {
  originalname: string;
  size: number;
  buffer: Buffer;
};
type InvoiceItemValues = {
  sku?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};
type InvoiceValues = {
  invoiceNumber?: string;
  invoiceDirection?: 'outgoing' | 'incoming';
  series?: string;
  accessKey?: string;
  issueDate?: Date;
  customerName?: string;
  customerTaxId?: string;
  customerPhone?: string;
  totalAmount?: number;
  items: InvoiceItemValues[];
  ocrText?: string;
};

export const MAX_INVOICE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 5;
const MAX_INVOICE_ITEMS = 100;
const OCR_CACHE_PATH = join(tmpdir(), 'easysell-tesseract');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const result = String(value).trim();
  return result || undefined;
}

function firstRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstRecord(item, key);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  if (isRecord(value[key])) return value[key];
  for (const child of Object.values(value)) {
    const found = firstRecord(child, key);
    if (found) return found;
  }
  return undefined;
}

function parseBrazilianAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

@Injectable()
export class InvoiceImportService implements OnModuleDestroy {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    parseTagValue: true,
    trimValues: true,
  });
  private ocrWorker?: Promise<Tesseract.Worker>;

  constructor(
    @InjectModel(InvoiceImport.name)
    private readonly invoiceModel: Model<InvoiceImportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Produto.name)
    private readonly productModel: Model<ProdutoDocument>,
    @InjectModel(Cliente.name)
    private readonly saleModel: Model<ClienteDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly aiService: AiService,
  ) {}

  async onModuleDestroy() {
    if (this.ocrWorker) {
      const worker = await this.ocrWorker;
      await worker.terminate();
    }
  }

  async importFile(
    user: AuthenticatedUser,
    file: UploadedInvoiceFile | undefined,
  ) {
    const companyId = await this.getCompanyId(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo de nota fiscal.');
    }
    if (
      file.size > MAX_INVOICE_FILE_SIZE ||
      file.buffer.length > MAX_INVOICE_FILE_SIZE
    ) {
      throw new BadRequestException('O arquivo deve ter no máximo 10 MB.');
    }
    const { fileType, values } = await this.extractInvoice(file);
    if (values.accessKey) {
      const duplicate = await this.invoiceModel
        .findOne({ companyId, accessKey: values.accessKey })
        .select('_id status')
        .lean()
        .exec();
      if (duplicate) {
        throw new ConflictException(
          'Esta chave de acesso de NF-e já foi enviada para revisão.',
        );
      }
    }
    const fileName = file.originalname.replace(/[^\w.-]/g, '_').slice(0, 120);
    const invoice = new this.invoiceModel({
      companyId: new Types.ObjectId(companyId),
      fileName: fileName || `nota-fiscal.${fileType}`,
      fileType,
      extractionMethod: fileType === 'xml' ? 'xml' : 'ocr',
      ...values,
      status: 'pending_review',
      createdSaleIds: [],
    });
    try {
      await invoice.save();
    } catch (error) {
      if (isRecord(error) && error.code === 11000 && values.accessKey) {
        throw new ConflictException(
          'Esta chave de acesso de NF-e já foi enviada para revisão.',
        );
      }
      throw error;
    }
    return this.toReview(invoice);
  }

  async list(user: AuthenticatedUser, status?: string) {
    const companyId = await this.getCompanyId(user);
    if (
      status !== undefined &&
      !['pending_review', 'imported', 'rejected'].includes(status)
    ) {
      throw new BadRequestException('O filtro de status é inválido.');
    }
    const filterStatus = status as InvoiceImport['status'] | undefined;
    return this.invoiceModel
      .find({ companyId, ...(filterStatus ? { status: filterStatus } : {}) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  async createManual(
    user: AuthenticatedUser,
    input: CreateManualInvoiceImportDto,
  ) {
    const companyId = await this.getCompanyId(user);
    const customerName = input.customerName.trim();
    if (!customerName) {
      throw new BadRequestException('Informe o nome do cliente.');
    }
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await this.productModel
      .find({
        _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
        companyId,
      })
      .select('_id name')
      .lean()
      .exec();
    const productById = new Map(
      products.map((product) => [product._id.toString(), product]),
    );
    if (productById.size !== productIds.length) {
      throw new BadRequestException(
        'Um ou mais produtos não pertencem a esta empresa ou não existem.',
      );
    }

    const items = input.items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new BadRequestException(
          'Um ou mais produtos não pertencem a esta empresa ou não existem.',
        );
      }
      return {
        description: product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: Number((item.quantity * item.unitPrice).toFixed(2)),
        suggestedProductId: item.productId,
      };
    });
    const invoice = new this.invoiceModel({
      companyId: new Types.ObjectId(companyId),
      fileName: 'Venda manual',
      fileType: 'manual',
      extractionMethod: 'manual',
      customerName,
      ...(input.customerPhone?.trim()
        ? { customerPhone: input.customerPhone.trim() }
        : {}),
      items,
      status: 'pending_review',
      createdSaleIds: [],
    });
    await invoice.save();
    return this.toReview(invoice);
  }

  async getOne(user: AuthenticatedUser, invoiceId: string) {
    const companyId = await this.getCompanyId(user);
    const invoice = await this.findCompanyInvoice(companyId, invoiceId);
    return this.toReview(invoice);
  }

  async assist(user: AuthenticatedUser, invoiceId: string, question?: string) {
    const companyId = await this.getCompanyId(user);
    const invoice = await this.findCompanyInvoice(companyId, invoiceId);
    if (invoice.status !== 'pending_review') {
      throw new ConflictException(
        'Somente notas pendentes podem receber sugestões da Sell IA.',
      );
    }
    const ocrLines =
      invoice.fileType === 'xml'
        ? []
        : this.getOcrItemCandidates(invoice.ocrText ?? '');
    const result = await this.aiService.assistInvoiceReview(user, {
      items: invoice.items.map((item) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        suggestedProductId: item.suggestedProductId,
        aiConfidence: item.aiConfidence,
        aiQuestion: item.aiQuestion,
      })),
      ocrLines,
      ...(question?.trim() ? { question: question.trim() } : {}),
    });

    if (result.items.length) {
      invoice.items = result.items.map((item) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        suggestedProductId: item.productId ?? undefined,
        aiConfidence: item.confidence,
        aiQuestion: item.clarification ?? undefined,
      }));
    }
    invoice.aiNeedsClarification = result.needsClarification;
    invoice.aiClarificationQuestion = result.clarificationQuestion ?? undefined;
    await invoice.save();
    return result;
  }

  async reject(user: AuthenticatedUser, invoiceId: string) {
    const companyId = await this.getCompanyId(user);
    const invoice = await this.findCompanyInvoice(companyId, invoiceId);
    if (invoice.status !== 'pending_review') {
      throw new ConflictException(
        'Somente importações pendentes podem ser recusadas.',
      );
    }
    invoice.status = 'rejected';
    await invoice.save();
    return this.toReview(invoice);
  }

  async confirm(
    user: AuthenticatedUser,
    invoiceId: string,
    input: ConfirmInvoiceImportDto,
  ) {
    const companyId = await this.getCompanyId(user);
    const invoice = await this.findCompanyInvoice(companyId, invoiceId);
    if (invoice.status !== 'pending_review') {
      throw new ConflictException(
        'Esta importação não está mais aguardando revisão.',
      );
    }
    if (input.confirmAsSale !== true) {
      throw new BadRequestException(
        'Confirme explicitamente que a nota representa uma venda da empresa.',
      );
    }
    if (input.items.length > MAX_INVOICE_ITEMS) {
      throw new BadRequestException(
        `A importação aceita no máximo ${MAX_INVOICE_ITEMS} produtos por nota.`,
      );
    }
    const customerName =
      input.customerName?.trim() || invoice.customerName?.trim();
    if (!customerName) {
      throw new BadRequestException(
        'Informe o nome do cliente identificado na nota fiscal.',
      );
    }
    const customerPhone =
      input.customerPhone?.trim() || invoice.customerPhone?.trim();
    const quantitiesByProduct = new Map<string, number>();
    for (const item of input.items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException('Um produto selecionado é inválido.');
      }
      quantitiesByProduct.set(
        item.productId,
        (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const session = await this.connection.startSession();
    try {
      let saleIds: string[] = [];
      await session.withTransaction(async () => {
        const productIds = [...quantitiesByProduct.keys()].map(
          (id) => new Types.ObjectId(id),
        );
        const products = await this.productModel
          .find({ _id: { $in: productIds }, companyId })
          .session(session)
          .exec();
        const productById = new Map(
          products.map((product) => [product.id, product]),
        );
        for (const [productId, quantity] of quantitiesByProduct) {
          const product = productById.get(productId);
          if (!product) {
            throw new NotFoundException(
              'Um dos produtos não pertence a esta empresa ou não existe.',
            );
          }
          if (Number(product.quantidade) < quantity) {
            throw new BadRequestException(
              `Estoque insuficiente para ${product.name}; disponível: ${product.quantidade}.`,
            );
          }
        }

        for (const [productId, quantity] of quantitiesByProduct) {
          const updated = await this.productModel
            .findOneAndUpdate(
              {
                _id: productId,
                companyId,
                quantidade: { $gte: quantity },
              },
              { $inc: { quantidade: -quantity } },
              { session, returnDocument: 'after' },
            )
            .exec();
          if (!updated) {
            throw new ConflictException(
              'O estoque mudou durante a revisão. Atualize os dados e tente novamente.',
            );
          }
        }

        const sales: ClienteDocument[] = [];
        for (const item of input.items) {
          const total = Number((item.unitPrice * item.quantity).toFixed(2));
          const sale = new this.saleModel({
            name: customerName,
            ...(customerPhone ? { Numero: customerPhone } : {}),
            IdProduto: item.productId,
            idcompany: companyId,
            Quantidade: item.quantity,
            Preco_gasto: total,
            parcelas: 1,
            valorPago: 0,
            saldoPendente: total,
          });
          await sale.save({ session });
          sales.push(sale);
        }
        invoice.status = 'imported';
        invoice.createdSaleIds = sales.map((sale) => sale.id);
        await invoice.save({ session });
        saleIds = invoice.createdSaleIds;
      });
      return {
        status: 'imported',
        invoiceImportId: invoice.id,
        createdSaleIds: saleIds,
      };
    } finally {
      await session.endSession();
    }
  }

  private async getCompanyId(user: AuthenticatedUser) {
    if (!user?.userId || !Types.ObjectId.isValid(user.userId)) {
      throw new UnauthorizedException('A sessão do usuário é inválida.');
    }
    const currentUser = await this.userModel
      .findById(user.userId)
      .select('company')
      .exec();
    const companyId = currentUser?.company?.toString();
    if (!companyId || !Types.ObjectId.isValid(companyId)) {
      throw new UnauthorizedException(
        'O usuário não está associado a uma empresa.',
      );
    }
    const tokenCompanyId = user.companyId ?? user.empresaid;
    if (
      tokenCompanyId !== undefined &&
      (!Types.ObjectId.isValid(tokenCompanyId) ||
        tokenCompanyId.toLowerCase() !== companyId.toLowerCase())
    ) {
      throw new UnauthorizedException(
        'A empresa da sessão não corresponde ao cadastro do usuário.',
      );
    }
    return companyId;
  }

  private async findCompanyInvoice(companyId: string, invoiceId: string) {
    if (!Types.ObjectId.isValid(invoiceId)) {
      throw new BadRequestException(
        'O identificador da importação é inválido.',
      );
    }
    const invoice = await this.invoiceModel
      .findOne({ _id: invoiceId, companyId })
      .exec();
    if (!invoice) {
      throw new NotFoundException('Importação de nota fiscal não encontrada.');
    }
    return invoice;
  }

  private async extractInvoice(file: UploadedInvoiceFile) {
    const buffer = file.buffer;
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      const textContent = await this.extractPdfText(buffer);
      return {
        fileType: 'pdf' as const,
        values: this.parseOcrText(textContent),
      };
    }
    if (
      (buffer[0] === 0x89 &&
        buffer.subarray(1, 4).toString('ascii') === 'PNG') ||
      (buffer[0] === 0xff && buffer[1] === 0xd8) ||
      (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP')
    ) {
      const worker = await this.getOcrWorker();
      const result = await worker.recognize(buffer);
      const ocrText = result.data.text.trim();
      if (!ocrText) {
        throw new BadRequestException(
          'Não foi possível ler texto na imagem. Envie uma foto mais nítida.',
        );
      }
      return {
        fileType: 'image' as const,
        values: this.parseOcrText(ocrText),
      };
    }
    const xmlText = buffer.toString('utf8');
    if (
      xmlText.trimStart().startsWith('<') &&
      /<(?:\w+:)?(?:nfeProc|NFe|infNFe)\b/i.test(xmlText.slice(0, 4096))
    ) {
      return {
        fileType: 'xml' as const,
        values: this.parseNfeXml(xmlText),
      };
    }
    throw new BadRequestException(
      'Formato inválido. Envie uma NF-e XML, PDF ou imagem PNG, JPG ou WEBP.',
    );
  }

  private parseNfeXml(xml: string): InvoiceValues {
    let parsed: unknown;
    try {
      parsed = this.xmlParser.parse(xml);
    } catch {
      throw new BadRequestException('O XML da NF-e está malformado.');
    }
    const info = firstRecord(parsed, 'infNFe');
    if (!info) {
      throw new BadRequestException(
        'O XML enviado não contém a estrutura de uma NF-e.',
      );
    }
    const ide = isRecord(info.ide) ? info.ide : {};
    const invoiceType = text(ide.tpNF);
    if (invoiceType === '0') {
      throw new BadRequestException(
        'A NF-e é de entrada e não pode ser registrada como venda.',
      );
    }
    if (invoiceType !== '1') {
      throw new BadRequestException(
        'A NF-e não informa uma operação de saída para validar a venda.',
      );
    }
    const dest = isRecord(info.dest) ? info.dest : {};
    const address = isRecord(dest.enderDest) ? dest.enderDest : {};
    const total = isRecord(info.total) ? info.total : {};
    const icmsTotal = isRecord(total.ICMSTot) ? total.ICMSTot : {};
    const details = asArray(info.det);
    const items = details.flatMap((detail): InvoiceItemValues[] => {
      if (!isRecord(detail) || !isRecord(detail.prod)) return [];
      const product = detail.prod;
      const quantity = Number(product.qCom);
      const unitPrice = Number(product.vUnCom);
      const lineTotal = Number(product.vProd);
      return [
        {
          sku: text(product.cProd),
          description: text(product.xProd),
          ...(Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
          ...(Number.isFinite(unitPrice) && unitPrice >= 0
            ? { unitPrice }
            : {}),
          ...(Number.isFinite(lineTotal) && lineTotal >= 0
            ? { total: lineTotal }
            : {}),
        },
      ];
    });
    if (items.length > MAX_INVOICE_ITEMS) {
      throw new BadRequestException(
        `A nota fiscal contém mais de ${MAX_INVOICE_ITEMS} produtos.`,
      );
    }
    const accessKey = text(info['@_Id'])?.replace(/^NFe/i, '');
    const issueDateValue = text(ide.dhEmi) ?? text(ide.dEmi);
    const issueDate = issueDateValue ? new Date(issueDateValue) : undefined;
    return {
      invoiceNumber: text(ide.nNF),
      invoiceDirection: 'outgoing',
      series: text(ide.serie),
      ...(accessKey ? { accessKey } : {}),
      ...(issueDate && !Number.isNaN(issueDate.getTime()) ? { issueDate } : {}),
      customerName: text(dest.xNome),
      customerTaxId: text(dest.CNPJ) ?? text(dest.CPF),
      customerPhone: text(address.fone),
      totalAmount: Number.isFinite(Number(icmsTotal.vNF))
        ? Number(icmsTotal.vNF)
        : undefined,
      items,
    };
  }

  private async extractPdfText(buffer: Buffer) {
    const loadingTask = getDocument({
      data: Uint8Array.from(buffer),
      useSystemFonts: true,
    });
    let pdf: PDFDocumentProxy;
    try {
      pdf = await loadingTask.promise;
    } catch {
      throw new BadRequestException(
        'O arquivo PDF está inválido ou protegido.',
      );
    }
    if (pdf.numPages > MAX_PDF_PAGES) {
      await loadingTask.destroy();
      throw new BadRequestException(
        `O PDF pode ter no máximo ${MAX_PDF_PAGES} páginas.`,
      );
    }
    try {
      const textPages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const textItems: string[] = [];
        const positionedItems: { str: string; transform: number[] }[] = [];
        for (const value of content.items) {
          const rawItem: unknown = value;
          if (!isRecord(rawItem) || typeof rawItem.str !== 'string') continue;
          textItems.push(rawItem.str);
          const transform = rawItem.transform;
          if (!Array.isArray(transform) || transform.length < 6) continue;
          const numericTransform = transform.flatMap((value: unknown) =>
            typeof value === 'number' ? [value] : [],
          );
          if (numericTransform.length === transform.length) {
            positionedItems.push({
              str: rawItem.str,
              transform: numericTransform,
            });
          }
        }
        let pageText: string;
        if (positionedItems.length === textItems.length) {
          const lines = new Map<number, { x: number; text: string }[]>();
          for (const item of positionedItems) {
            const transform = item.transform;
            const lineKey = Math.round(transform[5] / 2) * 2;
            const line = lines.get(lineKey) ?? [];
            line.push({ x: transform[4], text: item.str });
            lines.set(lineKey, line);
          }
          pageText = [...lines.entries()]
            .sort(([left], [right]) => right - left)
            .map(([, line]) =>
              line
                .sort((left, right) => left.x - right.x)
                .map((item) => item.text)
                .join(' '),
            )
            .join('\n');
        } else {
          pageText = textItems.join(' ');
        }
        textPages.push(pageText);
      }
      const extractedText = textPages.join('\n').trim();
      if (this.hasReadableInvoiceText(extractedText)) return extractedText;

      const worker = await this.getOcrWorker();
      const ocrPages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const initialViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
          2,
          4000 / Math.max(initialViewport.width, initialViewport.height),
          Math.sqrt(
            20_000_000 / (initialViewport.width * initialViewport.height),
          ),
        );
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        const context = canvas.getContext('2d');
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const recognized = await worker.recognize(canvas.toBuffer('image/png'));
        ocrPages.push(recognized.data.text);
      }
      const result = ocrPages.join('\n').trim();
      if (!result) {
        throw new BadRequestException(
          'Não foi possível ler texto no PDF enviado.',
        );
      }
      return result;
    } finally {
      await loadingTask.destroy();
    }
  }

  private async getOcrWorker() {
    this.ocrWorker ??= mkdir(OCR_CACHE_PATH, { recursive: true }).then(() =>
      Tesseract.createWorker('por', undefined, { cachePath: OCR_CACHE_PATH }),
    );
    try {
      return await this.ocrWorker;
    } catch (error) {
      this.ocrWorker = undefined;
      throw new BadGatewayException(
        `Não foi possível iniciar o OCR local em português: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }

  private hasReadableInvoiceText(value: string) {
    const text = value.trim();
    const words = text.match(/[\p{L}]{3,}/gu) ?? [];
    const amounts = text.match(/\b\d+[.,]\d{2}\b/g) ?? [];
    return text.length >= 80 && words.length >= 8 && amounts.length >= 1;
  }

  private parseOcrText(ocrText: string): InvoiceValues {
    const boundedText = ocrText.slice(0, 20_000);
    const invoiceNumber = boundedText.match(
      /(?:NF-?e|nota fiscal|n[uú]mero)\D{0,20}(\d{1,15})/i,
    )?.[1];
    const taxId = boundedText.match(
      /\b(?:\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/,
    )?.[0];
    const totalMatch = boundedText.match(
      /(?:valor\s+total|total\s+da\s+nota|total\s+dos\s+produtos)\D{0,30}(?:R\$\s*)?([\d.]+,\d{2})/i,
    )?.[1];
    return {
      invoiceNumber,
      customerTaxId: taxId,
      totalAmount: parseBrazilianAmount(totalMatch),
      items: [],
      ocrText: boundedText,
    };
  }

  private getOcrItemCandidates(ocrText: string) {
    const sensitiveLine =
      /\b(?:cpf|cnpj|telefone|fone|e-?mail|chave de acesso|destinat[aá]rio|emitente|endere[cç]o|inscri[cç][aã]o estadual|icms|ipi|pis|cofins|iss|danfe|c[aá]lculo do imposto|valor total|total da nota|tributos)\b/i;
    const amountPattern =
      /R\$\s*\d+(?:\.\d{3})*,\d{2}|\b\d+(?:\.\d{3})*,\d{2}\b|\b\d+\.\d{2}\b/;
    const lines = ocrText
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 4 && line.length <= 300);
    const candidates = new Set<number>();
    lines.forEach((line, index) => {
      if (
        amountPattern.test(line) &&
        !sensitiveLine.test(line) &&
        !/\b\d{11,14}\b/.test(line)
      ) {
        candidates.add(index);
        for (const neighbor of [index - 2, index - 1, index + 1, index + 2]) {
          const adjacentLine = lines[neighbor];
          if (
            adjacentLine &&
            !sensitiveLine.test(adjacentLine) &&
            !/\b\d{11,14}\b/.test(adjacentLine)
          ) {
            candidates.add(neighbor);
          }
        }
      }
    });
    return [...candidates]
      .sort((left, right) => left - right)
      .map((index) => lines[index])
      .filter(
        (line) =>
          line.length >= 4 &&
          line.length <= 300 &&
          !sensitiveLine.test(line) &&
          !/\b\d{11,14}\b/.test(line),
      )
      .slice(0, MAX_INVOICE_ITEMS);
  }

  private toReview(invoice: InvoiceImportDocument) {
    return {
      id: invoice.id,
      fileName: invoice.fileName,
      fileType: invoice.fileType,
      extractionMethod: invoice.extractionMethod,
      invoiceNumber: invoice.invoiceNumber ?? null,
      invoiceDirection: invoice.invoiceDirection ?? null,
      series: invoice.series ?? null,
      accessKey: invoice.accessKey ?? null,
      issueDate: invoice.issueDate ?? null,
      customerName: invoice.customerName ?? null,
      customerTaxId: invoice.customerTaxId ?? null,
      customerPhone: invoice.customerPhone ?? null,
      totalAmount: invoice.totalAmount ?? null,
      items: invoice.items,
      aiNeedsClarification: invoice.aiNeedsClarification ?? false,
      aiClarificationQuestion: invoice.aiClarificationQuestion ?? null,
      ocrText: invoice.ocrText ?? null,
      status: invoice.status,
      createdSaleIds: invoice.createdSaleIds,
      createdAt: invoice.get('createdAt'),
    };
  }
}
