import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEasyBotContactDto {
  @ApiProperty({ example: 'Maria Silva', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '5511999999999', maxLength: 30 })
  phone: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true, default: false })
  autoReplyEnabled?: boolean;
}
