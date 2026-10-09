  import {
    IsNotEmpty,
    IsMongoId,
    IsString,
    Matches,
  } from 'class-validator';

  export class CreateCompanyDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    categoria: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{14}$/, {
      message: 'CNPJ inválido. Deve conter 14 dígitos.',
    })
    cnpj: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{11}$/, {
      message: 'CPF do responsável inválido. Deve conter 11 dígitos.',
    })
    cpfResponsavel: string;

    @IsMongoId()
    @IsNotEmpty()
    responsavelId: string;
  }
