import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { UserRole } from '../enum/user.role.enum.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ example: 'maria@exemplo.com' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @ApiProperty({ example: 'senha123', minLength: 6 })
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  @ApiPropertyOptional({ enum: UserRole })
  role?: UserRole;

  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  company?: string;

  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ example: '665f1a2b3c4d5e6f7a8b9c0d' })
  employee?: string;
}
