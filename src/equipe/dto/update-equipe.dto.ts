import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEquipeDto } from './create-equipe.dto.js';

export class UpdateEquipeDto extends PartialType(
  OmitType(CreateEquipeDto, ['companyId'] as const),
) {}
