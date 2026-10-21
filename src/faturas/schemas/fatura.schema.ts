import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FaturaDocument = HydratedDocument<Fatura>;
export type FaturaStatus = 'pendente' | 'paga';

@Schema({ _id: false })
export class FaturaInstallment {
  @Prop({ required: true, min: 1 })
  number: number;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: String, enum: ['pendente', 'paga'], default: 'pendente' })
  status: FaturaStatus;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;
}

export const FaturaInstallmentSchema =
  SchemaFactory.createForClass(FaturaInstallment);

@Schema({ timestamps: true })
export class Fatura {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true })
  saleId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ required: true, trim: true })
  customerPhone: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: String, enum: ['pendente', 'paga'], default: 'pendente' })
  status: FaturaStatus;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  @Prop({ type: [FaturaInstallmentSchema], default: [] })
  installments: FaturaInstallment[];
}

export const FaturaSchema = SchemaFactory.createForClass(Fatura);
FaturaSchema.index({ companyId: 1, saleId: 1 }, { unique: true });
