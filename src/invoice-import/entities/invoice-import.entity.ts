import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InvoiceImportDocument = HydratedDocument<InvoiceImport>;

@Schema({ _id: false })
export class InvoiceImportItem {
  @Prop({ type: String })
  sku?: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Number, min: 0 })
  quantity?: number;

  @Prop({ type: Number, min: 0 })
  unitPrice?: number;

  @Prop({ type: Number, min: 0 })
  total?: number;

  @Prop({ type: String })
  suggestedProductId?: string;

  @Prop({ type: Number, min: 0, max: 1 })
  aiConfidence?: number;

  @Prop({ type: String, maxlength: 500 })
  aiQuestion?: string;
}

export const InvoiceImportItemSchema =
  SchemaFactory.createForClass(InvoiceImportItem);

@Schema({ timestamps: true })
export class InvoiceImport {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fileName: string;

  @Prop({ required: true, enum: ['xml', 'pdf', 'image', 'manual'] })
  fileType: 'xml' | 'pdf' | 'image' | 'manual';

  @Prop({ type: String, enum: ['xml', 'ocr', 'manual'], required: true })
  extractionMethod: 'xml' | 'ocr' | 'manual';

  @Prop({ type: String, trim: true })
  invoiceNumber?: string;

  @Prop({ type: String, enum: ['outgoing', 'incoming'] })
  invoiceDirection?: 'outgoing' | 'incoming';

  @Prop({ type: String, trim: true })
  series?: string;

  @Prop({ type: String, trim: true })
  accessKey?: string;

  @Prop({ type: Date })
  issueDate?: Date;

  @Prop({ type: String, trim: true })
  customerName?: string;

  @Prop({ type: String, trim: true })
  customerTaxId?: string;

  @Prop({ type: String, trim: true })
  customerPhone?: string;

  @Prop({ type: Number, min: 0 })
  totalAmount?: number;

  @Prop({ type: [InvoiceImportItemSchema], default: [] })
  items: InvoiceImportItem[];

  @Prop({ type: String, maxlength: 1000 })
  aiClarificationQuestion?: string;

  @Prop({ type: Boolean, default: false })
  aiNeedsClarification: boolean;

  @Prop({ type: String, maxlength: 20000 })
  ocrText?: string;

  @Prop({
    type: String,
    enum: ['pending_review', 'imported', 'rejected'],
    default: 'pending_review',
    index: true,
  })
  status: 'pending_review' | 'imported' | 'rejected';

  @Prop({ type: [String], default: [] })
  createdSaleIds: string[];
}

export const InvoiceImportSchema = SchemaFactory.createForClass(InvoiceImport);
InvoiceImportSchema.index(
  { companyId: 1, accessKey: 1 },
  { unique: true, partialFilterExpression: { accessKey: { $type: 'string' } } },
);
