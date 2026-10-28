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
import { resolve } from 'node:path';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import QRCode from 'qrcode';
import WhatsAppWeb from 'whatsapp-web.js';
import type { Message as WhatsAppMessage } from 'whatsapp-web.js';
import { AiService } from '../ai/ai.service.js';
import { UserRole } from '../users/enum/user.role.enum.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import type { AiUser } from '../ai/ai.service.js';
import type { CreateEasyBotContactDto } from './dto/create-easybot-contact.dto.js';
import type { UpdateEasyBotContactDto } from './dto/update-easybot-contact.dto.js';
import type { SendEasyBotMessageDto } from './dto/send-easybot-message.dto.js';
import {
  EasyBotAccount,
  EasyBotAccountDocument,
  EasyBotConnectionStatus,
} from './entities/easybot-account.entity.js';
import {
  EasyBotContact,
  EasyBotContactDocument,
} from './entities/easybot-contact.entity.js';
import {
  EasyBotMessage,
  EasyBotMessageDocument,
} from './entities/easybot-message.entity.js';

type AuthenticatedUser = AiUser & { role?: string };
type CompanyScope = {
  userId: string;
  companyId: string;
  role: UserRole;
};
type WhatsAppClient = InstanceType<typeof WhatsAppWeb.Client>;
type ClientRuntime = {
  client: WhatsAppClient;
  status: EasyBotConnectionStatus;
  qrCodeDataUrl?: string;
  disconnecting: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePhone(value: string): string {
  const phone = value.replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) {
    throw new BadRequestException(
      'Informe um número válido com código do país e DDD.',
    );
  }
  return phone;
}

function isDuplicatePhoneError(error: unknown): boolean {
  return (
    isRecord(error) &&
    error.code === 11000 &&
    isRecord(error.keyPattern) &&
    'phone' in error.keyPattern
  );
}

@Injectable()
export class EasyBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EasyBotService.name);
  private readonly clients = new Map<string, ClientRuntime>();

  constructor(
    @InjectModel(EasyBotAccount.name)
    private readonly accountModel: Model<EasyBotAccountDocument>,
    @InjectModel(EasyBotContact.name)
    private readonly contactModel: Model<EasyBotContactDocument>,
    @InjectModel(EasyBotMessage.name)
    private readonly messageModel: Model<EasyBotMessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly aiService: AiService,
  ) {}

  async onModuleInit() {
    const accounts = await this.accountModel
      .find({ phoneNumber: { $exists: true, $ne: '' } })
      .select('companyId')
      .lean()
      .exec();

    for (const account of accounts) {
      const companyId = String(account.companyId);
      this.initializeClient(companyId).catch((error: unknown) => {
        this.logger.error(
          `Não foi possível restaurar a sessão EasyBot da empresa ${companyId}.`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }
  }

  async onModuleDestroy() {
    const runtimes = [...this.clients.entries()];
    this.clients.clear();
    await Promise.all(
      runtimes.map(async ([companyId, runtime]) => {
        try {
          await runtime.client.destroy();
        } catch (error) {
          this.logger.error(
            `Não foi possível encerrar o cliente EasyBot da empresa ${companyId}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }

  async getConnectionStatus(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    const account = await this.accountModel
      .findOne({ companyId: scope.companyId })
      .lean()
      .exec();
    const runtime = this.clients.get(scope.companyId);

    return {
      status: runtime?.status ?? account?.status ?? 'disconnected',
      phoneNumber: account?.phoneNumber ?? null,
      qrCodeDataUrl: runtime?.qrCodeDataUrl ?? null,
      lastError: account?.lastError ?? null,
    };
  }

  async connect(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    const account = await this.accountModel
      .findOneAndUpdate(
        { companyId: scope.companyId },
        {
          $set: { status: 'connecting', lastError: null },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!this.clients.has(scope.companyId)) {
      this.initializeClient(scope.companyId).catch((error: unknown) => {
        this.logger.error(
          `Não foi possível conectar o WhatsApp da empresa ${scope.companyId}.`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }

    return {
      status: account.status,
      phoneNumber: account.phoneNumber ?? null,
      qrCodeDataUrl: null,
      lastError: null,
    };
  }

  async disconnect(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    const runtime = this.clients.get(scope.companyId);
    if (runtime) {
      runtime.disconnecting = true;
      runtime.status = 'disconnected';
      runtime.qrCodeDataUrl = undefined;
      this.clients.delete(scope.companyId);
      try {
        await runtime.client.logout();
      } catch (error) {
        this.logger.warn(
          `A sessão WhatsApp da empresa ${scope.companyId} não concluiu o logout; encerrando o cliente local.`,
        );
        try {
          await runtime.client.destroy();
        } catch (destroyError) {
          this.logger.error(
            `Não foi possível encerrar o cliente EasyBot da empresa ${scope.companyId}.`,
            destroyError instanceof Error ? destroyError.stack : undefined,
          );
        }
        await this.updateAccount(scope.companyId, {
          status: 'error',
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'Não foi possível encerrar a sessão do WhatsApp.',
          phoneNumber: null,
        });
        throw new BadGatewayException(
          'Não foi possível desconectar o WhatsApp. Tente novamente.',
        );
      }
    }

    await this.updateAccount(scope.companyId, {
      status: 'disconnected',
      phoneNumber: null,
      lastError: null,
    });
    return { status: 'disconnected' };
  }

  async listContacts(user: AuthenticatedUser) {
    const scope = await this.getAdminScope(user);
    return this.contactModel
      .find({ companyId: scope.companyId })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async createContact(user: AuthenticatedUser, dto: CreateEasyBotContactDto) {
    const scope = await this.getAdminScope(user);
    try {
      return await new this.contactModel({
        companyId: scope.companyId,
        name: dto.name.trim(),
        phone: normalizePhone(dto.phone),
        autoReplyEnabled: dto.autoReplyEnabled ?? true,
      }).save();
    } catch (error) {
      if (isDuplicatePhoneError(error)) {
        throw new ConflictException(
          'Este número já está cadastrado nos contatos da empresa.',
        );
      }
      throw error;
    }
  }

  async updateContact(
    user: AuthenticatedUser,
    contactId: string,
    dto: UpdateEasyBotContactDto,
  ) {
    const scope = await this.getAdminScope(user);
    if (!Types.ObjectId.isValid(contactId)) {
      throw new BadRequestException('O identificador do contato é inválido.');
    }
    const updates: Record<string, string | boolean> = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.phone !== undefined) updates.phone = normalizePhone(dto.phone);
    if (dto.autoReplyEnabled !== undefined) {
      updates.autoReplyEnabled = dto.autoReplyEnabled;
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }
    try {
      const contact = await this.contactModel
        .findOneAndUpdate(
          { _id: contactId, companyId: scope.companyId },
          { $set: updates },
          { new: true, runValidators: true },
        )
        .exec();
      if (!contact) throw new NotFoundException('Contato não encontrado.');
      return contact;
    } catch (error) {
      if (isDuplicatePhoneError(error)) {
        throw new ConflictException(
          'Este número já está cadastrado nos contatos da empresa.',
        );
      }
      throw error;
    }
  }

  async deleteContact(user: AuthenticatedUser, contactId: string) {
    const scope = await this.getAdminScope(user);
    if (!Types.ObjectId.isValid(contactId)) {
      throw new BadRequestException('O identificador do contato é inválido.');
    }
    const contact = await this.contactModel
      .findOneAndDelete({ _id: contactId, companyId: scope.companyId })
      .exec();
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    return { deleted: true };
  }

  async listMessages(user: AuthenticatedUser, contactId: string) {
    const scope = await this.getAdminScope(user);
    const contact = await this.findContact(scope.companyId, contactId);
    const messages = await this.messageModel
      .find({ companyId: scope.companyId, contactId: contact._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    return messages.reverse();
  }

  async sendMessage(user: AuthenticatedUser, dto: SendEasyBotMessageDto) {
    const scope = await this.getAdminScope(user);
    const contact = await this.findContact(scope.companyId, dto.contactId);
    const runtime = this.clients.get(scope.companyId);
    if (!runtime || runtime.status !== 'ready') {
      throw new ConflictException(
        'Conecte o WhatsApp antes de enviar mensagens.',
      );
    }
    const content = dto.message.trim();
    if (!content)
      throw new BadRequestException('A mensagem não pode estar vazia.');

    const message = new this.messageModel({
      companyId: scope.companyId,
      contactId: contact._id,
      phone: contact.phone,
      direction: 'outgoing',
      content,
      status: 'sending',
    });
    await message.save();
    try {
      await runtime.client.sendMessage(`${contact.phone}@c.us`, content);
      message.status = 'sent';
      await message.save();
      return message;
    } catch (error) {
      message.status = 'failed';
      message.error =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Não foi possível enviar a mensagem.';
      await message.save();
      throw new BadGatewayException(
        'O WhatsApp não conseguiu enviar a mensagem. Verifique a conexão e tente novamente.',
      );
    }
  }

  private async getScope(user: AuthenticatedUser): Promise<CompanyScope> {
    const userId = user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('A sessão do usuário é inválida.');
    }
    const currentUser = await this.userModel
      .findById(userId)
      .select('company role')
      .exec();
    if (!currentUser) {
      throw new UnauthorizedException('A conta do usuário não foi encontrada.');
    }
    const companyId = currentUser?.company?.toString();
    if (!companyId || !Types.ObjectId.isValid(companyId)) {
      throw new ForbiddenException(
        'O usuário não está associado a uma empresa.',
      );
    }
    const tokenCompanyId = user.companyId ?? user.empresaid;
    if (
      tokenCompanyId !== undefined &&
      (!Types.ObjectId.isValid(tokenCompanyId) ||
        tokenCompanyId.toLowerCase() !== companyId.toLowerCase())
    ) {
      throw new UnauthorizedException(
        'A empresa da sessão não corresponde ao cadastro do usuário. Entre novamente.',
      );
    }
    return { userId, companyId, role: currentUser.role };
  }

  private async getAdminScope(user: AuthenticatedUser) {
    const scope = await this.getScope(user);
    if (scope.role !== UserRole.ADMINISTRADOR) {
      throw new ForbiddenException(
        'Somente o administrador da empresa pode gerenciar o EasyBot.',
      );
    }
    return scope;
  }

  private async findContact(companyId: string, contactId: string) {
    if (!Types.ObjectId.isValid(contactId)) {
      throw new BadRequestException('O identificador do contato é inválido.');
    }
    const contact = await this.contactModel
      .findOne({ _id: contactId, companyId })
      .exec();
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    return contact;
  }

  private async initializeClient(companyId: string) {
    const existing = this.clients.get(companyId);
    if (existing) return existing;

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    const client = new WhatsAppWeb.Client({
      authStrategy: new WhatsAppWeb.LocalAuth({
        clientId: companyId,
        dataPath: resolve(
          process.env.WHATSAPP_SESSION_PATH?.trim() || '.whatsapp-sessions',
        ),
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(executablePath ? { executablePath } : {}),
      },
    });
    const runtime: ClientRuntime = {
      client,
      status: 'connecting',
      disconnecting: false,
    };
    this.clients.set(companyId, runtime);

    client.on('qr', (qr: string) => {
      runtime.status = 'qr';
      runtime.qrCodeDataUrl = undefined;
      this.updateAccount(companyId, {
        status: 'qr',
        lastError: null,
      }).catch((error: unknown) => this.logClientError(companyId, error));
      QRCode.toDataURL(qr)
        .then((dataUrl) => {
          if (this.clients.get(companyId) === runtime) {
            runtime.qrCodeDataUrl = dataUrl;
          }
        })
        .catch((error: unknown) => {
          this.logger.error(
            `Não foi possível gerar o QR Code do EasyBot da empresa ${companyId}.`,
            error instanceof Error ? error.stack : undefined,
          );
        });
    });
    client.on('authenticated', () => {
      runtime.status = 'connecting';
      runtime.qrCodeDataUrl = undefined;
      this.updateAccount(companyId, {
        status: 'connecting',
        lastError: null,
      }).catch((error: unknown) => this.logClientError(companyId, error));
    });
    client.on('ready', () => {
      runtime.status = 'ready';
      runtime.qrCodeDataUrl = undefined;
      const phoneNumber = client.info.wid.user;
      this.updateAccount(companyId, {
        status: 'ready',
        phoneNumber,
        connectedAt: new Date(),
        lastError: null,
      }).catch((error: unknown) => this.logClientError(companyId, error));
    });
    client.on('auth_failure', (message: string) => {
      runtime.status = 'error';
      runtime.qrCodeDataUrl = undefined;
      this.updateAccount(companyId, {
        status: 'error',
        lastError: message.slice(0, 500),
      }).catch((error: unknown) => this.logClientError(companyId, error));
    });
    client.on('disconnected', (reason: string) => {
      runtime.status = 'disconnected';
      runtime.qrCodeDataUrl = undefined;
      if (this.clients.get(companyId) === runtime) {
        this.clients.delete(companyId);
      }
      if (!runtime.disconnecting) {
        this.updateAccount(companyId, {
          status: 'disconnected',
          lastError: reason.slice(0, 500),
        }).catch((error: unknown) => this.logClientError(companyId, error));
      }
    });
    client.on('message', (message: WhatsAppMessage) => {
      this.handleIncomingMessage(companyId, message).catch((error: unknown) => {
        this.logger.error(
          `Não foi possível processar uma mensagem recebida pelo EasyBot da empresa ${companyId}.`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    });

    try {
      await client.initialize();
      return runtime;
    } catch (error) {
      runtime.status = 'error';
      if (this.clients.get(companyId) === runtime) {
        this.clients.delete(companyId);
      }
      try {
        await client.destroy();
      } catch (destroyError) {
        this.logger.error(
          `Não foi possível encerrar uma inicialização incompleta do EasyBot para a empresa ${companyId}.`,
          destroyError instanceof Error ? destroyError.stack : undefined,
        );
      }
      const detail =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Não foi possível inicializar o WhatsApp Web.';
      await this.updateAccount(companyId, {
        status: 'error',
        lastError: detail,
      });
      throw error;
    }
  }

  private async handleIncomingMessage(
    companyId: string,
    incoming: WhatsAppMessage,
  ) {
    if (
      incoming.fromMe ||
      !incoming.from.endsWith('@c.us') ||
      !incoming.body.trim()
    ) {
      return;
    }
    if (incoming.body.length > 4096) {
      this.logger.warn(
        `Mensagem recebida pelo EasyBot da empresa ${companyId} excede o limite de respostas automáticas.`,
      );
      return;
    }
    const phone = normalizePhone(incoming.from.slice(0, -5));
    const contact = await this.contactModel
      .findOne({ companyId, phone, autoReplyEnabled: true })
      .exec();
    if (!contact) return;

    const receivedMessage = new this.messageModel({
      companyId,
      contactId: contact._id,
      phone,
      direction: 'incoming',
      content: incoming.body.slice(0, 4096),
      status: 'received',
    });
    await receivedMessage.save();

    const recentMessages = await this.messageModel
      .find({ companyId, contactId: contact._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();
    const owner = await this.userModel
      .findOne({ company: companyId, role: UserRole.ADMINISTRADOR })
      .select('_id')
      .sort({ createdAt: 1 })
      .exec();
    if (!owner) {
      throw new NotFoundException(
        'Não foi possível encontrar o administrador da empresa para responder pelo EasyBot.',
      );
    }
    const history = recentMessages.reverse().map((message) => ({
      role:
        message.direction === 'incoming'
          ? ('user' as const)
          : ('assistant' as const),
      content: message.content,
    }));
    const reply = await this.aiService.replyForWhatsApp(
      { userId: owner.id, companyId },
      contact.name,
      history,
    );
    const runtime = this.clients.get(companyId);
    if (!runtime || runtime.status !== 'ready') {
      throw new ConflictException(
        'O WhatsApp foi desconectado antes de a resposta ser enviada.',
      );
    }
    const responseMessage = new this.messageModel({
      companyId,
      contactId: contact._id,
      phone,
      direction: 'outgoing',
      content: reply,
      status: 'sending',
    });
    await responseMessage.save();
    try {
      await runtime.client.sendMessage(`${phone}@c.us`, reply);
      responseMessage.status = 'sent';
      await responseMessage.save();
    } catch (error) {
      responseMessage.status = 'failed';
      responseMessage.error =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Não foi possível enviar a resposta automática.';
      await responseMessage.save();
      throw error;
    }
  }

  private async updateAccount(
    companyId: string,
    updates: Record<string, unknown>,
  ) {
    await this.accountModel
      .findOneAndUpdate(
        { companyId },
        {
          $set: updates,
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private logClientError(companyId: string, error: unknown) {
    this.logger.error(
      `Não foi possível atualizar o estado do EasyBot da empresa ${companyId}.`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
