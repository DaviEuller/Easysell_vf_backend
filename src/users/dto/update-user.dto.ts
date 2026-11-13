import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  company?: string;

  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  companyId?: string;
}
