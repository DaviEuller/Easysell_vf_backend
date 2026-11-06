import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Produto,
  ProdutoSchema,
} from '../produtos/Schemas/Schemas.produtos.js';
import { MercadoLivreController } from './mercadolivre.controller.js';
import { MercadoLivreService } from './mercadolivre.service.js';
import {
  MercadoLivreAccount,
  MercadoLivreAccountSchema,
} from './entities/mercadolivre-account.entity.js';
import {
  MercadoLivrePurchase,
  MercadoLivrePurchaseSchema,
} from './entities/mercadolivre-purchase.entity.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: MercadoLivreAccount.name, schema: MercadoLivreAccountSchema },
      { name: MercadoLivrePurchase.name, schema: MercadoLivrePurchaseSchema },
      { name: User.name, schema: UserSchema },
      { name: Produto.name, schema: ProdutoSchema },
    ]),
  ],
  controllers: [MercadoLivreController],
  providers: [MercadoLivreService],
  exports: [MercadoLivreService],
})
export class MercadoLivreModule {}
