import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquipeService } from './equipe.service.js';
import { EquipeController } from './equipe.controller.js';
import { Company, CompanySchema } from '../company/schemas/company.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { Equipe, EquipeSchema } from './entities/equipe.entity.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Equipe.name, schema: EquipeSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [EquipeController],
  providers: [EquipeService],
})
export class EquipeModule {}
