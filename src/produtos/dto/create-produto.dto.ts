import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsNumber
} from 'class-validator';

export class CreateProdutoDto {
    
    @IsString()
    @IsNotEmpty()
      name: string;

    @IsString()
    @IsNotEmpty()
      categoria: string;

    @IsString()
    @IsNotEmpty()
      companyId: string;

    @IsNumber()
      quantidade: Number; 

    @IsNumber()
      preco: Number; 

    


    

}
