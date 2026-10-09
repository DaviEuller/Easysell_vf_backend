import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const findByEmail = vi.fn();
  const sign = vi.fn();
  let passwordHash: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail } },
        { provide: JwtService, useValue: { sign } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    passwordHash = await bcrypt.hash('secret123', 4);
    findByEmail.mockReset();
    sign.mockReset();
    sign.mockReturnValue('signed-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normalizes the email before finding the account', async () => {
    findByEmail.mockResolvedValue({
      _id: { toString: () => 'user-id' },
      email: 'person@example.com',
      passwordHash,
      role: 'funcionario',
    });

    const result = await service.login('  Person@Example.COM  ', 'secret123');

    expect(findByEmail).toHaveBeenCalledWith('person@example.com');
    expect(result.accessToken).toBe('signed-token');
  });

  it('rejects an email that does not match an account', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      service.login('missing@example.com', 'secret123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an incorrect password', async () => {
    findByEmail.mockResolvedValue({
      _id: { toString: () => 'user-id' },
      email: 'person@example.com',
      passwordHash,
      role: 'funcionario',
    });

    await expect(
      service.login('person@example.com', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
