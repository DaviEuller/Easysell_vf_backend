import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFaturaDto {
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  @IsMongoId()
  @IsNotEmpty()
  saleId: string;

  @ApiPropertyOptional({ example: '2026-11-15', format: 'date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
