  import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
  import { Document, Types } from 'mongoose';

  export type UserDocument = User & Document;

  @Schema({ timestamps: true })
  export class User {
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

    @Prop({ enum: ['owner', 'funcionario'], default: 'owner' })
    role: string;
  }

  export const UserSchema = SchemaFactory.createForClass(User);
