import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Company } from './schemas/company.schema.js';
import { Employee } from './schemas/employee.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';
import { CompanyService } from './company.service.js';

describe('CompanyService', () => {
  let service: CompanyService;
  const saveCompany = vi.fn();
  const findUserById = vi.fn();
  const updateUserById = vi.fn();
  const deleteCompanyById = vi.fn();

  class MockCompanyModel {
    constructor(_data: unknown) {}

    save() {
      return saveCompany();
    }

    static findByIdAndDelete = deleteCompanyById;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: getModelToken(Company.name),
          useValue: MockCompanyModel,
        },
        {
          provide: getModelToken(Employee.name),
          useValue: {},
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: findUserById,
            findByIdAndUpdate: updateUserById,
          },
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createCompanyDto = {
    name: 'Empresa',
    categoria: 'Comércio',
    cnpj: '12345678000199',
    cpfResponsavel: '12345678901',
    responsavelId: '507f1f77bcf86cd799439011',
  };

  function mockExistingResponsible() {
    findUserById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: createCompanyDto.responsavelId }),
    });
  }

  function mockSavedCompany() {
    const savedCompany = { _id: '507f191e810c19729de860ea' };
    saveCompany.mockResolvedValue(savedCompany);
    updateUserById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: createCompanyDto.responsavelId }),
    });
    return savedCompany;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a conflict when the CNPJ already exists', async () => {
    mockExistingResponsible();
    saveCompany.mockRejectedValue(
      Object.assign(new Error('duplicate key'), {
        code: 11000,
        keyPattern: { cnpj: 1 },
      }),
    );

    await expect(
      service.create(createCompanyDto),
    ).rejects.toThrow(
      new ConflictException('Este CNPJ já está cadastrado.'),
    );
  });

  it('keeps propagating unrelated database errors', async () => {
    mockExistingResponsible();
    const databaseError = new Error('database unavailable');
    saveCompany.mockRejectedValue(databaseError);

    await expect(
      service.create(createCompanyDto),
    ).rejects.toBe(databaseError);
  });

  it('sets the responsible user as administrator and links the company', async () => {
    mockExistingResponsible();
    const savedCompany = mockSavedCompany();

    await expect(service.create(createCompanyDto)).resolves.toBe(savedCompany);
    expect(updateUserById).toHaveBeenCalledWith(
      createCompanyDto.responsavelId,
      {
        $set: {
          company: savedCompany._id,
          role: UserRole.ADMINISTRADOR,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('does not create a company if the responsible account does not exist', async () => {
    findUserById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    await expect(service.create(createCompanyDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(saveCompany).not.toHaveBeenCalled();
  });

  it('removes the new company if assigning it to the responsible fails', async () => {
    mockExistingResponsible();
    const savedCompany = mockSavedCompany();
    updateUserById.mockReturnValue({
      exec: vi.fn().mockRejectedValue(new Error('user update failed')),
    });
    deleteCompanyById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(savedCompany),
    });

    await expect(service.create(createCompanyDto)).rejects.toThrow(
      'user update failed',
    );
    expect(deleteCompanyById).toHaveBeenCalledWith(savedCompany._id);
  });
});
