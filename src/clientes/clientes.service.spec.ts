import { vi } from 'vitest';
import type { Model } from 'mongoose';
import type { ClienteDocument } from './Schemas/clientes.schemas.js';
import type { ProdutoDocument } from '../produtos/Schemas/Schemas.produtos.js';
import { ClientesService } from './clientes.service.js';

describe('ClientesService', () => {
  let service: ClientesService;
  let findClientes: ReturnType<typeof vi.fn>;
  let execClientes: ReturnType<typeof vi.fn>;
  let findProduto: ReturnType<typeof vi.fn>;
  let produtoExec: ReturnType<typeof vi.fn>;
  let produtoSave: ReturnType<typeof vi.fn>;
  let clienteSave: ReturnType<typeof vi.fn>;
  let clienteModelCtor: any;

  beforeEach(() => {
    execClientes = vi.fn().mockResolvedValue([]);
    findClientes = vi.fn().mockReturnValue({ exec: execClientes });

    produtoSave = vi.fn().mockResolvedValue({});
    produtoExec = vi.fn().mockResolvedValue({
      quantidade: 10,
      save: produtoSave,
    });
    findProduto = vi.fn().mockReturnValue({ exec: produtoExec });

    clienteSave = vi.fn().mockResolvedValue({});
    clienteModelCtor = function ClienteModelMock(this: any, data: any) {
      Object.assign(this, data);
    } as any;
    clienteModelCtor.find = findClientes;
    clienteModelCtor.prototype.save = clienteSave;

    service = new ClientesService(
      clienteModelCtor as unknown as Model<ClienteDocument>,
      { findById: findProduto, save: produtoSave } as unknown as Model<ProdutoDocument>,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find customers by the company field stored in the schema', async () => {
    await expect(service.findByCompany('company-123')).resolves.toEqual([]);
    expect(findClientes).toHaveBeenCalledWith({ idcompany: 'company-123' });
    expect(execClientes).toHaveBeenCalledOnce();
  });

  it('should subtract the sold quantity from product stock when creating a sale', async () => {
    const dto = {
      name: 'Cliente',
      Numero: '999999999',
      IdProduto: '507f1f77bcf86cd799439011',
      idcompany: 'company-123',
      Preco_gasto: 100,
      Quantidade: 3,
    };

    await service.create(dto as any);

    expect(findProduto).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(produtoSave).toHaveBeenCalledOnce();
  });
});
