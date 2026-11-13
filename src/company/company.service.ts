import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Company, CompanyDocument } from './schemas/company.schema.js';
import { Employee, EmployeeDocument } from './schemas/employee.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';
import { Equipe, EquipeDocument } from '../equipe/entities/equipe.entity.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { BootstrapCompanyDto } from './dto/bootstrap-company.dto.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

function isDuplicateCnpjError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  if (error.code !== 11000) return false;

  if ('keyPattern' in error && typeof error.keyPattern === 'object') {
    return error.keyPattern !== null && 'cnpj' in error.keyPattern;
  }

  return (
    'message' in error &&
    typeof error.message === 'string' &&
    /index:\s*cnpj_1\b/.test(error.message)
  );
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
    @InjectModel(Equipe.name)
    private readonly equipeModel: Model<EquipeDocument>,
  ) {}

  async getMyCompanySummary(userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('Usuário da sessão inválido.');
    }

    const user = await this.userModel
      .findById(userId)
      .select('name email role company equipeMember')
      .exec();
    const companyId = user?.company?.toString();
    if (!user || !companyId) {
      throw new UnauthorizedException('Usuário não associado a uma empresa.');
    }

    const company = await this.companyModel
      .findById(companyId)
      .select('name categoria')
      .exec();
    if (!company) {
      throw new NotFoundException('Empresa associada não encontrada.');
    }

    const equipeMember = user.equipeMember
      ? await this.equipeModel
          .findOne({ _id: user.equipeMember, companyId })
          .select('funcao')
          .exec()
      : await this.equipeModel
          .findOne({ userId, companyId })
          .select('funcao')
          .exec();
    const employee = equipeMember
      ? null
      : await this.employeeModel
          .findOne({ userId, companyId })
          .select('funcao')
          .exec();

    return {
      empresa: { nome: company.name, categoria: company.categoria },
      usuario: {
        nome: user.name,
        email: user.email,
        role: user.role,
        cargo:
          equipeMember?.funcao ??
          employee?.funcao ??
          (user.role === UserRole.ADMINISTRADOR ? 'Administrador' : user.role),
      },
    };
  }

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

  async bootstrap(
    userId: string,
    bootstrapCompanyDto: BootstrapCompanyDto,
  ): Promise<CompanyDocument> {
    const user = await this.userModel.findById(userId).select('company').exec();
    if (!user) {
      throw new NotFoundException(`Usuário com id ${userId} não encontrado`);
    }
    if (user.company) {
      const company = await this.companyModel
        .findById(user.company)
        .exec();
      if (company) return company;
    }
    return this.create({
      name: bootstrapCompanyDto.name,
      categoria: bootstrapCompanyDto.categoria,
      cnpj: bootstrapCompanyDto.cnpj,
      cpfResponsavel: bootstrapCompanyDto.cpfResponsavel,
      responsavelId: userId,
    });
  }

  async createEmployee(
    createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeDocument> {
    const company = await this.companyModel
      .findById(createEmployeeDto.companyId)
      .exec();
    if (!company) {
      throw new NotFoundException(
        `Empresa com id ${createEmployeeDto.companyId} não encontrada`,
      );
    }

    const employee = await new this.employeeModel(createEmployeeDto).save();
    try {
      const updatedCompany = await this.companyModel
        .findByIdAndUpdate(
          createEmployeeDto.companyId,
          { $addToSet: { employeeIds: employee._id } },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
      if (!updatedCompany) {
        throw new NotFoundException(
          `Empresa com id ${createEmployeeDto.companyId} não encontrada`,
        );
      }
    } catch (error) {
      await this.employeeModel.findByIdAndDelete(employee._id).exec();
      throw error;
    }
    return employee;
  }

  async updateEmployee(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeModel
      .findByIdAndUpdate(id, updateEmployeeDto, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!employee) {
      throw new NotFoundException(`Funcionário com id ${id} não encontrado`);
    }
    return employee;
  }

  async removeEmployee(id: string): Promise<EmployeeDocument> {
    const employee = await this.employeeModel.findByIdAndDelete(id).exec();
    if (!employee) {
      throw new NotFoundException(`Funcionário com id ${id} não encontrado`);
    }
    await this.companyModel
      .findByIdAndUpdate(employee.companyId, {
        $pull: { employeeIds: employee._id },
      })
      .exec();
    return employee;
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
