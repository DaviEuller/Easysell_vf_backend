import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { ProdutosService } from './produtos.service.js';

describe('ProdutosService', () => {
  let service: ProdutosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProdutosService],
    }).compile();

    service = module.get<ProdutosService>(ProdutosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should transform numeric fields and validate required product data', async () => {
    const dto = Object.assign(new CreateProdutoDto(), {
      name: 'Teclado',
      categoria: 'Periféricos',
      companyId: '507f1f77bcf86cd799439011',
      quantidade: '3',
      preco: '149.9',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.quantidade).toBe(3);
    expect(dto.preco).toBe(149.9);
  });
});
