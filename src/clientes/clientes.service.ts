import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';
import { Cliente, ClienteDocument } from './Schemas/clientes.schemas.js';
import {
  Produto,
  ProdutoDocument,
} from '../produtos/Schemas/Schemas.produtos.js';
import { Fatura } from '../faturas/schemas/fatura.schema.js';
import type { FaturaDocument } from '../faturas/schemas/fatura.schema.js';

@Injectable()
export class ClientesService {
  constructor(
    @InjectModel(Cliente.name)
    private readonly clienteModel: Model<ClienteDocument>,
    @InjectModel(Produto.name)
    private readonly produtoModel: Model<ProdutoDocument>,
    @InjectModel(Fatura.name)
    private readonly faturaModel: Model<FaturaDocument>,
  ) {}

  async create(createClienteDto: CreateClienteDto): Promise<ClienteDocument> {
    const total = Number(createClienteDto.Preco_gasto);
    const valorPago = Number(createClienteDto.valorPago ?? 0);
    const parcelas = Number(createClienteDto.parcelas ?? 1);
    const quantidade = Number(createClienteDto.Quantidade);
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException(
        'O valor da venda deve ser maior que zero.',
      );
    }
    if (!Number.isFinite(valorPago) || valorPago < 0 || valorPago > total) {
      throw new BadRequestException(
        'O valor pago deve estar entre zero e o total da venda.',
      );
    }
    if (!Number.isInteger(parcelas) || parcelas < 1) {
      throw new BadRequestException(
        'O número de parcelas deve ser um inteiro positivo.',
      );
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new BadRequestException(
        'A quantidade deve ser um inteiro positivo.',
      );
    }
    const dataPrimeiroVencimento = createClienteDto.dataPrimeiroVencimento
      ? new Date(createClienteDto.dataPrimeiroVencimento)
      : undefined;
    if (
      dataPrimeiroVencimento &&
      Number.isNaN(dataPrimeiroVencimento.getTime())
    ) {
      throw new BadRequestException(
        'A data do primeiro vencimento é inválida.',
      );
    }

    const produto = await this.produtoModel
      .findById(createClienteDto.IdProduto)
      .exec();

    if (!produto) {
      throw new NotFoundException(
        `Produto com id ${createClienteDto.IdProduto} não encontrado`,
      );
    }

    const quantidadeSolicitada = quantidade;

    if (quantidadeSolicitada > Number(produto.quantidade)) {
      throw new BadRequestException(
        `Quantidade solicitada (${quantidadeSolicitada}) excede o estoque disponível (${produto.quantidade})`,
      );
    }

    produto.quantidade = Number(produto.quantidade) - quantidadeSolicitada;
    await produto.save();

    const cliente = new this.clienteModel({
      name: createClienteDto.name,
      Numero: createClienteDto.Numero,
      IdProduto: createClienteDto.IdProduto,
      idcompany: createClienteDto.idcompany,
      Preco_gasto: total,
      Quantidade: quantidade,
      parcelas,
      valorPago,
      saldoPendente: Number((total - valorPago).toFixed(2)),
      ...(dataPrimeiroVencimento ? { dataPrimeiroVencimento } : {}),
    });

    return cliente.save();
  }

  async findAll(): Promise<ClienteDocument[]> {
    return this.clienteModel.find().exec();
  }

  async findOne(id: string): Promise<ClienteDocument> {
    const cliente = await this.clienteModel.findById(id).exec();

    if (!cliente) {
      throw new NotFoundException(`Cliente com id ${id} não encontrado`);
    }

    return cliente;
  }

  async findByCompany(companyId: string): Promise<ClienteDocument[]> {
    const [sales, invoices] = await Promise.all([
      this.clienteModel.find({ idcompany: companyId }).exec(),
      this.faturaModel.find({ companyId }).exec(),
    ]);
    const invoiceBySaleId = new Map(
      invoices.map((invoice) => [invoice.saleId.toString(), invoice]),
    );
    return sales.map((sale) => {
      const invoice = invoiceBySaleId.get(sale.id);
      const paidInstallments =
        invoice?.installments?.reduce(
          (total: number, installment: { amount: number; status: string }) =>
            total +
            (installment.status === 'paga' ? Number(installment.amount) : 0),
          0,
        ) ?? (invoice?.status === 'paga' ? Number(invoice.amount) : 0);
      const valorPago = Number(
        (Number(sale.valorPago ?? 0) + paidInstallments).toFixed(2),
      );
      return Object.assign(sale, {
        parcelas: Number(sale.parcelas ?? 1),
        valorPago,
        saldoPendente: Number(
          Math.max(0, Number(sale.Preco_gasto) - valorPago).toFixed(2),
        ),
      });
    });
  }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
  ): Promise<ClienteDocument> {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, updateClienteDto, {
        returnDocument: 'after',
      })
      .exec();

    if (!cliente) {
      throw new NotFoundException(`Cliente com id ${id} não encontrado`);
    }

    return cliente;
  }

  async remove(id: string): Promise<ClienteDocument> {
    const cliente = await this.clienteModel.findByIdAndDelete(id).exec();

    if (!cliente) {
      throw new NotFoundException(`Cliente com id ${id} não encontrado`);
    }

    return cliente;
  }
}
