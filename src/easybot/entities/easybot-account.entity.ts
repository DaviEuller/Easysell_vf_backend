import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EasyBotAccountDocument = HydratedDocument<EasyBotAccount>;
export type EasyBotConnectionStatus =
  'disconnected' | 'connecting' | 'qr' | 'ready' | 'error';

@Schema({ timestamps: true })
export class EasyBotAccount {
  @Prop({
    type: Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['disconnected', 'connecting', 'qr', 'ready', 'error'],
    default: 'disconnected',
  })
  status: EasyBotConnectionStatus;

  @Prop({ type: String, trim: true })
  phoneNumber?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  lastError?: string;

  @Prop({ type: Date })
  connectedAt?: Date;
}

export const EasyBotAccountSchema =
  SchemaFactory.createForClass(EasyBotAccount);
