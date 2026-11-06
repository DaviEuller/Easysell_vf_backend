import { Types } from 'mongoose';
import { vi } from 'vitest';
import { UserRole } from '../users/enum/user.role.enum.js';
import { MercadoLivreService } from './mercadolivre.service.js';

const userId = '507f1f77bcf86cd799439011';
const companyId = '507f1f77bcf86cd799439012';

describe('MercadoLivreService', () => {
  let service: MercadoLivreService;
  let previousClientId: string | undefined;
  let previousClientSecret: string | undefined;
  let previousRedirectUri: string | undefined;
  let findOneAndUpdate: ReturnType<typeof vi.fn>;
  let findById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    previousClientId = process.env.MERCADOLIVRE_CLIENT_ID;
    previousClientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
    previousRedirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;
    process.env.MERCADOLIVRE_CLIENT_ID = 'test-client-id';
    process.env.MERCADOLIVRE_CLIENT_SECRET = 'test-client-secret';
    process.env.MERCADOLIVRE_REDIRECT_URI =
      'https://api.example.test/mercadolivre/oauth/callback';
    findOneAndUpdate = vi.fn(() => ({
      exec: vi.fn().mockResolvedValue({}),
    }));
    findById = vi.fn(() => ({
      select: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue({
          company: new Types.ObjectId(companyId),
          role: UserRole.ADMINISTRADOR,
        }),
      })),
    }));
    service = new MercadoLivreService(
      { findOneAndUpdate } as never,
      {} as never,
      { findById } as never,
      {} as never,
    );
  });

  afterEach(() => {
    if (previousClientId === undefined)
      delete process.env.MERCADOLIVRE_CLIENT_ID;
    else process.env.MERCADOLIVRE_CLIENT_ID = previousClientId;
    if (previousClientSecret === undefined)
      delete process.env.MERCADOLIVRE_CLIENT_SECRET;
    else process.env.MERCADOLIVRE_CLIENT_SECRET = previousClientSecret;
    if (previousRedirectUri === undefined)
      delete process.env.MERCADOLIVRE_REDIRECT_URI;
    else process.env.MERCADOLIVRE_REDIRECT_URI = previousRedirectUri;
  });

  it('creates a short-lived OAuth state and returns Mercado Livre authorization URL', async () => {
    const result = await service.connect({
      userId,
      companyId,
    });
    const authorizationUrl = new URL(result.authorizationUrl);
    const state = authorizationUrl.searchParams.get('state');
    const update = findOneAndUpdate.mock.calls[0][1] as {
      $set: { oauthStateHash: string; oauthStateExpiresAt: Date };
    };

    expect(authorizationUrl.origin).toBe('https://auth.mercadolivre.com.br');
    expect(authorizationUrl.searchParams.get('client_id')).toBe(
      'test-client-id',
    );
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      process.env.MERCADOLIVRE_REDIRECT_URI,
    );
    expect(state).toMatch(/^[a-f0-9]{64}$/);
    expect(update.$set.oauthStateHash).not.toBe(state);
    expect(update.$set.oauthStateExpiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('does not start OAuth for non-administrator users', async () => {
    findById.mockReturnValue({
      select: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue({
          company: new Types.ObjectId(companyId),
          role: UserRole.FUNCIONARIO,
        }),
      })),
    });

    await expect(service.connect({ userId, companyId })).rejects.toThrow(
      'Somente o administrador pode gerenciar a integração do Mercado Livre.',
    );
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps a configured product pending while the seller account is disconnected', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const product = {
      id: '507f1f77bcf86cd799439013',
      name: 'Camiseta',
      companyId,
      preco: 59.9,
      quantidade: 8,
      mercadoLivreListing: {
        categoryId: 'MLB1234',
        condition: 'new',
        listingTypeId: 'gold_special',
        pictures: ['https://cdn.example.test/camiseta.jpg'],
        shippingMode: 'me2',
        freeShipping: false,
        localPickup: false,
      },
      save,
    };
    const productModel = {
      findOne: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue(product),
      })),
    };
    const accountModel = {
      findOne: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue(null),
        })),
      })),
    };
    service = new MercadoLivreService(
      accountModel as never,
      {} as never,
      { findById } as never,
      productModel as never,
    );

    await expect(
      service.publishConfiguredProduct(companyId, product.id),
    ).resolves.toMatchObject({ status: 'pending' });

    expect(product.mercadoLivreListing.publicationStatus).toBe('pending');
    expect(product.mercadoLivreListing.publicationError).toContain(
      'Conecte a conta',
    );
    expect(save).toHaveBeenCalledOnce();
  });

  it('does not try to create an advertisement with zero stock', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const product = {
      id: '507f1f77bcf86cd799439013',
      name: 'Camiseta',
      companyId,
      preco: 59.9,
      quantidade: 0,
      mercadoLivreListing: {
        categoryId: 'MLB1234',
        condition: 'new',
        listingTypeId: 'gold_special',
        pictures: ['https://cdn.example.test/camiseta.jpg'],
        shippingMode: 'me2',
        freeShipping: false,
        localPickup: false,
      },
      save,
    };
    const productModel = {
      findOne: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue(product),
      })),
    };
    const accountModel = {
      findOne: vi.fn(),
    };
    service = new MercadoLivreService(
      accountModel as never,
      {} as never,
      { findById } as never,
      productModel as never,
    );

    await expect(
      service.publishConfiguredProduct(companyId, product.id),
    ).resolves.toMatchObject({ status: 'pending' });

    expect(product.mercadoLivreListing.publicationError).toContain(
      'ao menos uma unidade',
    );
    expect(accountModel.findOne).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
  });
});
