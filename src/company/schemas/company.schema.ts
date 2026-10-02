import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true })
export class Company {
  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  categoria: string;

  @Prop({ required: true, unique: true, trim: true })
  cnpj: string;

  @Prop({ required: true, trim: true })
  cpfResponsavel: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  responsavelId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Employee' }], default: [] })
  employeeIds: Types.ObjectId[];
}

export const CompanySchema = SchemaFactory.createForClass(Company);
