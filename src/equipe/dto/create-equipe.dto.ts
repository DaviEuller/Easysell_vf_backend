import {
  IsDateString,
  IsEmail,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEquipeDto {
  @ApiProperty({ example: 'Ana Souza' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  @ApiProperty({ example: 30, minimum: 0 })
  age: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Vendedora' })
  funcao: string;

  @IsMongoId()
  @IsNotEmpty()
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  companyId: string;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({ example: '2025-02-01', format: 'date' })
  dataEntrada: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '+5511999999999' })
  telefone: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'ana@exemplo.com' })
  userEmail?: string;
}
