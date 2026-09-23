import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProdutoDocument = Produto & Document;

@Schema({ timestamps: true })
export class Produto {

  @Prop({
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    required: true,
    trim: true,
  })
  categoria: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    required: true,
    min: 0,
  })
  quantidade: number;

  @Prop({
    required: true,
    min: 0,
  })
  preco: number;
}

export const ProdutoSchema = SchemaFactory.createForClass(Produto);