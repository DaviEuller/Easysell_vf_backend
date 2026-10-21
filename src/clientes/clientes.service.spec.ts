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
  let findFaturas: ReturnType<typeof vi.fn>;
  let execFaturas: ReturnType<typeof vi.fn>;
  let clienteSave: ReturnType<typeof vi.fn>;
  let clienteModelCtor: any;
  let createdSale: Record<string, unknown> | undefined;

  beforeEach(() => {
    execClientes = vi.fn().mockResolvedValue([]);
    findClientes = vi.fn().mockReturnValue({ exec: execClientes });

    produtoSave = vi.fn().mockResolvedValue({});
    produtoExec = vi.fn().mockResolvedValue({
      quantidade: 10,
      save: produtoSave,
    });
    findProduto = vi.fn().mockReturnValue({ exec: produtoExec });
    execFaturas = vi.fn().mockResolvedValue([]);
    findFaturas = vi.fn().mockReturnValue({ exec: execFaturas });

    clienteSave = vi.fn().mockResolvedValue({});
    clienteModelCtor = function ClienteModelMock(this: any, data: any) {
      Object.assign(this, data);
      createdSale = data;
    } as any;
    clienteModelCtor.find = findClientes;
    clienteModelCtor.prototype.save = clienteSave;

    service = new ClientesService(
      clienteModelCtor as unknown as Model<ClienteDocument>,
      {
        findById: findProduto,
        save: produtoSave,
      } as unknown as Model<ProdutoDocument>,
      { find: findFaturas } as never,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find customers by the company field stored in the schema', async () => {
    await expect(service.findByCompany('company-123')).resolves.toEqual([]);
    expect(findClientes).toHaveBeenCalledWith({ idcompany: 'company-123' });
    expect(execClientes).toHaveBeenCalledOnce();
    expect(findFaturas).toHaveBeenCalledWith({ companyId: 'company-123' });
  });

  it('includes paid installments when calculating a sale balance', async () => {
    const sale = {
      id: 'sale-1',
      Preco_gasto: 100,
      valorPago: 10,
      parcelas: 3,
    };
    execClientes.mockResolvedValue([sale]);
    execFaturas.mockResolvedValue([
      {
        saleId: { toString: () => 'sale-1' },
        installments: [
          { amount: 30, status: 'paga' },
          { amount: 30, status: 'pendente' },
          { amount: 30, status: 'pendente' },
        ],
      },
    ]);

    const [result] = await service.findByCompany('company-123');

    expect(result.valorPago).toBe(40);
    expect(result.saldoPendente).toBe(60);
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

  it('stores paid amount, balance and installment plan on the sale', async () => {
    await service.create({
      name: 'Cliente',
      Numero: '999999999',
      IdProduto: '507f1f77bcf86cd799439011',
      idcompany: 'company-123',
      Preco_gasto: 100,
      Quantidade: 3,
      parcelas: 3,
      valorPago: 10,
      dataPrimeiroVencimento: '2026-11-21',
    });

    expect(createdSale).toMatchObject({
      parcelas: 3,
      valorPago: 10,
      saldoPendente: 90,
      dataPrimeiroVencimento: new Date('2026-11-21'),
    });
  });

  it('rejects a paid amount larger than the sale total', async () => {
    await expect(
      service.create({
        name: 'Cliente',
        Numero: '999999999',
        IdProduto: '507f1f77bcf86cd799439011',
        idcompany: 'company-123',
        Preco_gasto: 100,
        Quantidade: 3,
        valorPago: 101,
      }),
    ).rejects.toThrow('O valor pago deve estar entre zero e o total da venda.');

    expect(findProduto).not.toHaveBeenCalled();
  });
});
