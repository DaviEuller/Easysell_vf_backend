import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEquipeTaskDto {
  @ApiProperty({ example: 'Enviar relatório semanal', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text: string;

  @IsDateString()
  @IsNotEmpty()
  @ApiProperty({ example: '2026-11-15T15:00:00.000Z', format: 'date-time' })
  dueDate: string;
}
