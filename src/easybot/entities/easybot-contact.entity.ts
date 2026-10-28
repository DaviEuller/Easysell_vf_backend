import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EasyBotContactDocument = HydratedDocument<EasyBotContact>;

@Schema({ timestamps: true })
export class EasyBotContact {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ type: Boolean, default: true })
  autoReplyEnabled: boolean;
}

export const EasyBotContactSchema =
  SchemaFactory.createForClass(EasyBotContact);
EasyBotContactSchema.index({ companyId: 1, phone: 1 }, { unique: true });
