import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ClientesService } from './clientes.service.js';
import { ClientesController } from './clientes.controller.js';
import {
  Cliente,
  ClienteSchema,
} from './Schemas/clientes.schemas.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Cliente.name,
        schema: ClienteSchema,
      },
    ]),
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}