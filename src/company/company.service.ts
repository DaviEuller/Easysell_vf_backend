import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Company, CompanyDocument } from './schemas/company.schema.js';
import { Employee, EmployeeDocument } from './schemas/employee.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

function isDuplicateCnpjError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  if (error.code !== 11000) return false;

  if ('keyPattern' in error && typeof error.keyPattern === 'object') {
    return (
      error.keyPattern !== null &&
      'cnpj' in error.keyPattern
    );
  }

  return 'message' in error &&
    typeof error.message === 'string' &&
    /index:\s*cnpj_1\b/.test(error.message);
}

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<CompanyDocument> {
    const responsible = await this.userModel
      .findById(createCompanyDto.responsavelId)
      .exec();
    if (!responsible) {
      throw new NotFoundException(
        `Usuário responsável com id ${createCompanyDto.responsavelId} não encontrado`,
      );
    }

    const company = new this.companyModel(createCompanyDto);
    let savedCompany: CompanyDocument;
    try {
      savedCompany = await company.save();
    } catch (error) {
      if (isDuplicateCnpjError(error)) {
        throw new ConflictException('Este CNPJ já está cadastrado.');
      }
      throw error;
    }

    try {
      const updatedResponsible = await this.userModel
        .findByIdAndUpdate(
          createCompanyDto.responsavelId,
          {
            $set: {
              company: savedCompany._id,
              role: UserRole.ADMINISTRADOR,
            },
          },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();

      if (!updatedResponsible) {
        throw new NotFoundException(
          'O usuário responsável não está mais disponível',
        );
      }
      return savedCompany;
    } catch (error) {
      await this.companyModel.findByIdAndDelete(savedCompany._id).exec();
      throw error;
    }
  }

  async addEmployeeToCompany(
    companyId: string,
    employeeId: string,
  ): Promise<CompanyDocument> {
    const company = await this.companyModel
      .findByIdAndUpdate(
        companyId,
        { $addToSet: { employeeIds: employeeId } },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();

    if (!company) {
      throw new NotFoundException(`Empresa com id ${companyId} não encontrada`);
    }

    return company;
  }

  async findEmployeesByCompanyId(
    companyId: string,
  ): Promise<EmployeeDocument[]> {
    return this.employeeModel.find({ companyId }).exec();
  }

  async findEmployeesByName(name: string): Promise<EmployeeDocument[]> {
    const normalizedName = name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Informe o nome do funcionário');
    }

    const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.employeeModel
      .find({ name: { $regex: escapedName, $options: 'i' } })
      .exec();
  }

  async findAll(): Promise<CompanyDocument[]> {
    return this.companyModel.find().exec();
  }

  async findOne(id: string): Promise<CompanyDocument> {
    const company = await this.companyModel.findById(id).exec();
    if (!company) {
      throw new NotFoundException(`Empresa com id ${id} não encontrada`);
    }
    return company;
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<CompanyDocument> {
    const company = await this.companyModel
      .findByIdAndUpdate(id, updateCompanyDto, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!company) {
      throw new NotFoundException(`Empresa com id ${id} não encontrada`);
    }
    return company;
  }

  async remove(id: string): Promise<CompanyDocument> {
    const company = await this.companyModel.findByIdAndDelete(id).exec();
    if (!company) {
      throw new NotFoundException(`Empresa com id ${id} não encontrada`);
    }
    return company;
  }
}
