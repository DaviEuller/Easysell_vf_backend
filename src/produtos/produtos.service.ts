import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { Produto, ProdutoDocument } from './Schemas/Schemas.produtos.js';
import { MercadoLivreService } from '../mercadolivre/mercadolivre.service.js';

@Injectable()
export class ProdutosService {
  constructor(
    @InjectModel(Produto.name)
    private readonly produtoModel: Model<ProdutoDocument>,
    private readonly mercadoLivreService: MercadoLivreService,
  ) {}

  private assertValidObjectId(
    id: string | Types.ObjectId,
    action: string,
  ): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `O id informado para ${action} é inválido: ${id}`,
      );
    }
  }

  async create(createProdutoDto: CreateProdutoDto): Promise<ProdutoDocument> {
    const produto = new this.produtoModel(createProdutoDto);
    const savedProduct = await produto.save();
    if (savedProduct.mercadoLivreListing) {
      await this.mercadoLivreService.publishConfiguredProduct(
        savedProduct.companyId.toString(),
        savedProduct.id,
      );
      return (
        (await this.produtoModel.findById(savedProduct.id).exec()) ??
        savedProduct
      );
    }
    return savedProduct;
  }

  findAll() {
    return this.produtoModel.find().exec();
  }

  findOne(id: string | Types.ObjectId): Promise<ProdutoDocument | null> {
    this.assertValidObjectId(id, 'buscar o produto');

    return this.produtoModel.findById(id).exec();
  }

  async findByCompany(
    companyId: string | Types.ObjectId,
  ): Promise<ProdutoDocument[]> {
    return this.produtoModel.find({ companyId }).exec();
  }

  async update(
    id: string,
    updateProdutoDto: UpdateProdutoDto,
  ): Promise<ProdutoDocument> {
    this.assertValidObjectId(id, 'atualizar o produto');

    const produto = await this.produtoModel
      .findByIdAndUpdate(id, updateProdutoDto, { returnDocument: 'after' })
      .exec();

    if (!produto) {
      throw new NotFoundException(`O produto com id: ${id} não foi encontrado`);
    }

    if (produto.mercadoLivreListing) {
      await this.mercadoLivreService.publishConfiguredProduct(
        produto.companyId.toString(),
        produto.id,
      );
      return (await this.produtoModel.findById(produto.id).exec()) ?? produto;
    }

    return produto;
  }

  async remove(id: string | Types.ObjectId) {
    this.assertValidObjectId(id, 'remover o produto');

    const produto = await this.produtoModel.findByIdAndDelete(id).exec();

    if (!produto) {
      throw new NotFoundException(
        `O produto com id : ${id} não foi encontrado`,
      );
    }

    return produto;
  }
}
