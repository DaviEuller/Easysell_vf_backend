import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ProdutosController } from './produtos.controller.js';
import { ProdutosService } from './produtos.service.js';

describe('ProdutosController', () => {
  let controller: ProdutosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProdutosController],
      providers: [
        {
          provide: ProdutosService,
          useValue: {
            create: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            findByCompany: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProdutosController>(ProdutosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should use distinct routes for product lookup by id and company', () => {
    expect(Reflect.getMetadata('path', ProdutosController.prototype.findOne)).toBe(':id');
    expect(Reflect.getMetadata('path', ProdutosController.prototype.findByCompany)).toBe('company/:companyId');
  });
});
