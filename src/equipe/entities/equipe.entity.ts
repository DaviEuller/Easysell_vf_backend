import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EquipeDocument = HydratedDocument<Equipe>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class EquipeTask {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  text: string;

  @Prop({ type: Boolean, default: false })
  completed: boolean;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ trim: true, maxlength: 2000 })
  report?: string;

  @Prop({ type: Types.ObjectId })
  attachmentId?: Types.ObjectId;

  @Prop({ trim: true })
  attachmentName?: string;

  @Prop({ trim: true })
  attachmentType?: string;

  @Prop({ min: 0 })
  attachmentSize?: number;

}

export const EquipeTaskSchema = SchemaFactory.createForClass(EquipeTask);

@Schema({ timestamps: true })
export class Equipe {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  age: number;

  @Prop({ required: true, trim: true })
  funcao: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  dataEntrada: Date;

  @Prop({ required: true, trim: true })
  telefone: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  adminId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', unique: true, sparse: true, index: true })
  userId?: Types.ObjectId;

  @Prop({ lowercase: true, trim: true })
  userEmail?: string;

  @Prop({ type: [EquipeTaskSchema], default: [] })
  tasks: EquipeTask[];
}

export const EquipeSchema = SchemaFactory.createForClass(Equipe);
