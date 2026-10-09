import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Company } from '../company/schemas/company.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { EquipeService } from './equipe.service.js';
import { Equipe } from './entities/equipe.entity.js';

describe('EquipeService', () => {
  let service: EquipeService;
  const findCompanyById = vi.fn();
  const findCompanyByResponsible = vi.fn();
  const createMember = vi.fn();
  const findMembers = vi.fn();
  const findMemberById = vi.fn();
  const updateMemberById = vi.fn();
  const updateOneMember = vi.fn();
  const deleteMemberById = vi.fn();
  const findEmployeeAccounts = vi.fn();
  const findUser = vi.fn();
  const findUserById = vi.fn();
  const updateUserById = vi.fn();

  beforeEach(async () => {
    findCompanyByResponsible.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipeService,
        {
          provide: getModelToken(Company.name),
          useValue: {
            findById: findCompanyById,
            findOne: findCompanyByResponsible,
          },
        },
        {
          provide: getModelToken(Equipe.name),
          useValue: {
            create: createMember,
            find: findMembers,
            findById: findMemberById,
            findOne: findMemberById,
            findByIdAndUpdate: updateMemberById,
            findOneAndUpdate: updateOneMember,
            findByIdAndDelete: deleteMemberById,
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            find: findEmployeeAccounts,
            findOne: findUser,
            findById: findUserById,
            findByIdAndUpdate: updateUserById,
          },
        },
        {
          provide: getConnectionToken(),
          useValue: { db: {} },
        },
      ],
    }).compile();

    service = module.get<EquipeService>(EquipeService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const companyId = '507f191e810c19729de860ea';
  const authenticatedUserId = '507f1f77bcf86cd799439011';

  function mockCompany() {
    const company = {
      _id: companyId,
      responsavelId: { toString: () => authenticatedUserId },
    };
    findCompanyById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(company),
    });
    return company;
  }

  function mockMember() {
    const member = {
      _id: '507f1f77bcf86cd799439013',
      companyId: { toString: () => companyId },
    };
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(member),
    });
    mockCompany();
    return member;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('persists a member under the company responsible for the request', async () => {
    const company = mockCompany();
    const equipe: CreateEquipeDto = {
      name: 'João Silva',
      age: 30,
      funcao: 'Vendedor',
      companyId,
      dataEntrada: '2026-10-09',
      telefone: '+5511999999999',
    };
    const createdMember = {
      name: equipe.name,
      age: equipe.age,
      funcao: equipe.funcao,
      companyId,
      dataEntrada: equipe.dataEntrada,
      telefone: equipe.telefone,
      _id: '507f1f77bcf86cd799439013',
    };
    createMember.mockResolvedValue(createdMember);

    await expect(
      service.create(equipe, authenticatedUserId),
    ).resolves.toBe(createdMember);

    expect(createMember).toHaveBeenCalledWith({
      name: equipe.name,
      age: equipe.age,
      funcao: equipe.funcao,
      companyId: company._id,
      dataEntrada: new Date(equipe.dataEntrada),
      telefone: equipe.telefone,
      adminId: company.responsavelId,
    });
  });

  it('rejects users who are not responsible for the company', async () => {
    findCompanyById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        responsavelId: { toString: () => '507f1f77bcf86cd799439011' },
      }),
    });

    const equipe: CreateEquipeDto = {
      name: 'João Silva',
      age: 30,
      funcao: 'Vendedor',
      companyId,
      dataEntrada: '2026-10-09',
      telefone: '+5511999999999',
    };

    await expect(
      service.create(equipe, '507f1f77bcf86cd799439012'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createMember).not.toHaveBeenCalled();
  });

  it('throws when the company does not exist', async () => {
    findCompanyById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    const equipe: CreateEquipeDto = {
      name: 'João Silva',
      age: 30,
      funcao: 'Vendedor',
      companyId,
      dataEntrada: '2026-10-09',
      telefone: '+5511999999999',
    };

    await expect(
      service.create(equipe, authenticatedUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(createMember).not.toHaveBeenCalled();
  });

  it('returns only members for the requested company', async () => {
    mockCompany();
    const members = [{ name: 'João Silva' }];
    const sort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(members) });
    findMembers.mockReturnValue({ sort });

    await expect(
      service.findAll(companyId, authenticatedUserId),
    ).resolves.toBe(members);
    expect(findMembers).toHaveBeenCalledWith({ companyId });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('gets company members linked to employee-role accounts', async () => {
    const company = mockCompany();
    const accountId = '507f1f77bcf86cd799439015';
    const employeeAccount = {
      _id: { toString: () => accountId },
      email: 'funcionario@example.com',
    };
    const accountsQuery = {
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([employeeAccount]),
      }),
    };
    findEmployeeAccounts.mockReturnValue(accountsQuery);

    const member = {
      userId: { toString: () => accountId },
      toObject: () => ({ name: 'João Silva' }),
    };
    const sort = vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([member]),
    });
    findMembers.mockReturnValue({ sort });

    await expect(
      service.findEmployees(companyId, authenticatedUserId),
    ).resolves.toEqual([
      { name: 'João Silva', userEmail: 'funcionario@example.com' },
    ]);
    expect(findEmployeeAccounts).toHaveBeenCalledWith({
      company: company._id,
      role: UserRole.FUNCIONARIO,
    });
    expect(accountsQuery.select).toHaveBeenCalledWith('_id email');
    expect(findMembers).toHaveBeenCalledWith({
      companyId: company._id,
      userId: { $in: [employeeAccount._id] },
    });
  });

  it('returns an empty list when the company has no employee accounts', async () => {
    mockCompany();
    findEmployeeAccounts.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(
      service.findEmployees(companyId, authenticatedUserId),
    ).resolves.toEqual([]);
    expect(findMembers).not.toHaveBeenCalled();
  });

  it('links a member to an existing attendant account', async () => {
    const company = mockCompany();
    const user = {
      _id: '507f1f77bcf86cd799439015',
      email: 'funcionario@example.com',
      role: UserRole.ATENDENTE,
      company: { toString: () => companyId },
    };
    findUser.mockReturnValue({ exec: vi.fn().mockResolvedValue(user) });
    const member = { _id: '507f1f77bcf86cd799439013' };
    createMember.mockResolvedValue(member);
    updateUserById.mockReturnValue({ exec: vi.fn().mockResolvedValue(user) });

    await expect(
      service.create(
        {
          name: 'João Silva',
          age: 30,
          funcao: 'Vendedor',
          companyId,
          dataEntrada: '2026-10-09',
          telefone: '+5511999999999',
          userEmail: 'FUNCIONARIO@example.com',
        },
        authenticatedUserId,
      ),
    ).resolves.toBe(member);

    expect(findUser).toHaveBeenCalledWith({
      email: 'funcionario@example.com',
    });
    expect(updateUserById).toHaveBeenCalledWith(
      user._id,
      {
        $set: {
          equipeMember: member._id,
          company: company._id,
          role: UserRole.FUNCIONARIO,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
    expect(company._id).toBe(companyId);
  });

  it('changes a non-owner account to the employee role when linking it', async () => {
    const company = mockCompany();
    const user = {
      _id: '507f1f77bcf86cd799439015',
      email: 'funcionario@example.com',
      role: UserRole.ADMINISTRADOR,
      company: undefined,
    };
    findUser.mockReturnValue({ exec: vi.fn().mockResolvedValue(user) });
    const member = { _id: '507f1f77bcf86cd799439013' };
    createMember.mockResolvedValue(member);
    updateUserById.mockReturnValue({ exec: vi.fn().mockResolvedValue(user) });

    await service.create(
      {
        name: 'João Silva',
        age: 30,
        funcao: 'Vendedor',
        companyId,
        dataEntrada: '2026-10-09',
        telefone: '+5511999999999',
        userEmail: user.email,
      },
      authenticatedUserId,
    );

    expect(findCompanyByResponsible).toHaveBeenCalledWith({
      responsavelId: user._id,
    });
    expect(updateUserById).toHaveBeenCalledWith(
      user._id,
      {
        $set: {
          equipeMember: member._id,
          company: company._id,
          role: UserRole.FUNCIONARIO,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('does not change the role of an account that owns a company', async () => {
    const company = mockCompany();
    const user = {
      _id: authenticatedUserId,
      email: 'responsavel@example.com',
      role: UserRole.ADMINISTRADOR,
      company: { toString: () => companyId },
    };
    findUser.mockReturnValue({ exec: vi.fn().mockResolvedValue(user) });
    findCompanyByResponsible.mockReturnValue({
      exec: vi.fn().mockResolvedValue(company),
    });

    await expect(
      service.create(
        {
          name: 'Outro perfil',
          age: 30,
          funcao: 'Vendedor',
          companyId,
          dataEntrada: '2026-10-09',
          telefone: '+5511999999999',
          userEmail: user.email,
        },
        authenticatedUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createMember).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('adds a task to a member after checking company ownership', async () => {
    const member = mockMember();
    const memberWithUser = Object.assign(member, {
      userId: { toString: () => '507f1f77bcf86cd799439015' },
    });
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(memberWithUser),
    });
    const updatedMember = { ...member, tasks: [{ text: 'Revisar estoque' }] };
    updateMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(updatedMember),
    });

    await expect(
      service.addTask(
        member._id,
        { text: ' Revisar estoque ', dueDate: '2026-10-30' },
        authenticatedUserId,
      ),
    ).resolves.toBe(updatedMember);
    expect(updateMemberById).toHaveBeenCalledWith(
      member._id,
      {
        $push: {
          tasks: {
            text: 'Revisar estoque',
            dueDate: new Date('2026-10-30'),
          },
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('requires a linked employee account before assigning a task', async () => {
    const member = mockMember();

    await expect(
      service.addTask(
        member._id,
        { text: 'Revisar estoque', dueDate: '2026-10-30' },
        authenticatedUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMemberById).not.toHaveBeenCalled();
  });

  it('does not allow member updates to set task completion', async () => {
    const member = mockMember();
    const updatedMember = { ...member, tasks: [] };
    updateMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(updatedMember),
    });
    const maliciousDto = Object.assign(new UpdateEquipeDto(), {
      tasks: [{ text: 'Tarefa', completed: true }],
    });

    await expect(
      service.update(member._id, maliciousDto, authenticatedUserId),
    ).resolves.toBe(updatedMember);
    expect(updateMemberById).toHaveBeenCalledWith(
      member._id,
      {},
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('removes a task only after checking company ownership', async () => {
    const member = mockMember();
    const taskId = '507f1f77bcf86cd799439014';
    const updatedMember = { ...member, tasks: [{ _id: taskId }] };
    const employee = {
      ...member,
      tasks: [
        {
          _id: { toString: () => taskId },
          attachmentId: undefined,
        },
      ],
    };
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(employee),
    });
    updateOneMember.mockReturnValue({
      exec: vi.fn().mockResolvedValue(updatedMember),
    });

    await expect(
      service.removeTask(member._id, taskId, authenticatedUserId),
    ).resolves.toBe(updatedMember);
    expect(updateOneMember).toHaveBeenCalledWith(
      { _id: member._id, 'tasks._id': taskId },
      { $pull: { tasks: { _id: taskId } } },
      { returnDocument: 'after' },
    );
  });

  it('does not allow the manager to submit an employee task file', async () => {
    const member = {
      ...mockMember(),
      userId: { toString: () => '507f1f77bcf86cd799439016' },
      tasks: [
        {
          _id: { toString: () => '507f1f77bcf86cd799439014' },
          completed: false,
        },
      ],
    };
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(member),
    });

    await expect(
      service.submitTaskAttachment(
        member._id,
        '507f1f77bcf86cd799439014',
        authenticatedUserId,
        {
          buffer: Buffer.from('%PDF-1.7'),
          originalname: 'prova.pdf',
          mimetype: 'application/pdf',
          size: 8,
        },
        'Concluí a separação dos pedidos.',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not let an unlinked employee see team tasks', async () => {
    findUserById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: authenticatedUserId }),
    });
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    await expect(service.findMyTasks(authenticatedUserId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns tasks for a member linked from the employee account', async () => {
    const member = {
      ...mockMember(),
      userId: { toString: () => authenticatedUserId },
      tasks: [{ text: 'Separar pedidos', completed: false }],
    };
    findUserById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: authenticatedUserId,
        equipeMember: member._id,
      }),
    });
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(member),
    });

    await expect(service.findMyTasks(authenticatedUserId)).resolves.toBe(member);
  });

  it('finds employee tasks by userId when the account has no member reference', async () => {
    const member = {
      ...mockMember(),
      userId: { toString: () => authenticatedUserId },
      tasks: [{ text: 'Separar pedidos', completed: false }],
    };
    findUserById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: authenticatedUserId }),
    });
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(member),
    });

    await expect(service.findMyTasks(authenticatedUserId)).resolves.toBe(member);
  });

  it('does not accept task completion without an uploaded file', async () => {
    const member = {
      ...mockMember(),
      userId: { toString: () => authenticatedUserId },
      tasks: [
        {
          _id: { toString: () => '507f1f77bcf86cd799439014' },
          completed: false,
        },
      ],
    };
    findMemberById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(member),
    });

    await expect(
      service.submitTaskAttachment(
        member._id,
        '507f1f77bcf86cd799439014',
        authenticatedUserId,
        {
          buffer: Buffer.from('not a pdf'),
          originalname: 'prova.pdf',
          mimetype: 'application/pdf',
          size: 10,
        },
        'Relatório da tarefa',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an employee report before marking a task complete', async () => {
    await expect(
      service.submitTaskAttachment(
        '507f1f77bcf86cd799439013',
        '507f1f77bcf86cd799439014',
        authenticatedUserId,
        {
          buffer: Buffer.from('%PDF-1.7'),
          originalname: 'prova.pdf',
          mimetype: 'application/pdf',
          size: 8,
        },
        '   ',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMemberById).not.toHaveBeenCalled();
  });
});
