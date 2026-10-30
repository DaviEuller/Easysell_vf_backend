  import {
    IsNotEmpty,
    IsMongoId,
    IsString,
    Matches,
  } from 'class-validator';
  import { ApiProperty } from '@nestjs/swagger';

  export class CreateCompanyDto {
    @ApiProperty({ example: 'EasySell Comércio' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'Varejo' })
    categoria: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{14}$/, {
      message: 'CNPJ inválido. Deve conter 14 dígitos.',
    })
    @ApiProperty({ example: '12345678000190', minLength: 14, maxLength: 14 })
    cnpj: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{11}$/, {
      message: 'CPF do responsável inválido. Deve conter 11 dígitos.',
    })
    @ApiProperty({ example: '12345678901', minLength: 11, maxLength: 11 })
    cpfResponsavel: string;

    @IsMongoId()
    @IsNotEmpty()
    @ApiProperty({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
    responsavelId: string;
  }
