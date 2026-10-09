import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Company } from '../company/schemas/company.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { Equipe } from './entities/equipe.entity.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { EquipeController } from './equipe.controller.js';
import { EquipeService } from './equipe.service.js';

describe('EquipeController', () => {
  let controller: EquipeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EquipeController],
      providers: [
        EquipeService,
        {
          provide: getModelToken(Company.name),
          useValue: { findById: vi.fn() },
        },
        {
          provide: getModelToken(Equipe.name),
          useValue: {
            create: vi.fn(),
            find: vi.fn(),
            findById: vi.fn(),
            findByIdAndUpdate: vi.fn(),
            findOneAndUpdate: vi.fn(),
            findByIdAndDelete: vi.fn(),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: vi.fn(),
            findByIdAndUpdate: vi.fn(),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: { db: {} },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .compile();

    controller = module.get<EquipeController>(EquipeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
