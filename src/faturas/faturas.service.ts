import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { Cliente } from '../clientes/Schemas/clientes.schemas.js';
import type { ClienteDocument } from '../clientes/Schemas/clientes.schemas.js';
import { Produto } from '../produtos/Schemas/Schemas.produtos.js';
import type { ProdutoDocument } from '../produtos/Schemas/Schemas.produtos.js';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { CreateFaturaDto } from './dto/create-fatura.dto.js';
import { Fatura } from './schemas/fatura.schema.js';
import type { FaturaDocument, FaturaStatus } from './schemas/fatura.schema.js';

export type FaturaUser = { userId: string };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

@Injectable()
export class FaturasService {
  constructor(
    @InjectModel(Fatura.name)
    private readonly faturaModel: Model<FaturaDocument>,
    @InjectModel(Cliente.name)
    private readonly clienteModel: Model<ClienteDocument>,
    @InjectModel(Produto.name)
    private readonly produtoModel: Model<ProdutoDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async list(user: FaturaUser) {
    const companyId = await this.getCompanyId(user);
    return this.faturaModel
      .find({ companyId })
      .sort({ dueDate: 1, createdAt: -1 })
      .exec();
  }

  async listAvailableSales(user: FaturaUser) {
    const companyId = await this.getCompanyId(user);
    const sales = await this.clienteModel
      .find({ idcompany: companyId })
      .sort({ createdAt: -1 })
      .exec();
    const invoices = await this.faturaModel
      .find({ companyId })
      .select('saleId')
      .exec();
    const invoicedSaleIds = new Set(
      invoices.map((invoice) => invoice.saleId.toString()),
    );

    return sales
      .filter((sale) => !invoicedSaleIds.has(sale.id))
      .map((sale) => ({
        id: sale.id,
        customerName: sale.name,
        customerPhone: sale.Numero,
        productId: sale.IdProduto,
        amount: Number(sale.Preco_gasto),
        quantity: Number(sale.Quantidade),
        installments: Number(sale.parcelas ?? 1),
        amountPaid: Number(sale.valorPago ?? 0),
        outstandingAmount: Number(
          (Number(sale.Preco_gasto) - Number(sale.valorPago ?? 0)).toFixed(2),
        ),
        firstDueDate: sale.dataPrimeiroVencimento ?? null,
      }));
  }

  async create(user: FaturaUser, dto: CreateFaturaDto) {
    const companyId = await this.getCompanyId(user);
    if (!Types.ObjectId.isValid(dto.saleId)) {
      throw new BadRequestException('A venda selecionada é inválida.');
    }
    const sale = await this.clienteModel
      .findOne({ _id: dto.saleId, idcompany: companyId })
      .exec();
    if (!sale) {
      throw new NotFoundException('Venda não encontrada nesta empresa.');
    }

    const dueDateValue =
      dto.dueDate ?? sale.dataPrimeiroVencimento?.toISOString();
    if (!dueDateValue) {
      throw new BadRequestException(
        'Informe a data do primeiro vencimento ao criar a venda ou a fatura.',
      );
    }
    const firstDueDate = new Date(dueDateValue);
    if (Number.isNaN(firstDueDate.getTime())) {
      throw new BadRequestException('A data de vencimento é inválida.');
    }

    const amount = Number(sale.Preco_gasto);
    const amountPaid = Number(sale.valorPago ?? 0);
    const outstandingAmount = Number((amount - amountPaid).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'A venda não possui um valor válido para gerar a fatura.',
      );
    }
    if (
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      outstandingAmount <= 0
    ) {
      throw new BadRequestException(
        'A venda não possui saldo pendente para gerar uma cobrança.',
      );
    }
    const installmentCount = Number(sale.parcelas ?? 1);
    if (!Number.isInteger(installmentCount) || installmentCount < 1) {
      throw new BadRequestException(
        'O número de parcelas informado na venda é inválido.',
      );
    }
    const product = Types.ObjectId.isValid(sale.IdProduto)
      ? await this.produtoModel
          .findOne({ _id: sale.IdProduto, companyId })
          .select('name')
          .exec()
      : null;

    const outstandingCents = Math.round(outstandingAmount * 100);
    const baseCents = Math.floor(outstandingCents / installmentCount);
    const remainingCents = outstandingCents % installmentCount;
    const installments = Array.from(
      { length: installmentCount },
      (_, index) => {
        const dueDate = new Date(firstDueDate);
        const initialDay = dueDate.getUTCDate();
        dueDate.setUTCDate(1);
        dueDate.setUTCMonth(dueDate.getUTCMonth() + index);
        const finalDay = new Date(
          Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0),
        ).getUTCDate();
        dueDate.setUTCDate(Math.min(initialDay, finalDay));
        return {
          number: index + 1,
          amount: (baseCents + (index < remainingCents ? 1 : 0)) / 100,
          dueDate,
          status: 'pendente' as const,
          paidAt: null,
        };
      },
    );

    try {
      return await new this.faturaModel({
        companyId: new Types.ObjectId(companyId),
        saleId: sale._id,
        customerName: sale.name,
        customerPhone: sale.Numero,
        description: `${sale.Quantidade} unidade(s) de ${product?.name ?? 'produto da venda'}`,
        amount: outstandingAmount,
        dueDate: firstDueDate,
        status: 'pendente',
        installments,
      }).save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Já existe uma fatura para esta venda.');
      }
      throw error;
    }
  }

  async setStatus(user: FaturaUser, id: string, status: FaturaStatus) {
    const companyId = await this.getCompanyId(user);
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('O identificador da fatura é inválido.');
    }

    const invoice = await this.faturaModel
      .findOneAndUpdate(
        { _id: id, companyId },
        {
          $set: {
            status,
            paidAt: status === 'paga' ? new Date() : null,
            'installments.$[].status': status,
            'installments.$[].paidAt': status === 'paga' ? new Date() : null,
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada nesta empresa.');
    }
    return invoice;
  }

  async setInstallmentStatus(
    user: FaturaUser,
    id: string,
    installmentNumber: number,
    status: FaturaStatus,
  ) {
    const companyId = await this.getCompanyId(user);
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('O identificador da fatura é inválido.');
    }
    const invoice = await this.faturaModel
      .findOne({ _id: id, companyId })
      .exec();
    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada nesta empresa.');
    }
    const installment = invoice.installments.find(
      (item) => item.number === installmentNumber,
    );
    if (!installment) {
      throw new NotFoundException('Parcela não encontrada nesta fatura.');
    }
    installment.status = status;
    installment.paidAt = status === 'paga' ? new Date() : null;
    const allPaid = invoice.installments.every(
      (item) => item.status === 'paga',
    );
    invoice.status = allPaid ? 'paga' : 'pendente';
    invoice.paidAt = allPaid ? new Date() : null;
    return invoice.save();
  }

  async getWhatsAppCharge(user: FaturaUser, id: string) {
    const companyId = await this.getCompanyId(user);
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('O identificador da fatura é inválido.');
    }
    const invoice = await this.faturaModel
      .findOne({ _id: id, companyId })
      .exec();
    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada nesta empresa.');
    }
    const pendingInstallments = invoice.installments.filter(
      (item) => item.status === 'pendente',
    );
    const balance =
      pendingInstallments.length > 0
        ? pendingInstallments.reduce((total, item) => total + item.amount, 0)
        : invoice.status === 'pendente'
          ? Number(invoice.amount)
          : 0;
    if (balance <= 0) {
      throw new BadRequestException('Esta fatura já está paga.');
    }
    const phone = invoice.customerPhone.replace(/\D/g, '');
    const internationalPhone =
      phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
    if (internationalPhone.length < 12 || internationalPhone.length > 15) {
      throw new BadRequestException(
        'O telefone do cliente não possui um formato válido para WhatsApp.',
      );
    }
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(balance);
    const message = `Olá, ${invoice.customerName}! O saldo pendente da sua compra é ${formattedAmount}.`;
    const url = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
    return {
      phone: internationalPhone,
      message,
      url,
      outstandingAmount: balance,
    };
  }

  private async getCompanyId(user: FaturaUser): Promise<string> {
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
    return companyId;
  }
}
