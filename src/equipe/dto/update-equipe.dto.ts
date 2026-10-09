import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEquipeDto } from './create-equipe.dto.js';

export class UpdateEquipeDto extends PartialType(
  OmitType(CreateEquipeDto, ['companyId'] as const),
) {}
