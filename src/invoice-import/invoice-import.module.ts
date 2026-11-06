import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { AiModule } from '../ai/ai.module.js';
import {
  Cliente,
  ClienteSchema,
} from '../clientes/Schemas/clientes.schemas.js';
import {
  Produto,
  ProdutoSchema,
} from '../produtos/Schemas/Schemas.produtos.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { InvoiceImportController } from './invoice-import.controller.js';
import { InvoiceImportService } from './invoice-import.service.js';
import {
  InvoiceImport,
  InvoiceImportSchema,
} from './entities/invoice-import.entity.js';

@Module({
  imports: [
    AuthModule,
    AiModule,
    MongooseModule.forFeature([
      { name: InvoiceImport.name, schema: InvoiceImportSchema },
      { name: User.name, schema: UserSchema },
      { name: Produto.name, schema: ProdutoSchema },
      { name: Cliente.name, schema: ClienteSchema },
    ]),
  ],
  controllers: [InvoiceImportController],
  providers: [InvoiceImportService],
})
export class InvoiceImportModule {}
