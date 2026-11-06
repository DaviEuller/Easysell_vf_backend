import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfirmInvoiceImportItemDto } from './confirm-invoice-import.dto.js';

export class CreateManualInvoiceImportDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  customerName: string;

  @ApiPropertyOptional({ example: '+5511999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @ApiProperty({ type: [ConfirmInvoiceImportItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ConfirmInvoiceImportItemDto)
  items: ConfirmInvoiceImportItemDto[];
}
