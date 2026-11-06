import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProdutoDocument = Produto & Document;

@Schema({ _id: false })
export class MercadoLivreProductAttribute {
  @Prop({ required: true })
  id: string;

  @Prop({ type: String })
  valueName?: string;

  @Prop({ type: String })
  valueId?: string;
}

export const MercadoLivreProductAttributeSchema = SchemaFactory.createForClass(
  MercadoLivreProductAttribute,
);

@Schema({ _id: false })
export class MercadoLivreProductListing {
  @Prop({ type: String, trim: true })
  categoryId?: string;

  @Prop({ type: String, enum: ['new', 'used', 'not_specified'] })
  condition?: 'new' | 'used' | 'not_specified';

  @Prop({ type: String, trim: true })
  listingTypeId?: string;

  @Prop({ type: [String] })
  pictures?: string[];

  @Prop({ type: String, trim: true })
  shippingMode?: string;

  @Prop({ type: Boolean })
  freeShipping?: boolean;

  @Prop({ type: Boolean })
  localPickup?: boolean;

  @Prop({ type: [MercadoLivreProductAttributeSchema] })
  attributes?: MercadoLivreProductAttribute[];

  @Prop({
    type: String,
    enum: ['pending', 'publishing', 'published', 'error'],
    default: 'pending',
  })
  publicationStatus?: 'pending' | 'publishing' | 'published' | 'error';

  @Prop({ type: String })
  itemId?: string;

  @Prop({ type: String })
  permalink?: string;

  @Prop({ type: String, maxlength: 500 })
  publicationError?: string;

  @Prop({ type: Date })
  publishedAt?: Date;
}

export const MercadoLivreProductListingSchema = SchemaFactory.createForClass(
  MercadoLivreProductListing,
);

@Schema({ timestamps: true })
export class Produto {
  @Prop({
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    required: true,
    trim: true,
  })
  categoria: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    required: true,
    min: 0,
  })
  quantidade: number;

  @Prop({
    required: true,
    min: 0,
  })
  preco: number;

  @Prop({ type: MercadoLivreProductListingSchema })
  mercadoLivreListing?: MercadoLivreProductListing;
}

export const ProdutoSchema = SchemaFactory.createForClass(Produto);
