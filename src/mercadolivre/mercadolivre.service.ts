import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';
import { Produto } from '../produtos/Schemas/Schemas.produtos.js';
import type {
  MercadoLivreProductListing,
  ProdutoDocument,
} from '../produtos/Schemas/Schemas.produtos.js';
import type { MercadoLivreProductListingDto } from '../produtos/dto/mercadolivre-product-listing.dto.js';
import {
  MercadoLivreAccount,
  MercadoLivreAccountDocument,
} from './entities/mercadolivre-account.entity.js';
import {
  MercadoLivreFiscalDocument,
  MercadoLivrePurchase,
  MercadoLivrePurchaseDocument,
} from './entities/mercadolivre-purchase.entity.js';

type AuthenticatedUser = {
  userId: string;
  companyId?: string;
  empresaid?: string;
};
type MercadoLivreTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};
type MercadoLivreOrder = Record<string, unknown> & {
  id: string | number;
  status: string;
  total_amount: number;
  currency_id: string;
  date_created: string;
};
type CompanyScope = { companyId: string; userId: string };
type MarketplaceProductInput = {
  name: string;
  category: string;
  price: number;
  stock: number;
  listing: MercadoLivreProductListingDto;
};

const API_BASE_URL = 'https://api.mercadolibre.com';
const AUTHORIZATION_URL = 'https://auth.mercadolivre.com.br/authorization';
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_ORDERS_PER_SYNC = 200;
const MAX_PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function encryptedValue(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptedValue(value: string, key: Buffer): string {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('O token Mercado Livre armazenado está inválido.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivValue, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

@Injectable()
export class MercadoLivreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MercadoLivreService.name);
  private readonly activeSyncs = new Set<string>();
  private readonly activeListings = new Set<string>();
  private syncTimer?: NodeJS.Timeout;

  constructor(
    @InjectModel(MercadoLivreAccount.name)
    private readonly accountModel: Model<MercadoLivreAccountDocument>,
    @InjectModel(MercadoLivrePurchase.name)
    private readonly purchaseModel: Model<MercadoLivrePurchaseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Produto.name)
    private readonly productModel: Model<ProdutoDocument>,
  ) {}

  onModuleInit() {
    this.syncTimer = setInterval(() => {
      this.syncConnectedAccounts().catch((error: unknown) => {
        this.logger.error(
          'Falha ao sincronizar contas do Mercado Livre.',
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, SYNC_INTERVAL_MS);
    this.syncTimer.unref();
    this.syncConnectedAccounts().catch((error: unknown) => {
      this.logger.error(
        'Falha ao iniciar a sincronização do Mercado Livre.',
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async getStatus(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    const account = await this.accountModel
      .findOne({ companyId: scope.companyId })
      .select(
        'status mercadoLivreUserId nickname lastSyncAt lastSyncError tokenExpiresAt',
      )
      .lean()
      .exec();
    return {
      status: account?.status ?? 'disconnected',
      mercadoLivreUserId: account?.mercadoLivreUserId ?? null,
      nickname: account?.nickname ?? null,
      lastSyncAt: account?.lastSyncAt ?? null,
      lastSyncError: account?.lastSyncError ?? null,
      tokenExpiresAt: account?.tokenExpiresAt ?? null,
      syncIntervalMinutes: 15,
    };
  }

  async connect(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    const { clientId, redirectUri } = this.getOAuthConfiguration();
    const state = randomBytes(32).toString('hex');
    await this.accountModel
      .findOneAndUpdate(
        { companyId: scope.companyId },
        {
          $set: {
            oauthStateHash: this.hash(state),
            oauthStateExpiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
          },
          $setOnInsert: { status: 'disconnected' },
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    const authorizationUrl = new URL(AUTHORIZATION_URL);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', clientId);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('state', state);
    return { authorizationUrl: authorizationUrl.toString() };
  }

  async completeAuthorization(
    code: string,
    state: string,
    authorizationError?: string,
  ) {
    if (!code && !authorizationError) {
      throw new BadRequestException(
        'O Mercado Livre não retornou o código de autorização.',
      );
    }
    if (!state || state.length > 200) {
      throw new BadRequestException('O estado OAuth é inválido.');
    }
    const account = await this.accountModel
      .findOneAndUpdate(
        {
          oauthStateHash: this.hash(state),
          oauthStateExpiresAt: { $gt: new Date() },
        },
        {
          $unset: { oauthStateHash: 1, oauthStateExpiresAt: 1 },
        },
        { returnDocument: 'after' },
      )
      .select('+encryptedAccessToken +encryptedRefreshToken')
      .exec();
    if (!account) {
      throw new ConflictException(
        'A autorização expirou ou já foi utilizada. Inicie a conexão novamente.',
      );
    }
    if (authorizationError) {
      throw new BadRequestException(
        'A autorização do Mercado Livre foi recusada. Você pode tentar conectar novamente.',
      );
    }

    const { clientId, clientSecret, redirectUri } =
      this.getOAuthConfiguration();
    const token = await this.exchangeToken({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const key = this.getEncryptionKey();
    const profile = await this.requestJson(
      `${API_BASE_URL}/users/me`,
      token.access_token,
    );
    if (typeof profile.id !== 'number' && typeof profile.id !== 'string') {
      throw new BadGatewayException(
        'O Mercado Livre retornou uma conta sem identificador.',
      );
    }

    account.status = 'connected';
    account.mercadoLivreUserId = String(profile.id);
    account.nickname = stringValue(profile.nickname);
    account.encryptedAccessToken = encryptedValue(token.access_token, key);
    account.encryptedRefreshToken = encryptedValue(token.refresh_token, key);
    account.tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);
    account.lastSyncError = undefined;
    await account.save();
    this.syncCompany(String(account.companyId)).catch((error: unknown) => {
      this.logSyncError(String(account.companyId), error);
    });
    this.syncPendingListings(String(account.companyId)).catch(
      (error: unknown) => this.logSyncError(String(account.companyId), error),
    );
    return {
      connected: true,
      nickname: account.nickname ?? null,
      message:
        'Conta Mercado Livre conectada. A primeira sincronização foi iniciada.',
    };
  }

  async disconnect(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    await this.accountModel
      .findOneAndUpdate(
        { companyId: scope.companyId },
        {
          $set: { status: 'disconnected' },
          $unset: {
            mercadoLivreUserId: 1,
            nickname: 1,
            encryptedAccessToken: 1,
            encryptedRefreshToken: 1,
            tokenExpiresAt: 1,
            oauthStateHash: 1,
            oauthStateExpiresAt: 1,
            lastSyncError: 1,
          },
        },
      )
      .exec();
    return { disconnected: true };
  }

  async listPurchases(user: AuthenticatedUser, page = 1, limit = 50) {
    const scope = await this.getAdminScope(user);
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const [items, total] = await Promise.all([
      this.purchaseModel
        .find({ companyId: scope.companyId })
        .sort({ orderedAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.purchaseModel.countDocuments({ companyId: scope.companyId }).exec(),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async syncNow(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    return this.syncCompany(scope.companyId);
  }

  async publishProduct(
    user: AuthenticatedUser,
    productId: string,
    listing: MercadoLivreProductListingDto,
  ) {
    const scope = await this.getAdminScope(user);
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('O identificador do produto é inválido.');
    }
    const product = await this.productModel
      .findOne({ _id: productId, companyId: scope.companyId })
      .exec();
    if (!product) {
      throw new NotFoundException('Produto não encontrado nesta empresa.');
    }
    if (product.mercadoLivreListing?.itemId) {
      throw new ConflictException(
        'Este produto já possui um anúncio no Mercado Livre.',
      );
    }
    product.mercadoLivreListing = {
      categoryId: listing.categoryId,
      condition: listing.condition,
      listingTypeId: listing.listingTypeId,
      pictures: listing.pictures,
      shippingMode: listing.shippingMode,
      freeShipping: listing.freeShipping,
      localPickup: listing.localPickup,
      attributes: listing.attributes?.map((attribute) => ({
        id: attribute.id,
        valueId: attribute.valueId,
        valueName: attribute.valueName,
      })),
      publicationStatus: 'pending',
      publicationError: undefined,
    };
    await product.save();
    return this.publishConfiguredProduct(scope.companyId, product.id);
  }

  async createAndPublishProduct(
    user: AuthenticatedUser,
    input: MarketplaceProductInput,
  ) {
    const scope = await this.getAdminScope(user);
    const product = new this.productModel({
      name: input.name,
      categoria: input.category,
      companyId: new Types.ObjectId(scope.companyId),
      preco: input.price,
      quantidade: input.stock,
      mercadoLivreListing: {
        categoryId: input.listing.categoryId,
        condition: input.listing.condition,
        listingTypeId: input.listing.listingTypeId,
        pictures: input.listing.pictures,
        shippingMode: input.listing.shippingMode,
        freeShipping: input.listing.freeShipping,
        localPickup: input.listing.localPickup,
        attributes: input.listing.attributes?.map((attribute) => ({
          id: attribute.id,
          valueId: attribute.valueId,
          valueName: attribute.valueName,
        })),
        publicationStatus: 'pending',
      },
    });
    await product.save();
    const publication = await this.publishConfiguredProduct(
      scope.companyId,
      product.id,
    );
    return {
      productId: product.id,
      name: product.name,
      publication,
    };
  }

  async publishConfiguredProduct(companyId: string, productId: string) {
    if (
      !Types.ObjectId.isValid(companyId) ||
      !Types.ObjectId.isValid(productId)
    ) {
      throw new BadRequestException(
        'A empresa ou o produto informado para publicação é inválido.',
      );
    }
    const product = await this.productModel
      .findOne({ _id: productId, companyId })
      .exec();
    if (!product) {
      throw new NotFoundException('Produto não encontrado nesta empresa.');
    }
    const listing = product.mercadoLivreListing;
    if (!this.isListingConfigured(listing)) {
      return {
        status: 'pending',
        reason: 'listing_details_incomplete',
      };
    }
    if (product.preco <= 0 || !Number.isFinite(product.preco)) {
      return this.setListingPending(
        product,
        'O produto precisa ter preço maior que zero para ser anunciado.',
      );
    }
    if (!Number.isInteger(product.quantidade) || product.quantidade < 0) {
      return this.setListingPending(
        product,
        'O estoque do produto precisa ser um número inteiro não negativo.',
      );
    }
    if (!listing.itemId && product.quantidade === 0) {
      return this.setListingPending(
        product,
        'O produto precisa ter ao menos uma unidade em estoque para criar o anúncio.',
      );
    }
    if (this.activeListings.has(product.id)) {
      return { status: 'publishing', reason: 'publication_in_progress' };
    }
    if (!listing.itemId && listing.publicationStatus === 'publishing') {
      return { status: 'publishing', reason: 'publication_in_progress' };
    }
    this.activeListings.add(product.id);
    try {
      const account = await this.getAccountWithTokens(companyId);
      const isUpdate = Boolean(listing.itemId);
      if (!isUpdate) {
        listing.publicationStatus = 'publishing';
        await product.save();
      }
      const itemUrl = listing.itemId
        ? `${API_BASE_URL}/items/${encodeURIComponent(listing.itemId)}`
        : `${API_BASE_URL}/items`;
      const body: Record<string, unknown> = listing.itemId
        ? { price: product.preco, available_quantity: product.quantidade }
        : {
            title: product.name.slice(0, 60),
            category_id: listing.categoryId,
            price: product.preco,
            currency_id: 'BRL',
            available_quantity: product.quantidade,
            buying_mode: 'buy_it_now',
            listing_type_id: listing.listingTypeId,
            condition: listing.condition,
            pictures: listing.pictures!.map((source) => ({ source })),
            shipping: {
              mode: listing.shippingMode,
              free_shipping: listing.freeShipping,
              local_pick_up: listing.localPickup,
            },
            attributes: (listing.attributes ?? []).map((attribute) => ({
              id: attribute.id,
              ...(attribute.valueId ? { value_id: attribute.valueId } : {}),
              ...(attribute.valueName
                ? { value_name: attribute.valueName }
                : {}),
            })),
          };
      const response = await this.requestWithTokenRefresh(
        itemUrl,
        account,
        listing.itemId ? 'PUT' : 'POST',
        body,
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new BadGatewayException(
          this.marketplaceErrorMessage(result, response.status),
        );
      }
      if (
        !isRecord(result) ||
        (typeof result.id !== 'string' && typeof result.id !== 'number')
      ) {
        throw new BadGatewayException(
          'O Mercado Livre não retornou o identificador do anúncio.',
        );
      }
      listing.itemId = String(result.id);
      listing.permalink = stringValue(result.permalink);
      listing.publicationStatus = 'published';
      listing.publicationError = undefined;
      listing.publishedAt = new Date();
      await product.save();
      return {
        status: 'published',
        itemId: listing.itemId,
        permalink: listing.permalink ?? null,
        updated: isUpdate,
      };
    } catch (error) {
      const deferred = error instanceof ConflictException;
      listing.publicationStatus = deferred ? 'pending' : 'error';
      listing.publicationError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Não foi possível publicar o produto no Mercado Livre.';
      await product.save();
      if (!deferred) {
        this.logger.error(
          `Não foi possível publicar o produto ${product.id} no Mercado Livre.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      return {
        status: deferred ? 'pending' : 'error',
        message: listing.publicationError,
      };
    } finally {
      this.activeListings.delete(product.id);
    }
  }

  async getCategoryAttributes(user: AuthenticatedUser, categoryId: string) {
    const scope = await this.getAdminScope(user);
    if (!/^[A-Z]{3}\d+$/.test(categoryId)) {
      throw new BadRequestException(
        'O ID da categoria do Mercado Livre é inválido.',
      );
    }
    const account = await this.getAccountWithTokens(scope.companyId);
    const response = await this.mercadoLivreRequest(
      `${API_BASE_URL}/categories/${encodeURIComponent(categoryId)}/attributes`,
      await this.getValidAccessToken(account),
    );
    if (!response.ok) {
      throw new BadGatewayException(
        `Não foi possível consultar os atributos da categoria (HTTP ${response.status}).`,
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!Array.isArray(payload) || !payload.every(isRecord)) {
      throw new BadGatewayException(
        'O Mercado Livre retornou atributos de categoria inválidos.',
      );
    }
    return payload;
  }

  async downloadFiscalDocument(
    user: AuthenticatedUser,
    purchaseId: string,
    documentId: string,
  ) {
    const scope = await this.getAdminScope(user);
    if (!Types.ObjectId.isValid(purchaseId)) {
      throw new BadRequestException('O identificador da compra é inválido.');
    }
    const purchase = await this.purchaseModel
      .findOne({ _id: purchaseId, companyId: scope.companyId })
      .exec();
    if (!purchase) throw new NotFoundException('Compra não encontrada.');
    if (
      !purchase.fiscalDocuments.some(
        (document) => document.documentId === documentId,
      )
    ) {
      throw new NotFoundException(
        'O documento fiscal não pertence a esta compra.',
      );
    }
    const account = await this.getAccountWithTokens(scope.companyId);
    const packId = purchase.externalPackId ?? purchase.externalOrderId;
    const response = await this.requestWithTokenRefresh(
      `${API_BASE_URL}/packs/${encodeURIComponent(packId)}/fiscal_documents/${encodeURIComponent(documentId)}`,
      account,
    );
    if (response.status === 404) {
      throw new NotFoundException(
        'O Mercado Livre não encontrou este documento fiscal.',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Não foi possível baixar o documento fiscal do Mercado Livre.',
      );
    }
    const fileType =
      response.headers.get('content-type')?.split(';')[0] ??
      'application/octet-stream';
    if (
      !['application/pdf', 'application/xml', 'text/xml'].includes(fileType)
    ) {
      throw new BadGatewayException(
        'O Mercado Livre retornou um tipo de arquivo não permitido.',
      );
    }
    return {
      content: Buffer.from(await response.arrayBuffer()),
      contentType: fileType,
      fileName:
        purchase.fiscalDocuments.find(
          (document) => document.documentId === documentId,
        )?.fileName ?? 'documento-fiscal',
    };
  }

  private async getAdminScope(user: AuthenticatedUser): Promise<CompanyScope> {
    const userId = user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('A sessão do usuário é inválida.');
    }
    const currentUser = await this.userModel
      .findById(userId)
      .select('company role')
      .exec();
    const companyId = currentUser?.company?.toString();
    if (!currentUser || !companyId || !Types.ObjectId.isValid(companyId)) {
      throw new UnauthorizedException(
        'O usuário não está associado a uma empresa.',
      );
    }
    const tokenCompanyId = user.companyId ?? user.empresaid;
    if (
      tokenCompanyId &&
      (!Types.ObjectId.isValid(tokenCompanyId) ||
        tokenCompanyId.toLowerCase() !== companyId.toLowerCase())
    ) {
      throw new UnauthorizedException(
        'A empresa da sessão não corresponde ao cadastro do usuário.',
      );
    }
    if (currentUser.role !== UserRole.ADMINISTRADOR) {
      throw new ForbiddenException(
        'Somente o administrador pode gerenciar a integração do Mercado Livre.',
      );
    }
    return { userId, companyId };
  }

  private getOAuthConfiguration() {
    const clientId = process.env.MERCADOLIVRE_CLIENT_ID?.trim();
    const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Configure MERCADOLIVRE_CLIENT_ID, MERCADOLIVRE_CLIENT_SECRET e MERCADOLIVRE_REDIRECT_URI.',
      );
    }
    let parsedRedirect: URL;
    try {
      parsedRedirect = new URL(redirectUri);
    } catch {
      throw new BadRequestException(
        'MERCADOLIVRE_REDIRECT_URI precisa ser uma URL válida.',
      );
    }
    if (!['http:', 'https:'].includes(parsedRedirect.protocol)) {
      throw new BadRequestException(
        'MERCADOLIVRE_REDIRECT_URI precisa usar HTTP ou HTTPS.',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private getEncryptionKey() {
    const encodedKey = process.env.MERCADOLIVRE_TOKEN_ENCRYPTION_KEY?.trim();
    if (!encodedKey) {
      throw new BadRequestException(
        'Configure MERCADOLIVRE_TOKEN_ENCRYPTION_KEY como chave Base64 de 32 bytes.',
      );
    }
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32) {
      throw new BadRequestException(
        'MERCADOLIVRE_TOKEN_ENCRYPTION_KEY precisa decodificar exatamente 32 bytes.',
      );
    }
    return key;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async exchangeToken(
    values: Record<string, string>,
  ): Promise<MercadoLivreTokenResponse> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new BadGatewayException(
        'Não foi possível conectar à autenticação do Mercado Livre.',
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      !isRecord(payload) ||
      typeof payload.access_token !== 'string' ||
      typeof payload.refresh_token !== 'string' ||
      typeof payload.expires_in !== 'number'
    ) {
      throw new BadGatewayException(
        'O Mercado Livre recusou a autorização. Verifique a aplicação e a URL de retorno configuradas.',
      );
    }
    return payload as MercadoLivreTokenResponse;
  }

  private async getAccountWithTokens(companyId: string) {
    const account = await this.accountModel
      .findOne({ companyId, status: 'connected' })
      .select('+encryptedAccessToken +encryptedRefreshToken')
      .exec();
    if (
      !account?.encryptedAccessToken ||
      !account.encryptedRefreshToken ||
      !account.mercadoLivreUserId
    ) {
      throw new ConflictException(
        'Conecte a conta do Mercado Livre antes de sincronizar compras.',
      );
    }
    return account;
  }

  private async getValidAccessToken(
    account: MercadoLivreAccountDocument,
  ): Promise<string> {
    if (
      account.tokenExpiresAt &&
      account.tokenExpiresAt.getTime() > Date.now() + 60_000 &&
      account.encryptedAccessToken
    ) {
      return decryptedValue(
        account.encryptedAccessToken,
        this.getEncryptionKey(),
      );
    }
    if (!account.encryptedRefreshToken) {
      throw new ConflictException(
        'A autorização do Mercado Livre expirou. Conecte a conta novamente.',
      );
    }
    const { clientId, clientSecret } = this.getOAuthConfiguration();
    try {
      const token = await this.exchangeToken({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptedValue(
          account.encryptedRefreshToken,
          this.getEncryptionKey(),
        ),
      });
      const key = this.getEncryptionKey();
      account.encryptedAccessToken = encryptedValue(token.access_token, key);
      account.encryptedRefreshToken = encryptedValue(token.refresh_token, key);
      account.tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);
      await account.save();
      return token.access_token;
    } catch (error) {
      account.status = 'disconnected';
      account.lastSyncError =
        'A autorização expirou. Conecte novamente a conta do Mercado Livre.';
      await account.save();
      if (error instanceof BadGatewayException) throw error;
      throw new ConflictException(account.lastSyncError);
    }
  }

  private async requestJson(url: string, token: string) {
    const response = await this.mercadoLivreRequest(url, token);
    if (!response.ok) {
      throw new BadGatewayException(
        `A API do Mercado Livre respondeu com HTTP ${response.status}.`,
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!isRecord(payload)) {
      throw new BadGatewayException(
        'A API do Mercado Livre retornou uma resposta inválida.',
      );
    }
    return payload;
  }

  private async mercadoLivreRequest(
    url: string,
    token: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: Record<string, unknown>,
  ) {
    try {
      return await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new BadGatewayException(
        'Não foi possível conectar à API do Mercado Livre.',
      );
    }
  }

  private isListingConfigured(
    listing: MercadoLivreProductListing | undefined,
  ): listing is MercadoLivreProductListing & {
    categoryId: string;
    condition: 'new' | 'used' | 'not_specified';
    listingTypeId: string;
    pictures: string[];
    shippingMode: string;
    freeShipping: boolean;
    localPickup: boolean;
  } {
    return Boolean(
      listing?.categoryId?.trim() &&
      listing.condition &&
      listing.listingTypeId?.trim() &&
      listing.pictures?.length &&
      listing.shippingMode?.trim() &&
      typeof listing.freeShipping === 'boolean' &&
      typeof listing.localPickup === 'boolean',
    );
  }

  private async setListingPending(product: ProdutoDocument, message: string) {
    if (product.mercadoLivreListing) {
      product.mercadoLivreListing.publicationStatus = 'pending';
      product.mercadoLivreListing.publicationError = message;
      await product.save();
    }
    return { status: 'pending', message };
  }

  private marketplaceErrorMessage(payload: unknown, status: number) {
    if (isRecord(payload)) {
      const causeMessages = Array.isArray(payload.cause)
        ? payload.cause
            .flatMap((cause) =>
              isRecord(cause) ? [stringValue(cause.message)] : [],
            )
            .filter((message): message is string => Boolean(message))
            .slice(0, 3)
        : [];
      const message = stringValue(payload.message) ?? causeMessages.join('; ');
      if (message) {
        return `O Mercado Livre recusou o anúncio: ${message.slice(0, 350)}`;
      }
    }
    return `O Mercado Livre recusou o anúncio (HTTP ${status}).`;
  }

  private async syncConnectedAccounts() {
    const accounts = await this.accountModel
      .find({ status: 'connected' })
      .select('companyId')
      .lean()
      .exec();
    await Promise.all(
      accounts.map(async (account) => {
        const companyId = String(account.companyId);
        await Promise.all([
          this.syncCompany(companyId).catch((error: unknown) =>
            this.logSyncError(companyId, error),
          ),
          this.syncPendingListings(companyId).catch((error: unknown) =>
            this.logSyncError(companyId, error),
          ),
        ]);
      }),
    );
  }

  private async syncPendingListings(companyId: string) {
    const pendingProducts = await this.productModel
      .find({
        companyId,
        'mercadoLivreListing.publicationStatus': 'pending',
      })
      .select('_id')
      .limit(100)
      .lean()
      .exec();
    for (const product of pendingProducts) {
      try {
        await this.publishConfiguredProduct(companyId, String(product._id));
      } catch (error) {
        this.logger.error(
          `Não foi possível publicar automaticamente o produto ${String(product._id)}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async syncCompany(companyId: string) {
    if (this.activeSyncs.has(companyId)) {
      return { started: false, reason: 'sync_in_progress' };
    }
    this.activeSyncs.add(companyId);
    try {
      const account = await this.getAccountWithTokens(companyId);
      const orders = await this.fetchBuyerOrders(
        account.mercadoLivreUserId!,
        account,
      );
      const syncedAt = new Date();
      for (const order of orders) {
        const packId =
          stringValue(order.pack_id) ??
          (typeof order.pack_id === 'number'
            ? String(order.pack_id)
            : undefined);
        const fiscal = await this.fetchFiscalDocuments(
          packId ?? String(order.id),
          account,
        );
        const seller = isRecord(order.seller) ? order.seller : {};
        const orderItems = Array.isArray(order.order_items)
          ? order.order_items
          : [];
        const items = orderItems.flatMap((entry) => {
          if (!isRecord(entry)) return [];
          const item = isRecord(entry.item) ? entry.item : {};
          const quantity = entry.quantity;
          const unitPrice = entry.unit_price;
          if (
            typeof quantity !== 'number' ||
            typeof unitPrice !== 'number' ||
            !Number.isFinite(quantity) ||
            !Number.isFinite(unitPrice)
          ) {
            return [];
          }
          return [
            {
              title: stringValue(item.title) ?? 'Item do Mercado Livre',
              ...(stringValue(item.id) ? { itemId: stringValue(item.id) } : {}),
              quantity,
              unitPrice,
            },
          ];
        });
        const orderedAt = new Date(order.date_created);
        if (
          !Number.isFinite(order.total_amount) ||
          Number(order.total_amount) < 0 ||
          Number.isNaN(orderedAt.getTime())
        ) {
          throw new BadGatewayException(
            'A API do Mercado Livre retornou uma compra com valores inválidos.',
          );
        }
        await this.purchaseModel
          .findOneAndUpdate(
            { companyId, externalOrderId: String(order.id) },
            {
              $set: {
                externalPackId: packId,
                status: order.status,
                statusDetail: stringValue(order.status_detail),
                sellerNickname: stringValue(seller.nickname),
                totalAmount: Number(order.total_amount),
                currency: stringValue(order.currency_id) ?? 'BRL',
                orderedAt,
                items,
                fiscalDocumentsStatus:
                  fiscal.status === 200 && fiscal.documents.length > 0
                    ? 'available'
                    : fiscal.status === 403
                      ? 'unavailable'
                      : 'not_available',
                fiscalDocuments: fiscal.documents,
                lastSyncedAt: syncedAt,
              },
            },
            {
              upsert: true,
              returnDocument: 'after',
              setDefaultsOnInsert: true,
            },
          )
          .exec();
      }
      account.lastSyncAt = syncedAt;
      account.lastSyncError = undefined;
      await account.save();
      return { started: true, importedOrders: orders.length, syncedAt };
    } catch (error) {
      await this.accountModel
        .updateOne(
          { companyId },
          {
            $set: {
              lastSyncError:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : 'Falha ao sincronizar compras do Mercado Livre.',
            },
          },
        )
        .exec();
      throw error;
    } finally {
      this.activeSyncs.delete(companyId);
    }
  }

  private async fetchBuyerOrders(
    buyerId: string,
    account: MercadoLivreAccountDocument,
  ): Promise<MercadoLivreOrder[]> {
    const orders: MercadoLivreOrder[] = [];
    for (
      let offset = 0;
      offset < MAX_ORDERS_PER_SYNC;
      offset += MAX_PAGE_SIZE
    ) {
      const url = new URL(`${API_BASE_URL}/orders/search`);
      url.searchParams.set('buyer', buyerId);
      url.searchParams.set('sort', 'date_desc');
      url.searchParams.set('limit', String(MAX_PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      const response = await this.requestWithTokenRefresh(
        url.toString(),
        account,
      );
      if (!response.ok) {
        throw new BadGatewayException(
          `Não foi possível consultar compras no Mercado Livre (HTTP ${response.status}).`,
        );
      }
      const payload: unknown = await response.json().catch(() => null);
      if (
        !isRecord(payload) ||
        !Array.isArray(payload.results) ||
        !payload.results.every(
          (order) =>
            isRecord(order) &&
            (typeof order.id === 'number' || typeof order.id === 'string') &&
            typeof order.status === 'string' &&
            typeof order.total_amount === 'number' &&
            typeof order.currency_id === 'string' &&
            typeof order.date_created === 'string',
        )
      ) {
        throw new BadGatewayException(
          'A API do Mercado Livre retornou uma lista de compras inválida.',
        );
      }
      orders.push(...(payload.results as MercadoLivreOrder[]));
      if (payload.results.length < MAX_PAGE_SIZE) break;
    }
    return orders;
  }

  private async fetchFiscalDocuments(
    packId: string,
    account: MercadoLivreAccountDocument,
  ): Promise<{ status: number; documents: MercadoLivreFiscalDocument[] }> {
    const response = await this.requestWithTokenRefresh(
      `${API_BASE_URL}/packs/${encodeURIComponent(packId)}/fiscal_documents`,
      account,
    );
    if (response.status === 404) return { status: 404, documents: [] };
    if (response.status === 403) return { status: 403, documents: [] };
    if (!response.ok) {
      throw new BadGatewayException(
        `Não foi possível verificar documentos fiscais (HTTP ${response.status}).`,
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    const rawDocuments = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.fiscal_documents)
        ? payload.fiscal_documents
        : [];
    const documents = rawDocuments.flatMap((document) => {
      if (!isRecord(document)) return [];
      const id =
        stringValue(document.id) ??
        (typeof document.id === 'number' ? String(document.id) : undefined);
      if (!id) return [];
      const dateValue = stringValue(document.date);
      const date = dateValue ? new Date(dateValue) : undefined;
      return [
        {
          documentId: id,
          ...(stringValue(document.filename)
            ? { fileName: stringValue(document.filename) }
            : {}),
          ...(stringValue(document.file_type)
            ? { fileType: stringValue(document.file_type) }
            : {}),
          ...(date && !Number.isNaN(date.getTime()) ? { date } : {}),
        },
      ];
    });
    return { status: response.status, documents };
  }

  private async requestWithTokenRefresh(
    url: string,
    account: MercadoLivreAccountDocument,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: Record<string, unknown>,
  ) {
    let response = await this.mercadoLivreRequest(
      url,
      await this.getValidAccessToken(account),
      method,
      body,
    );
    if (response.status === 401) {
      const refreshedToken = await this.refreshAccountToken(account);
      response = await this.mercadoLivreRequest(
        url,
        refreshedToken,
        method,
        body,
      );
    }
    return response;
  }

  private async refreshAccountToken(
    account: MercadoLivreAccountDocument,
  ): Promise<string> {
    account.tokenExpiresAt = new Date(0);
    return this.getValidAccessToken(account);
  }

  private logSyncError(companyId: string, error: unknown) {
    this.logger.error(
      `Não foi possível sincronizar compras do Mercado Livre para a empresa ${companyId}.`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
