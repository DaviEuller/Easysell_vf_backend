import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message: 'CPF inválido. Deve conter 11 dígitos.',
  })
  cpf: string;

  @IsMongoId()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  funcao: string;
}
