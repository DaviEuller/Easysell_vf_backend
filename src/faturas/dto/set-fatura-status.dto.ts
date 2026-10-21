import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { FaturaStatus } from '../schemas/fatura.schema.js';

export class SetFaturaStatusDto {
  @IsIn(['pendente', 'paga'])
  status: FaturaStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installmentNumber?: number;
}
