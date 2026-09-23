import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClienteDocument = HydratedDocument<Cliente>;

@Schema({ timestamps: true })
export class Cliente {

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  Numero: string;

  @Prop({ required: true })
  Id_Produto: string;

  @Prop({ required: true })
  id_company: string;

  @Prop({ required: true })
  Preco_gasto: number;

  @Prop({ required: true })
  Quantidade: number;
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);