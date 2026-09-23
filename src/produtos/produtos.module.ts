import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service.js';
import { ProdutosController } from './produtos.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { ProdutoDocument, Produto, ProdutoSchema } from './Schemas/Schemas.produtos.js'

@Module({
  imports: [
      MongooseModule.forFeature([
        {
          name: Produto.name,
          schema: ProdutoSchema,
        },
      ]),
    ],
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule {}
