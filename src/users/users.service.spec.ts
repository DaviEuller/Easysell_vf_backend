import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from './enum/user.role.enum.js';
import { User } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const saveUser = vi.fn();

  class MockUserModel {
    private readonly data: unknown;

    constructor(data: unknown) {
      this.data = data;
    }

    save() {
      return saveUser(this.data);
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: MockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    saveUser.mockImplementation((data: unknown) => data);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates new accounts as employees regardless of a requested role', async () => {
    const user = await service.create({
      name: 'João Silva',
      email: 'joao@example.com',
      password: 'secret123',
      role: UserRole.ADMINISTRADOR,
    });

    expect(saveUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'João Silva',
        email: 'joao@example.com',
        role: UserRole.FUNCIONARIO,
      }),
    );
    expect(user).toEqual(
      expect.objectContaining({ role: UserRole.FUNCIONARIO }),
    );
  });
});
