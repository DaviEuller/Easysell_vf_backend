import { Transform, Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProdutoDto {
  @ApiProperty({ example: 'Camiseta básica' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value, obj }) => value ?? obj.category ?? obj.categoria)
  @ApiProperty({ example: 'Vestuário' })
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsOptional()
  @ApiPropertyOptional({ example: 'Vestuário' })
  @IsString()
  category?: string;

  @IsMongoId()
  @IsNotEmpty()
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  companyId: string;

  @Transform(({ value, obj }) => value ?? obj.stock ?? obj.quantidade)
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 25, minimum: 0 })
  quantidade: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ example: 25, minimum: 0 })
  stock?: number;

  @Transform(({ value, obj }) => value ?? obj.price ?? obj.preco)
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 79.9, minimum: 0 })
  preco: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({ example: 79.9, minimum: 0 })
  price?: number;
}
