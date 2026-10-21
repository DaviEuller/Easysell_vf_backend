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

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  Numero: string;

  @IsString()
  @IsNotEmpty()
  IdProduto: string;

  @IsString()
  @IsNotEmpty()
  idcompany: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  Preco_gasto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  Quantidade: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parcelas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorPago?: number;

  @IsOptional()
  @IsDateString()
  dataPrimeiroVencimento?: string;
}
