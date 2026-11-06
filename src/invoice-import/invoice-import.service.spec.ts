import { Types } from 'mongoose';
import { vi } from 'vitest';
import type { Model } from 'mongoose';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { ProdutoDocument } from '../produtos/Schemas/Schemas.produtos.js';
import type { ClienteDocument } from '../clientes/Schemas/clientes.schemas.js';
import { InvoiceImportService } from './invoice-import.service.js';
import { InvoiceImport } from './entities/invoice-import.entity.js';

const userId = '507f1f77bcf86cd799439011';
const companyId = '507f1f77bcf86cd799439012';

describe('InvoiceImportService', () => {
  it('extracts NF-e XML into a pending review without creating a sale', async () => {
    const savedInvoice: Record<string, unknown> = {
      id: '507f1f77bcf86cd799439013',
      get: vi.fn(() => new Date('2026-11-06T12:00:00Z')),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const invoiceModel = vi.fn(function (values: Record<string, unknown>) {
      Object.assign(savedInvoice, values);
      return savedInvoice;
    });
    Object.assign(invoiceModel, {
      findOne: vi.fn(() => ({
        select: vi.fn(() => ({
          lean: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue(null),
          })),
        })),
      })),
    });
    const userModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue({
            company: new Types.ObjectId(companyId),
          }),
        })),
      })),
    };
    const service = new InvoiceImportService(
      invoiceModel as unknown as Model<InvoiceImport>,
      userModel as unknown as Model<UserDocument>,
      {} as Model<ProdutoDocument>,
      {} as Model<ClienteDocument>,
      {} as never,
      { assistInvoiceReview: vi.fn() } as never,
    );
    const xml = `<?xml version="1.0"?>
      <nfeProc><NFe><infNFe Id="NFe35261112345678000199550010000001231123456789">
        <ide><nNF>123</nNF><serie>1</serie><tpNF>1</tpNF><dhEmi>2026-11-06T09:00:00-03:00</dhEmi></ide>
        <dest><xNome>Cliente Teste</xNome><CNPJ>12345678000199</CNPJ>
          <enderDest><fone>11999999999</fone></enderDest></dest>
        <det nItem="1"><prod><cProd>SKU-1</cProd><xProd>Caneca</xProd>
          <qCom>2.0000</qCom><vUnCom>15.50</vUnCom><vProd>31.00</vProd></prod></det>
        <total><ICMSTot><vNF>31.00</vNF></ICMSTot></total>
      </infNFe></NFe></nfeProc>`;

    const result = await service.importFile(
      { userId, companyId },
      {
        originalname: 'nf-e.xml',
        size: Buffer.byteLength(xml),
        buffer: Buffer.from(xml),
      },
    );

    expect(result).toMatchObject({
      fileType: 'xml',
      extractionMethod: 'xml',
      invoiceNumber: '123',
      invoiceDirection: 'outgoing',
      series: '1',
      customerName: 'Cliente Teste',
      customerTaxId: '12345678000199',
      customerPhone: '11999999999',
      totalAmount: 31,
      status: 'pending_review',
      items: [
        {
          sku: 'SKU-1',
          description: 'Caneca',
          quantity: 2,
          unitPrice: 15.5,
          total: 31,
        },
      ],
    });
    expect(savedInvoice.accessKey).toBe(
      '35261112345678000199550010000001231123456789',
    );
    expect(invoiceModel).toHaveBeenCalledOnce();
    expect(savedInvoice.save).toHaveBeenCalledOnce();
  });

  it('creates a manual sale review without changing inventory', async () => {
    const productId = '507f1f77bcf86cd799439014';
    const savedInvoice: Record<string, unknown> = {
      id: '507f1f77bcf86cd799439013',
      get: vi.fn(() => new Date('2026-11-06T12:00:00Z')),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const invoiceModel = vi.fn(function (values: Record<string, unknown>) {
      Object.assign(savedInvoice, values);
      return savedInvoice;
    });
    const userModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue({
            company: new Types.ObjectId(companyId),
          }),
        })),
      })),
    };
    const product = { _id: new Types.ObjectId(productId), name: 'Caneca' };
    const productQuery = {
      select: vi.fn(),
      lean: vi.fn(),
      exec: vi.fn().mockResolvedValue([product]),
    };
    productQuery.select.mockReturnValue(productQuery);
    productQuery.lean.mockReturnValue(productQuery);
    const productModel = {
      find: vi.fn().mockReturnValue(productQuery),
    };
    const service = new InvoiceImportService(
      invoiceModel as unknown as Model<InvoiceImport>,
      userModel as unknown as Model<UserDocument>,
      productModel as unknown as Model<ProdutoDocument>,
      {} as Model<ClienteDocument>,
      {} as never,
      { assistInvoiceReview: vi.fn() } as never,
    );

    const result = await service.createManual(
      { userId, companyId },
      {
        customerName: ' Cliente Teste ',
        items: [{ productId, quantity: 2, unitPrice: 15 }],
      },
    );

    expect(result).toMatchObject({
      fileType: 'manual',
      extractionMethod: 'manual',
      customerName: 'Cliente Teste',
      status: 'pending_review',
      items: [
        {
          description: 'Caneca',
          quantity: 2,
          unitPrice: 15,
          total: 30,
          suggestedProductId: productId,
        },
      ],
    });
    expect(savedInvoice.save).toHaveBeenCalledOnce();
    expect(savedInvoice.status).toBe('pending_review');
  });

  it('sends only candidate product lines to the invoice assistant and saves its suggestions', async () => {
    const invoiceId = '507f1f77bcf86cd799439013';
    const invoice = {
      id: invoiceId,
      companyId: new Types.ObjectId(companyId),
      status: 'pending_review',
      items: [],
      ocrText: [
        'DESTINATARIO: Cliente Teste',
        'CPF: 123.456.789-09',
        'Caneca Decorada',
        'Quantidade: 2 unidades',
        '15,00 30,00',
        'Valor total: 30,00',
      ].join('\n'),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const invoiceModel = {
      findOne: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue(invoice),
      })),
    };
    const userModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue({
            company: new Types.ObjectId(companyId),
          }),
        })),
      })),
    };
    const assistantResult = {
      items: [
        {
          description: 'Caneca Decorada',
          quantity: 2,
          unitPrice: 15,
          total: 30,
          productId: '507f1f77bcf86cd799439014',
          confidence: 0.9,
        },
      ],
      answer: 'Encontrei uma correspondência.',
      needsClarification: false,
      clarificationQuestion: null,
    };
    const aiService = {
      assistInvoiceReview: vi.fn().mockResolvedValue(assistantResult),
    };
    const service = new InvoiceImportService(
      invoiceModel as unknown as Model<InvoiceImport>,
      userModel as unknown as Model<UserDocument>,
      {} as Model<ProdutoDocument>,
      {} as Model<ClienteDocument>,
      {} as never,
      aiService as never,
    );

    await expect(
      service.assist({ userId, companyId }, invoiceId),
    ).resolves.toEqual(assistantResult);

    expect(aiService.assistInvoiceReview).toHaveBeenCalledWith(
      { userId, companyId },
      {
        items: [],
        ocrLines: ['Caneca Decorada', 'Quantidade: 2 unidades', '15,00 30,00'],
      },
    );
    expect(invoice.items).toMatchObject([
      {
        description: 'Caneca Decorada',
        suggestedProductId: '507f1f77bcf86cd799439014',
        aiConfidence: 0.9,
      },
    ]);
    expect(invoice.aiNeedsClarification).toBe(false);
    expect(invoice.save).toHaveBeenCalledOnce();
  });

  it('creates scoped sales and deducts stock only when an invoice is confirmed', async () => {
    const invoiceId = '507f1f77bcf86cd799439013';
    const productId = '507f1f77bcf86cd799439014';
    const invoice = {
      id: invoiceId,
      status: 'pending_review',
      companyId: new Types.ObjectId(companyId),
      customerName: 'Cliente Teste',
      items: [{ description: 'Caneca', quantity: 2, unitPrice: 15.5 }],
      createdSaleIds: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    const invoiceModel = {
      findOne: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue(invoice),
      })),
    };
    const product = {
      id: productId,
      name: 'Caneca',
      quantidade: 8,
    };
    const productModel = {
      find: vi.fn(() => ({
        session: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue([product]),
        })),
      })),
      findOneAndUpdate: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue(product),
      })),
    };
    const saleSave = vi.fn().mockResolvedValue(undefined);
    const saleModel = vi.fn(function () {
      return { id: '507f1f77bcf86cd799439015', save: saleSave };
    });
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    const userModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue({
            company: new Types.ObjectId(companyId),
          }),
        })),
      })),
    };
    const service = new InvoiceImportService(
      invoiceModel as unknown as Model<InvoiceImport>,
      userModel as unknown as Model<UserDocument>,
      productModel as unknown as Model<ProdutoDocument>,
      saleModel as unknown as Model<ClienteDocument>,
      { startSession: vi.fn().mockResolvedValue(session) } as never,
      { assistInvoiceReview: vi.fn() } as never,
    );

    const result = await service.confirm({ userId, companyId }, invoiceId, {
      confirmAsSale: true,
      items: [{ productId, quantity: 2, unitPrice: 15.5 }],
    });

    expect(result).toEqual({
      status: 'imported',
      invoiceImportId: invoiceId,
      createdSaleIds: ['507f1f77bcf86cd799439015'],
    });
    expect(productModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: productId,
        companyId,
        quantidade: { $gte: 2 },
      },
      { $inc: { quantidade: -2 } },
      { session, returnDocument: 'after' },
    );
    expect(saleModel).toHaveBeenCalledWith({
      name: 'Cliente Teste',
      IdProduto: productId,
      idcompany: companyId,
      Quantidade: 2,
      Preco_gasto: 31,
      parcelas: 1,
      valorPago: 0,
      saldoPendente: 31,
    });
    expect(saleSave).toHaveBeenCalledWith({ session });
    expect(invoice.status).toBe('imported');
  });
});
