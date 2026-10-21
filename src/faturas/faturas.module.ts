import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Cliente, ClienteSchema } from '../clientes/Schemas/clientes.schemas.js';
import { Produto, ProdutoSchema } from '../produtos/Schemas/Schemas.produtos.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { FaturasController } from './faturas.controller.js';
import { FaturasService } from './faturas.service.js';
import { Fatura, FaturaSchema } from './schemas/fatura.schema.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Fatura.name, schema: FaturaSchema },
      { name: Cliente.name, schema: ClienteSchema },
      { name: Produto.name, schema: ProdutoSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FaturasController],
  providers: [FaturasService],
})
export class FaturasModule {}
