import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateFaturaDto {
  @IsMongoId()
  @IsNotEmpty()
  saleId: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
