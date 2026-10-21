import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AiConversationDocument = HydratedDocument<AiConversation>;

export type AiConversationMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  timestamp?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
  name?: string;
};

export type PendingAiAction = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing';
  createdAt: Date;
};

@Schema({ timestamps: true })
export class AiConversation {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  title: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  messages: AiConversationMessage[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  pendingAction: PendingAiAction | null;

  createdAt: Date;

  updatedAt: Date;
}

export const AiConversationSchema =
  SchemaFactory.createForClass(AiConversation);
AiConversationSchema.index({ userId: 1, companyId: 1, updatedAt: -1 });
