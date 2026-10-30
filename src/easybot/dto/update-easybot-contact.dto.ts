import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEasyBotContactDto {
  @ApiPropertyOptional({ example: 'Maria Silva', maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiPropertyOptional({ example: '5511999999999', maxLength: 30 })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  autoReplyEnabled?: boolean;
}
