import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEquipeTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
