import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MercadoLivrePurchaseDocument =
  HydratedDocument<MercadoLivrePurchase>;

@Schema({ _id: false })
export class MercadoLivreFiscalDocument {
  @Prop({ required: true })
  documentId: string;

  @Prop({ type: String })
  fileName?: string;

  @Prop({ type: String })
  fileType?: string;

  @Prop({ type: Date })
  date?: Date;
}

export const MercadoLivreFiscalDocumentSchema = SchemaFactory.createForClass(
  MercadoLivreFiscalDocument,
);

@Schema({ _id: false })
export class MercadoLivrePurchaseItem {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String })
  itemId?: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

export const MercadoLivrePurchaseItemSchema = SchemaFactory.createForClass(
  MercadoLivrePurchaseItem,
);

@Schema({ timestamps: true })
export class MercadoLivrePurchase {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  externalOrderId: string;

  @Prop({ type: String })
  externalPackId?: string;

  @Prop({ required: true })
  status: string;

  @Prop({ type: String })
  statusDetail?: string;

  @Prop({ type: String })
  sellerNickname?: string;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ type: Date, required: true })
  orderedAt: Date;

  @Prop({ type: [MercadoLivrePurchaseItemSchema], default: [] })
  items: MercadoLivrePurchaseItem[];

  @Prop({
    type: String,
    enum: ['available', 'not_available', 'unavailable'],
    default: 'not_available',
  })
  fiscalDocumentsStatus: 'available' | 'not_available' | 'unavailable';

  @Prop({ type: [MercadoLivreFiscalDocumentSchema], default: [] })
  fiscalDocuments: MercadoLivreFiscalDocument[];

  @Prop({ type: Date, required: true })
  lastSyncedAt: Date;
}

export const MercadoLivrePurchaseSchema =
  SchemaFactory.createForClass(MercadoLivrePurchase);
MercadoLivrePurchaseSchema.index(
  { companyId: 1, externalOrderId: 1 },
  { unique: true },
);
MercadoLivrePurchaseSchema.index({ companyId: 1, orderedAt: -1 });
