import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Pedro Santos' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  userId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message: 'CPF inválido. Deve conter 11 dígitos.',
  })
  @ApiProperty({ example: '12345678901', minLength: 11, maxLength: 11 })
  cpf: string;

  @IsMongoId()
  @IsNotEmpty()
  @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Estoquista' })
  funcao: string;
}
