import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service.js';
import { ProdutosController } from './produtos.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { MercadoLivreModule } from '../mercadolivre/mercadolivre.module.js';
import { Produto, ProdutoSchema } from './Schemas/Schemas.produtos.js';

@Module({
  imports: [
    MercadoLivreModule,
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
