import {
  IsNotEmpty,
  IsNumber,
  IsString,
  isString
} from 'class-validator';

export class CreateClienteDto {
    @IsString()
    @IsNotEmpty()
        name: string;

    @IsNotEmpty()
        Numero: string;

    @IsString()
        IdProduto: string;

    @IsString()
        idcompany: string;

    @IsNumber()
        Preco_gasto: Number;

    @IsNumber()
        Quantidade: Number;

}
