import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';
import {
  Cliente,
  ClienteDocument,
} from './Schemas/clientes.schemas.js';
import {
  Produto,
  ProdutoDocument,
} from '../produtos/Schemas/Schemas.produtos.js';

@Injectable()
export class ClientesService {
  constructor(
    @InjectModel(Cliente.name)
    private readonly clienteModel: Model<ClienteDocument>,
    @InjectModel(Produto.name)
    private readonly produtoModel: Model<ProdutoDocument>,
  ) {}

  async create(createClienteDto: CreateClienteDto): Promise<ClienteDocument> {
    const produto = await this.produtoModel.findById(createClienteDto.IdProduto).exec();

    if (!produto) {
      throw new NotFoundException(
        `Produto com id ${createClienteDto.IdProduto} não encontrado`,
      );
    }

    const quantidadeSolicitada = Number(createClienteDto.Quantidade ?? 0);

    if (quantidadeSolicitada > Number(produto.quantidade)) {
      throw new BadRequestException(
        `Quantidade solicitada (${quantidadeSolicitada}) excede o estoque disponível (${produto.quantidade})`,
      );
    }

    produto.quantidade = Number(produto.quantidade) - quantidadeSolicitada;
    await produto.save();

    const cliente = new this.clienteModel(createClienteDto);

    return cliente.save();
  }

  async findAll(): Promise<ClienteDocument[]> {
    return this.clienteModel.find().exec();
  }

  async findOne(id: string): Promise<ClienteDocument> {
    const cliente = await this.clienteModel.findById(id).exec();

    if (!cliente) {
      throw new NotFoundException(
        `Cliente com id ${id} não encontrado`,
      );
    }

    return cliente;
  }

  async findByCompany(companyId: string): Promise<ClienteDocument[]> {
      return this.clienteModel.find({ idcompany: companyId }).exec();
    }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
  ): Promise<ClienteDocument> {

    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, updateClienteDto, {
        new: true,
      })
      .exec();

    if (!cliente) {
      throw new NotFoundException(
        `Cliente com id ${id} não encontrado`,
      );
    }

    return cliente;
  }

  async remove(id: string): Promise<ClienteDocument> {

    const cliente = await this.clienteModel
      .findByIdAndDelete(id)
      .exec();

    if (!cliente) {
      throw new NotFoundException(
        `Cliente com id ${id} não encontrado`,
      );
    }

    return cliente;
  }
}