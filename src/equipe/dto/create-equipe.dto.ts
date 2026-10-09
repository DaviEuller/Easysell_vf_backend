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

export class CreateEquipeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  age: number;

  @IsString()
  @IsNotEmpty()
  funcao: string;

  @IsMongoId()
  @IsNotEmpty()
  companyId: string;

  @IsDateString()
  @IsNotEmpty()
  dataEntrada: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;

  @IsOptional()
  @IsEmail()
  userEmail?: string;
}
