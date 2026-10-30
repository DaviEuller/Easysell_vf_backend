import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { Company, CompanySchema } from './schemas/company.schema.js';
import { Employee, EmployeeSchema } from './schemas/employee.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { Equipe, EquipeSchema } from '../equipe/entities/equipe.entity.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Company.name,
        schema: CompanySchema,
      },
      {
        name: Employee.name,
        schema: EmployeeSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Equipe.name,
        schema: EquipeSchema,
      },
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
