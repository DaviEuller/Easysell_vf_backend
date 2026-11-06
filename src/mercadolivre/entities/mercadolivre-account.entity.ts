import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MercadoLivreAccountDocument = HydratedDocument<MercadoLivreAccount>;

@Schema({ timestamps: true })
export class MercadoLivreAccount {
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
    enum: ['disconnected', 'connected'],
    default: 'disconnected',
  })
  status: 'disconnected' | 'connected';

  @Prop({ type: String })
  mercadoLivreUserId?: string;

  @Prop({ type: String })
  nickname?: string;

  @Prop({ type: String, select: false })
  encryptedAccessToken?: string;

  @Prop({ type: String, select: false })
  encryptedRefreshToken?: string;

  @Prop({ type: Date })
  tokenExpiresAt?: Date;

  @Prop({ type: String, select: false })
  oauthStateHash?: string;

  @Prop({ type: Date, select: false })
  oauthStateExpiresAt?: Date;

  @Prop({ type: Date })
  lastSyncAt?: Date;

  @Prop({ type: String, maxlength: 500 })
  lastSyncError?: string;
}

export const MercadoLivreAccountSchema =
  SchemaFactory.createForClass(MercadoLivreAccount);
