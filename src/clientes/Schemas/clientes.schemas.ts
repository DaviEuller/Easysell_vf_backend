import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

export type ClienteDocument = HydratedDocument<Cliente>;

export enum SaleStatus {
  CONCLUIDA = 'Concluída',
  PENDENTE = 'Pendente',
  CANCELADA = 'Cancelada',
}

@Schema({ timestamps: true })
export class Cliente {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String })
  Numero?: string;

  @Prop({ required: true })
  IdProduto: string;

  @Prop({ required: true })
  idcompany: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  funcionarioId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(SaleStatus),
    default: SaleStatus.PENDENTE,
  })
  status: SaleStatus;

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
