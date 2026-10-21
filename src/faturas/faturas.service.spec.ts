import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FaturasService } from './faturas.service.js';

describe('FaturasService', () => {
  const companyId = '507f1f77bcf86cd799439011';
  const saleId = '507f1f77bcf86cd799439012';
  const userId = '507f1f77bcf86cd799439013';
  const saveInvoice = vi.fn();
  const findUserById = vi.fn();
  const findSale = vi.fn();
  const findProduct = vi.fn();
  const findInvoice = vi.fn();
  const findAndUpdateInvoice = vi.fn();

  class MockFaturaModel {
    static findOneAndUpdate = findAndUpdateInvoice;
    static findOne = findInvoice;

    readonly values: Record<string, unknown>;

    constructor(values: Record<string, unknown>) {
      this.values = values;
    }

    save() {
      return saveInvoice(this.values);
    }
  }

  let service: FaturasService;

  beforeEach(() => {
    service = new FaturasService(
      MockFaturaModel as never,
      { findOne: findSale } as never,
      { findOne: findProduct } as never,
      { findById: findUserById } as never,
    );
    findUserById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          company: new Types.ObjectId(companyId),
        }),
      }),
    });
    findSale.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(saleId),
        name: 'Maria',
        Numero: '11999999999',
        IdProduto: '507f1f77bcf86cd799439015',
        idcompany: companyId,
        Preco_gasto: 125.5,
        Quantidade: 2,
        parcelas: 3,
        valorPago: 25.5,
      }),
    });
    findProduct.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ name: 'Produto A' }),
      }),
    });
    saveInvoice.mockImplementation(async (values: Record<string, unknown>) => ({
      ...values,
      id: '507f1f77bcf86cd799439014',
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending invoice from a sale owned by the authenticated company', async () => {
    const result = await service.create(
      { userId },
      { saleId, dueDate: '2026-11-30T00:00:00.000Z' },
    );

    expect(findSale).toHaveBeenCalledWith({
      _id: saleId,
      idcompany: companyId,
    });
    expect(result).toMatchObject({
      customerName: 'Maria',
      customerPhone: '11999999999',
      description: '2 unidade(s) de Produto A',
      amount: 100,
      status: 'pendente',
      installments: [
        {
          number: 1,
          amount: 33.34,
          status: 'pendente',
          dueDate: new Date('2026-11-30T00:00:00.000Z'),
        },
        {
          number: 2,
          amount: 33.33,
          status: 'pendente',
          dueDate: new Date('2026-12-30T00:00:00.000Z'),
        },
        {
          number: 3,
          amount: 33.33,
          status: 'pendente',
          dueDate: new Date('2027-01-30T00:00:00.000Z'),
        },
      ],
    });
  });

  it('rejects a duplicate invoice for the same sale', async () => {
    saveInvoice.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: 11000 }),
    );

    await expect(
      service.create(
        { userId },
        { saleId, dueDate: '2026-11-30T00:00:00.000Z' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects users without a company association', async () => {
    findUserById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ company: null }),
      }),
    });

    await expect(service.list({ userId })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('updates payment status only for a fatura in the user company', async () => {
    const updatedInvoice = { id: '507f1f77bcf86cd799439014', status: 'paga' };
    findAndUpdateInvoice.mockReturnValue({
      exec: vi.fn().mockResolvedValue(updatedInvoice),
    });

    await expect(
      service.setStatus({ userId }, '507f1f77bcf86cd799439014', 'paga'),
    ).resolves.toBe(updatedInvoice);
    expect(findAndUpdateInvoice).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439014', companyId },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'paga' }),
      }),
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('returns a WhatsApp link for the total remaining balance', async () => {
    findInvoice.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        customerName: 'Maria',
        customerPhone: '(11) 99999-9999',
        amount: 100,
        status: 'pendente',
        installments: [
          { amount: 40, status: 'paga' },
          { amount: 60, status: 'pendente' },
        ],
      }),
    });

    const result = await service.getWhatsAppCharge(
      { userId },
      '507f1f77bcf86cd799439014',
    );

    expect(result.phone).toBe('5511999999999');
    expect(result.outstandingAmount).toBe(60);
    expect(result.message).toContain('60,00');
    expect(result.url).toContain('https://wa.me/5511999999999?text=');
  });

  it('marks one installment paid without marking the remaining ones paid', async () => {
    const invoice = {
      installments: [
        { number: 1, amount: 40, status: 'pendente', paidAt: null },
        { number: 2, amount: 60, status: 'pendente', paidAt: null },
      ],
      status: 'pendente',
      paidAt: null,
      save: vi.fn().mockResolvedValue(undefined),
    };
    findInvoice.mockReturnValue({
      exec: vi.fn().mockResolvedValue(invoice),
    });

    await service.setInstallmentStatus(
      { userId },
      '507f1f77bcf86cd799439014',
      1,
      'paga',
    );

    expect(invoice.installments[0].status).toBe('paga');
    expect(invoice.installments[1].status).toBe('pendente');
    expect(invoice.status).toBe('pendente');
    expect(invoice.save).toHaveBeenCalledOnce();
  });
});
