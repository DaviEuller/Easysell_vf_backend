import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { Company, CompanySchema } from './schemas/company.schema.js';
import { Employee, EmployeeSchema } from './schemas/employee.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';

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
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
