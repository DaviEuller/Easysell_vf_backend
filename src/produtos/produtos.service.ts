import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { Produto, ProdutoDocument } from './Schemas/Schemas.produtos.js';

@Injectable()
export class ProdutosService {
  constructor(
    @InjectModel(Produto.name)
    private readonly produtoModel: Model<ProdutoDocument>,
  ) {}

  async create(createProdutoDto: CreateProdutoDto): Promise<Produto> {
    const produto = new this.produtoModel(createProdutoDto);

    return produto.save();''
  }
  
  findAll() {
    return this.produtoModel.find().exec();
  }

  findOne(id: number): Promise<ProdutoDocument | null>{
    return this.produtoModel.findById(id).exec()
  }

  async findByCompany(companyId: string): Promise<ProdutoDocument[]> {
    return this.produtoModel.find({ companyId }).exec();
  }

  async update( id: string, updateProdutoDto: UpdateProdutoDto,
  ): Promise<ProdutoDocument> {

    const produto = await this.produtoModel.findByIdAndUpdate(id, updateProdutoDto, { new: true, }).exec();

    if (!produto) {
      throw new NotFoundException(
        `O produto com id: ${id} não foi encontrado`,
      );
    }

    return produto;
  }

  async remove(id: number) {
    const produto = await this.produtoModel.findByIdAndDelete(id).exec();

    if (!produto) {
      throw new NotFoundException(`O produto com id : ${id} não foi encontrado`,);
    }

    return produto;
  }
}