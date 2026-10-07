import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';

describe('ClientesController', () => {
  let controller: ClientesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientesController],
      providers: [
        {
          provide: ClientesService,
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

    controller = module.get<ClientesController>(ClientesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should use distinct routes for customer lookup by id and company', () => {
    expect(Reflect.getMetadata('path', ClientesController.prototype.findOne)).toBe(':id');
    expect(Reflect.getMetadata('path', ClientesController.prototype.findByCompany)).toBe('company/:idcompany');
  });
});
