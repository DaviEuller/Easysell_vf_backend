import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { FaturaStatus } from '../schemas/fatura.schema.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetFaturaStatusDto {
  @ApiProperty({ enum: ['pendente', 'paga'], example: 'paga' })
  @IsIn(['pendente', 'paga'])
  status: FaturaStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  installmentNumber?: number;
}
