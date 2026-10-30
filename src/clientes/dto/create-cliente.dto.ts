import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '+5511999999999' })
  Numero: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  IdProduto: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  idcompany: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ApiProperty({ example: 159.9, minimum: 0 })
  Preco_gasto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 2, minimum: 1 })
  Quantidade: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 3, minimum: 1 })
  parcelas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ApiPropertyOptional({ example: 50, minimum: 0 })
  valorPago?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-11-15', format: 'date' })
  dataPrimeiroVencimento?: string;
}
