import { Transform, Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProdutoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value, obj }) => value ?? obj.category ?? obj.categoria)
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsMongoId()
  @IsNotEmpty()
  companyId: string;

  @Transform(({ value, obj }) => value ?? obj.stock ?? obj.quantidade)
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  quantidade: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stock?: number;

  @Transform(({ value, obj }) => value ?? obj.price ?? obj.preco)
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  preco: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;
}
