import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { UserRole } from '../enum/user.role.enum.js';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  // Nunca guardar a senha em texto puro — sempre o hash (ex: bcrypt)
  @Prop({ required: true, select: false })
  passwordHash: string;

  // Preenchido depois que a empresa é criada/associada
  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  company?: Types.ObjectId;

  // Se o usuário também for um funcionário (login de equipe)
  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  employee?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Equipe' })
  equipeMember?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.FUNCIONARIO,
  })
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
