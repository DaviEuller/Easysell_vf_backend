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
  IdProduto: string;

  @Prop({ required: true })
  idcompany: string;

  @Prop({ required: true })
  Preco_gasto: number;

  @Prop({ required: true })
  Quantidade: number;

  @Prop({ type: Number, min: 1, default: 1 })
  parcelas: number;

  @Prop({ type: Number, min: 0, default: 0 })
  valorPago: number;

  @Prop({ type: Number, min: 0 })
  saldoPendente?: number;

  @Prop({ type: Date })
  dataPrimeiroVencimento?: Date;
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);
