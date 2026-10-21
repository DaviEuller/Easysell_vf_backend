import { IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatAiDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsMongoId()
  conversationId?: string;
}
