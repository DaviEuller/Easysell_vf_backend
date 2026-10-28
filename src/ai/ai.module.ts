import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import {
  Cliente,
  ClienteSchema,
} from '../clientes/Schemas/clientes.schemas.js';
import {
  Produto,
  ProdutoSchema,
} from '../produtos/Schemas/Schemas.produtos.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Employee,
  EmployeeSchema,
} from '../company/schemas/employee.schema.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import {
  AiConversation,
  AiConversationSchema,
} from './entities/ai-conversation.entity.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: Produto.name, schema: ProdutoSchema },
      { name: Cliente.name, schema: ClienteSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
