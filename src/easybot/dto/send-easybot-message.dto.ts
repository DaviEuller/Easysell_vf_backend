import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendEasyBotMessageDto {
  @IsMongoId()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  message: string;
}
