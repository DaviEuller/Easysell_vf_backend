import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEasyBotMessageDto {
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  @IsMongoId()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  @ApiProperty({ example: 'Olá! Como posso ajudar?', maxLength: 4096 })
  message: string;
}
