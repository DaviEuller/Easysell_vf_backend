import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EasyBotMessageDocument = HydratedDocument<EasyBotMessage>;

@Schema({ timestamps: true })
export class EasyBotMessage {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EasyBotContact',
    required: true,
    index: true,
  })
  contactId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ type: String, enum: ['incoming', 'outgoing'], required: true })
  direction: 'incoming' | 'outgoing';

  @Prop({ required: true, maxlength: 4096 })
  content: string;

  @Prop({
    type: String,
    enum: ['received', 'sending', 'sent', 'failed'],
    required: true,
  })
  status: 'received' | 'sending' | 'sent' | 'failed';

  @Prop({ type: String, maxlength: 500 })
  error?: string;
}

export const EasyBotMessageSchema =
  SchemaFactory.createForClass(EasyBotMessage);
EasyBotMessageSchema.index({ companyId: 1, contactId: 1, createdAt: -1 });
