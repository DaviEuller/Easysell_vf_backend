import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { Company, CompanySchema } from './schemas/company.schema.js';
import { Employee, EmployeeSchema } from './schemas/employee.schema.js';

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
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
