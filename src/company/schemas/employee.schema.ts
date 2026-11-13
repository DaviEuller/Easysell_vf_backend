import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

export enum EmployeeStatus {
  ATIVO = 'Ativo',
  FERIAS = 'Férias',
}

@Schema({ timestamps: true })
export class Employee {
  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  cpf: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  funcao: string;

  @Prop({
    type: String,
    enum: Object.values(EmployeeStatus),
    default: EmployeeStatus.ATIVO,
  })
  status: EmployeeStatus;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
