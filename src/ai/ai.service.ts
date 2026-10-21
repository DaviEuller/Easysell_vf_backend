import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { readFileSync } from 'node:fs';
import { Types } from 'mongoose';
import type { Connection, Model } from 'mongoose';
import {
  AiConversation,
} from './entities/ai-conversation.entity.js';
import type {
  AiConversationDocument,
  AiConversationMessage,
  PendingAiAction,
} from './entities/ai-conversation.entity.js';
import {
  Cliente,
} from '../clientes/Schemas/clientes.schemas.js';
import type { ClienteDocument } from '../clientes/Schemas/clientes.schemas.js';
import {
  Produto,
} from '../produtos/Schemas/Schemas.produtos.js';
import type { ProdutoDocument } from '../produtos/Schemas/Schemas.produtos.js';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';

type AiUser = {
  userId: string;
  companyId?: string;
  empresaid?: string;
};
type AgentConfig = {
  provider: string;
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxToolRounds: number;
  systemPrompt: string;
  tools: Record<string, unknown>[];
};
type ProviderToolCall = {
  id: string;
  function: { name: string; arguments: string };
};
type ProviderMessage = {
  content: string | null;
  toolCalls: ProviderToolCall[];
};

const WRITE_ACTIONS = new Set([
  'create_product',
  'update_product',
  'set_product_stock',
  'create_sale',
  'update_customer',
  'update_sale',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAgentConfig(): AgentConfig {
  const value: unknown = JSON.parse(
    readFileSync(new URL('./agent.json', import.meta.url), 'utf8'),
  );
  if (!isRecord(value)) {
    throw new Error('A configuração src/ai/agent.json é inválida.');
  }
  const {
    provider,
    baseUrl,
    apiKeyEnv,
    model,
    temperature,
    maxTokens,
    maxToolRounds,
    systemPrompt,
    tools,
  } = value;
  if (
    typeof provider !== 'string' ||
    typeof baseUrl !== 'string' ||
    typeof apiKeyEnv !== 'string' ||
    typeof model !== 'string' ||
    typeof temperature !== 'number' ||
    typeof maxTokens !== 'number' ||
    typeof maxToolRounds !== 'number' ||
    typeof systemPrompt !== 'string' ||
    !Array.isArray(tools) ||
    !tools.every(isRecord)
  ) {
    throw new Error('A configuração src/ai/agent.json é inválida.');
  }
  return {
    provider,
    baseUrl,
    apiKeyEnv,
    model,
    temperature,
    maxTokens,
    maxToolRounds,
    systemPrompt,
    tools,
  };
}

@Injectable()
export class AiService {
  private readonly agent = parseAgentConfig();

  constructor(
    @InjectModel(AiConversation.name)
    private readonly conversationModel: Model<AiConversationDocument>,
    @InjectModel(Produto.name)
    private readonly productModel: Model<ProdutoDocument>,
    @InjectModel(Cliente.name)
    private readonly saleModel: Model<ClienteDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async chat(user: AiUser, prompt: string, conversationId?: string) {
    const scope = await this.getScope(user);
    this.assertProviderConfiguration();
    let conversation: AiConversationDocument;

    if (conversationId) {
      conversation = await this.findConversation(scope, conversationId);
      if (conversation.pendingAction) {
        throw new ConflictException(
          'Confirme ou recuse a ação pendente antes de enviar outra mensagem.',
        );
      }
    } else {
      conversation = new this.conversationModel({
        userId: scope.userId,
        companyId: scope.companyId,
        title: prompt.trim().slice(0, 80),
        messages: [],
        pendingAction: null,
      });
    }

    conversation.messages.push({
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    });

    for (let round = 0; round < this.agent.maxToolRounds; round += 1) {
      const response = await this.requestModel(conversation.messages);
      if (response.toolCalls.length === 0) {
        if (!response.content?.trim()) {
          throw new BadGatewayException(
            'O provedor de IA retornou uma resposta vazia.',
          );
        }
        conversation.messages.push({
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
        });
        await conversation.save();
        return {
          conversation: this.toConversation(conversation),
          assistantMessage: response.content,
          pendingAction: null,
          model: this.getModelName(),
        };
      }

      if (response.toolCalls.length !== 1) {
        throw new BadGatewayException(
          'O provedor retornou várias ações simultâneas; envie a solicitação novamente.',
        );
      }

      const toolCall = response.toolCalls[0];
      const args = this.parseToolArguments(toolCall.function.arguments);
      const assistantMessage: AiConversationMessage = {
        role: 'assistant',
        content: response.content,
        tool_calls: [toolCall],
        timestamp: new Date().toISOString(),
      };

      if (toolCall.function.name === 'create_product') {
        this.validateProposedAction(toolCall.function.name, args);
        const result = await this.executeWriteAction(
          toolCall.function.name,
          args,
          scope.companyId,
        );
        const assistantText = 'Produto cadastrado com sucesso.';
        conversation.messages.push(assistantMessage);
        conversation.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result),
          timestamp: new Date().toISOString(),
        });
        conversation.messages.push({
          role: 'assistant',
          content: assistantText,
          timestamp: new Date().toISOString(),
        });
        await conversation.save();
        return {
          conversation: this.toConversation(conversation),
          assistantMessage: assistantText,
          pendingAction: null,
          model: this.getModelName(),
          result,
        };
      }

      if (WRITE_ACTIONS.has(toolCall.function.name)) {
        this.validateProposedAction(toolCall.function.name, args);
        const pendingAction: PendingAiAction = {
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: args,
          status: 'pending',
          createdAt: new Date(),
        };
        conversation.messages.push({
          ...assistantMessage,
          content: `A Sellia preparou uma proposta de ${toolCall.function.name}. Confira os dados abaixo e escolha confirmar ou recusar.`,
        });
        conversation.pendingAction = pendingAction;
        await conversation.save();
        return {
          conversation: this.toConversation(conversation),
          assistantMessage: conversation.messages.at(-1)?.content,
          pendingAction,
          model: this.getModelName(),
        };
      }

      const result = await this.executeReadAction(
        toolCall.function.name,
        args,
        scope.companyId,
      );
      conversation.messages.push(assistantMessage);
      conversation.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result),
        timestamp: new Date().toISOString(),
      });
    }

    throw new BadGatewayException(
      'A Sellia atingiu o limite de consultas nesta resposta. Tente uma pergunta mais específica.',
    );
  }

  async listConversations(user: AiUser) {
    const scope = await this.getScope(user);
    const conversations = await this.conversationModel
      .find(scope)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('_id title updatedAt messages pendingAction')
      .exec();

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      lastMessage:
        [...conversation.messages]
          .reverse()
          .find((message) => message.role !== 'tool')?.content ?? '',
      pendingAction: conversation.pendingAction,
    }));
  }

  async getConversation(user: AiUser, conversationId: string) {
    const scope = await this.getScope(user);
    const conversation = await this.findConversation(scope, conversationId);
    return this.toConversation(conversation);
  }

  async confirmAction(
    user: AiUser,
    conversationId: string,
    actionId: string,
  ) {
    const scope = await this.getScope(user);
    const currentUser = await this.userModel
      .findById(scope.userId)
      .select('role')
      .exec();
    if (currentUser?.role !== UserRole.ADMINISTRADOR) {
      throw new ForbiddenException(
        'Somente o administrador da empresa pode confirmar alterações.',
      );
    }
    await this.findConversation(scope, conversationId);
    const conversation = await this.conversationModel
      .findOneAndUpdate(
        {
          _id: conversationId,
          ...scope,
          'pendingAction.id': actionId,
          'pendingAction.status': 'pending',
        },
        { $set: { 'pendingAction.status': 'executing' } },
        { new: true },
      )
      .exec();
    const action = conversation?.pendingAction;
    if (!conversation || !action) {
      throw new ConflictException(
        'A ação não está mais pendente ou já está sendo processada.',
      );
    }

    let result: unknown;
    try {
      result = await this.executeWriteAction(
        action.name,
        action.arguments,
        scope.companyId,
      );
    } catch (error) {
      await this.conversationModel
        .updateOne(
          {
            _id: conversationId,
            ...scope,
            'pendingAction.id': actionId,
            'pendingAction.status': 'executing',
          },
          { $set: { pendingAction: { ...action, status: 'pending' } } },
        )
        .exec();
      throw error;
    }
    const resultText = `Ação ${action.name} executada com confirmação.`;
    const completedConversation = await this.conversationModel
      .findOneAndUpdate(
        {
          _id: conversationId,
          ...scope,
          'pendingAction.id': actionId,
          'pendingAction.status': 'executing',
        },
        {
          $set: { pendingAction: null },
          $push: {
            messages: {
              $each: [
                {
                  role: 'tool',
                  tool_call_id: action.id,
                  name: action.name,
                  content: JSON.stringify(result),
                  timestamp: new Date().toISOString(),
                },
                {
                  role: 'assistant',
                  content: resultText,
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!completedConversation) {
      throw new ConflictException(
        'A ação foi processada, mas a conversa mudou. Verifique os dados antes de tentar novamente.',
      );
    }

    return {
      conversation: this.toConversation(completedConversation),
      assistantMessage: resultText,
      result,
    };
  }

  async rejectAction(
    user: AiUser,
    conversationId: string,
    actionId: string,
  ) {
    const scope = await this.getScope(user);
    const previousConversation = await this.findConversation(
      scope,
      conversationId,
    );
    const action = previousConversation.pendingAction;
    if (!action || action.id !== actionId) {
      throw new NotFoundException('A ação pendente não foi encontrada.');
    }
    const resultText = 'Ação cancelada. Nenhum dado foi alterado.';
    const conversation = await this.conversationModel
      .findOneAndUpdate(
        {
          _id: conversationId,
          ...scope,
          'pendingAction.id': actionId,
          'pendingAction.status': 'pending',
        },
        {
          $set: { pendingAction: null },
          $push: {
            messages: {
              $each: [
                {
                  role: 'tool',
                  tool_call_id: action.id,
                  name: action.name,
                  content: JSON.stringify({ cancelled: true }),
                  timestamp: new Date().toISOString(),
                },
                {
                  role: 'assistant',
                  content: resultText,
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!conversation || !action) {
      throw new ConflictException(
        'A ação não está mais pendente ou já está sendo processada.',
      );
    }

    return {
      conversation: this.toConversation(conversation),
      assistantMessage: resultText,
    };
  }

  private async getScope(user: AiUser) {
    const userId = user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException(
        'A sessão não contém um usuário válido para usar a Sellia.',
      );
    }
    const currentUser = await this.userModel
      .findById(userId)
      .select('company')
      .exec();
    const companyId = currentUser?.company?.toString();
    if (!companyId || !Types.ObjectId.isValid(companyId)) {
      throw new UnauthorizedException(
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
        'A empresa da sessão não corresponde ao cadastro do usuário. Faça login novamente.',
      );
    }
    return { userId, companyId };
  }

  private async findConversation(
    scope: { userId: string; companyId: string },
    conversationId: string,
  ) {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('O identificador da conversa é inválido.');
    }
    const conversation = await this.conversationModel
      .findOne({ _id: conversationId, ...scope })
      .exec();
    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    return conversation;
  }

  private toConversation(conversation: AiConversationDocument) {
    return {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages
        .filter(
          (message) =>
            message.role !== 'tool' &&
            (message.content !== null || message.role === 'user'),
        )
        .map((message) => ({
          role: message.role,
          content: message.content ?? '',
          timestamp: message.timestamp,
            ...(conversation.pendingAction?.status === 'pending' &&
            message.tool_calls?.some(
              (call) =>
                isRecord(call) && call.id === conversation.pendingAction?.id,
            )
              ? { pendingAction: conversation.pendingAction }
              : {}),
        })),
      pendingAction: conversation.pendingAction,
    };
  }

  private getModelName() {
    return process.env.AI_MODEL?.trim() || this.agent.model;
  }

  private getApiKey() {
    const apiKey = process.env[this.agent.apiKeyEnv]?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        `A chave de IA não está configurada. Defina ${this.agent.apiKeyEnv} no ambiente do backend.`,
      );
    }
    return apiKey;
  }

  private assertProviderConfiguration() {
    this.getApiKey();
    if (!(process.env.AI_API_BASE_URL?.trim() || this.agent.baseUrl)) {
      throw new BadRequestException(
        'Configure a URL base do provedor em AI_API_BASE_URL ou src/ai/agent.json.',
      );
    }
    if (!this.getModelName()) {
      throw new BadRequestException(
        'Configure o modelo de IA em AI_MODEL ou src/ai/agent.json.',
      );
    }
  }

  private async requestModel(
    messages: AiConversationMessage[],
  ): Promise<ProviderMessage> {
    this.assertProviderConfiguration();
    const apiKey = this.getApiKey();
    const baseUrl =
      process.env.AI_API_BASE_URL?.trim() || this.agent.baseUrl;

    let response: Response;
    try {
      response = await fetch(
        `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.getModelName(),
            messages: [
              { role: 'system', content: this.agent.systemPrompt },
              ...messages.slice(-50).map((message) => ({
                role: message.role,
                content: message.content,
                ...(message.tool_call_id
                  ? { tool_call_id: message.tool_call_id }
                  : {}),
                ...(message.name ? { name: message.name } : {}),
                ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
              })),
            ],
            tools: this.agent.tools,
            tool_choice: 'auto',
            parallel_tool_calls: false,
            temperature: this.agent.temperature,
            max_tokens: this.agent.maxTokens,
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
    } catch {
      throw new BadGatewayException(
        'Não foi possível conectar ao provedor de IA. Verifique a URL e tente novamente.',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        `O provedor de IA retornou uma resposta inválida (HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `O provedor de IA recusou a solicitação (HTTP ${response.status}). Verifique o modelo e a configuração da API.`,
      );
    }
    if (!isRecord(payload) || !Array.isArray(payload.choices)) {
      throw new BadGatewayException(
        'O provedor de IA retornou um formato de resposta inválido.',
      );
    }
    const choice = payload.choices[0];
    if (!isRecord(choice) || !isRecord(choice.message)) {
      throw new BadGatewayException(
        'O provedor de IA retornou uma resposta incompleta.',
      );
    }
    const content =
      typeof choice.message.content === 'string'
        ? choice.message.content
        : null;
    const callsValue = choice.message.tool_calls;
    const toolCalls: ProviderToolCall[] = [];
    if (callsValue !== undefined) {
      if (!Array.isArray(callsValue)) {
        throw new BadGatewayException(
          'O provedor de IA retornou ações em um formato inválido.',
        );
      }
      for (const item of callsValue) {
        if (
          !isRecord(item) ||
          typeof item.id !== 'string' ||
          !isRecord(item.function) ||
          typeof item.function.name !== 'string' ||
          typeof item.function.arguments !== 'string'
        ) {
          throw new BadGatewayException(
            'O provedor de IA retornou uma ação malformada.',
          );
        }
        toolCalls.push({
          id: item.id,
          function: {
            name: item.function.name,
            arguments: item.function.arguments,
          },
        });
      }
    }
    return { content, toolCalls };
  }

  private parseToolArguments(value: string) {
    if (value.length > 20_000) {
      throw new BadGatewayException(
        'Os argumentos da ação retornados pelo provedor são muito longos.',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadGatewayException(
        'O provedor de IA retornou argumentos de ação inválidos.',
      );
    }
    if (!isRecord(parsed)) {
      throw new BadGatewayException(
        'Os argumentos da ação precisam ser um objeto JSON.',
      );
    }
    return parsed;
  }

  private validateProposedAction(
    name: string,
    args: Record<string, unknown>,
  ) {
    switch (name) {
      case 'create_product': {
        this.requiredString(args, 'name');
        this.requiredString(args, 'category');
        this.requiredNumber(args, 'price');
        const stock = this.requiredNumber(args, 'stock');
        if (!Number.isInteger(stock)) {
          throw new BadGatewayException(
            'A Sellia propôs um estoque que não é um número inteiro.',
          );
        }
        return;
      }
      case 'update_product': {
        this.productId(args);
        const nameValue = this.optionalString(args, 'name');
        const category = this.optionalString(args, 'category');
        if (args.price !== undefined) this.requiredNumber(args, 'price');
        if (!nameValue && !category && args.price === undefined) {
          throw new BadGatewayException(
            'A Sellia não informou nenhum campo para atualizar.',
          );
        }
        return;
      }
      case 'set_product_stock': {
        this.productId(args);
        const quantity = this.requiredNumber(args, 'quantity');
        if (!Number.isInteger(quantity)) {
          throw new BadGatewayException(
            'A Sellia propôs uma quantidade de estoque inválida.',
          );
        }
        return;
      }
      case 'create_sale': {
        this.requiredString(args, 'customerName');
        this.requiredString(args, 'phone');
        this.productId(args);
        const quantity = this.requiredNumber(args, 'quantity', 1);
        if (!Number.isInteger(quantity)) {
          throw new BadGatewayException(
            'A Sellia propôs uma quantidade de venda inválida.',
          );
        }
        this.requiredNumber(args, 'unitPrice');
        return;
      }
      case 'update_customer': {
        this.assertSaleId(args);
        const customerName = this.optionalString(args, 'customerName');
        const phone = this.optionalString(args, 'phone');
        if (!customerName && !phone) {
          throw new BadGatewayException(
            'A Sellia não informou dados do cliente para atualizar.',
          );
        }
        return;
      }
      case 'update_sale': {
        this.assertSaleId(args);
        if (args.quantity !== undefined) {
          const quantity = this.requiredNumber(args, 'quantity', 1);
          if (!Number.isInteger(quantity)) {
            throw new BadGatewayException(
              'A Sellia propôs uma quantidade de venda inválida.',
            );
          }
        }
        if (args.unitPrice !== undefined) {
          this.requiredNumber(args, 'unitPrice');
        }
        if (args.quantity === undefined && args.unitPrice === undefined) {
          throw new BadGatewayException(
            'A Sellia não informou nenhum campo para atualizar.',
          );
        }
        return;
      }
      default:
        throw new BadGatewayException(
          `A ação "${name}" não está autorizada.`,
        );
    }
  }

  private assertSaleId(args: Record<string, unknown>) {
    const id = this.requiredString(args, 'saleId');
    if (!Types.ObjectId.isValid(id)) {
      throw new BadGatewayException('A Sellia propôs um identificador inválido.');
    }
  }

  private async executeReadAction(
    name: string,
    _args: Record<string, unknown>,
    companyId: string,
  ) {
    if (name === 'list_products') {
      return this.productModel
        .find({ companyId })
        .select('_id name categoria preco quantidade')
        .sort({ name: 1 })
        .limit(100)
        .lean()
        .exec();
    }
    if (name === 'list_sales') {
      return this.saleModel
        .find({ idcompany: companyId })
        .select('_id name IdProduto Preco_gasto Quantidade createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();
    }
    throw new BadRequestException(`A ferramenta de consulta "${name}" não é permitida.`);
  }

  private async executeWriteAction(
    name: string,
    args: Record<string, unknown>,
    companyId: string,
  ) {
    switch (name) {
      case 'create_product':
        return this.createProduct(args, companyId);
      case 'update_product':
        return this.updateProduct(args, companyId);
      case 'set_product_stock':
        return this.setProductStock(args, companyId);
      case 'create_sale':
        return this.createSale(args, companyId);
      case 'update_customer':
        return this.updateCustomer(args, companyId);
      case 'update_sale':
        return this.updateSale(args, companyId);
      default:
        throw new BadRequestException(
          `A ação "${name}" não está habilitada para execução.`,
        );
    }
  }

  private requiredString(args: Record<string, unknown>, key: string) {
    const value = args[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`O campo ${key} é obrigatório.`);
    }
    return value.trim();
  }

  private optionalString(args: Record<string, unknown>, key: string) {
    const value = args[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`O campo ${key} deve ser um texto válido.`);
    }
    return value.trim();
  }

  private requiredNumber(
    args: Record<string, unknown>,
    key: string,
    minimum = 0,
  ) {
    const value = args[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
      throw new BadRequestException(
        `O campo ${key} deve ser um número maior ou igual a ${minimum}.`,
      );
    }
    return value;
  }

  private productId(args: Record<string, unknown>) {
    const id = this.requiredString(args, 'productId');
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('O identificador do produto é inválido.');
    }
    return id;
  }

  private async createProduct(
    args: Record<string, unknown>,
    companyId: string,
  ) {
    const stock = this.requiredNumber(args, 'stock');
    if (!Number.isInteger(stock)) {
      throw new BadRequestException('O estoque precisa ser um número inteiro.');
    }
    const product = new this.productModel({
      name: this.requiredString(args, 'name'),
      categoria: this.requiredString(args, 'category'),
      companyId,
      preco: this.requiredNumber(args, 'price'),
      quantidade: stock,
    });
    return (await product.save()).toObject();
  }

  private async updateProduct(
    args: Record<string, unknown>,
    companyId: string,
  ) {
    const updates: Record<string, string | number> = {};
    const name = this.optionalString(args, 'name');
    const category = this.optionalString(args, 'category');
    if (name) updates.name = name;
    if (category) updates.categoria = category;
    if (args.price !== undefined) {
      updates.preco = this.requiredNumber(args, 'price');
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('Informe ao menos um campo para editar.');
    }
    const product = await this.productModel
      .findOneAndUpdate(
        { _id: this.productId(args), companyId },
        { $set: updates },
        { new: true, runValidators: true },
      )
      .exec();
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product.toObject();
  }

  private async setProductStock(
    args: Record<string, unknown>,
    companyId: string,
  ) {
    const quantity = this.requiredNumber(args, 'quantity');
    if (!Number.isInteger(quantity)) {
      throw new BadRequestException('O estoque precisa ser um número inteiro.');
    }
    const product = await this.productModel
      .findOneAndUpdate(
        { _id: this.productId(args), companyId },
        { $set: { quantidade: quantity } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product.toObject();
  }

  private async createSale(
    args: Record<string, unknown>,
    companyId: string,
  ) {
    const quantity = this.requiredNumber(args, 'quantity', 1);
    if (!Number.isInteger(quantity)) {
      throw new BadRequestException('A quantidade precisa ser um número inteiro.');
    }
    const productId = this.productId(args);
    const session = await this.connection.startSession();
    try {
      let sale: ClienteDocument | undefined;
      await session.withTransaction(async () => {
        const product = await this.productModel
          .findOne({ _id: productId, companyId })
          .session(session)
          .exec();
        if (!product) throw new NotFoundException('Produto não encontrado.');
        if (quantity > Number(product.quantidade)) {
          throw new BadRequestException(
            `Estoque insuficiente. Disponível: ${product.quantidade}.`,
          );
        }
        product.quantidade = Number(product.quantidade) - quantity;
        await product.save({ session });
        sale = new this.saleModel({
          name: this.requiredString(args, 'customerName'),
          Numero: this.requiredString(args, 'phone'),
          IdProduto: productId,
          idcompany: companyId,
          Quantidade: quantity,
          Preco_gasto:
            this.requiredNumber(args, 'unitPrice') * quantity,
        });
        await sale.save({ session });
      });
      if (!sale) throw new Error('A transação não criou a venda.');
      return sale.toObject();
    } finally {
      await session.endSession();
    }
  }

  private async updateCustomer(
    args: Record<string, unknown>,
    companyId: string,
  ) {
    const saleId = this.requiredString(args, 'saleId');
    if (!Types.ObjectId.isValid(saleId)) {
      throw new BadRequestException('O identificador da venda é inválido.');
    }
    const updates: Record<string, string> = {};
    const name = this.optionalString(args, 'customerName');
    const phone = this.optionalString(args, 'phone');
    if (name) updates.name = name;
    if (phone) updates.Numero = phone;
    if (!Object.keys(updates).length) {
      throw new BadRequestException(
        'Informe o nome ou telefone do cliente para editar.',
      );
    }
    const sale = await this.saleModel
      .findOneAndUpdate(
        { _id: saleId, idcompany: companyId },
        { $set: updates },
        { new: true, runValidators: true },
      )
      .exec();
    if (!sale) throw new NotFoundException('Cliente/venda não encontrado.');
    return sale.toObject();
  }

  private async updateSale(
    args: Record<string, unknown>,
    companyId: string,
  ) {
    const saleId = this.requiredString(args, 'saleId');
    if (!Types.ObjectId.isValid(saleId)) {
      throw new BadRequestException('O identificador da venda é inválido.');
    }
    const session = await this.connection.startSession();
    try {
      let updatedSale: ClienteDocument | undefined;
      await session.withTransaction(async () => {
        const sale = await this.saleModel
          .findOne({ _id: saleId, idcompany: companyId })
          .session(session)
          .exec();
        if (!sale) throw new NotFoundException('Venda não encontrada.');
        const productId = String(sale.IdProduto);
        if (!Types.ObjectId.isValid(productId)) {
          throw new BadRequestException(
            'A venda não possui um produto válido para atualizar o estoque.',
          );
        }
        const product = await this.productModel
          .findOne({ _id: productId, companyId })
          .session(session)
          .exec();
        if (!product) throw new NotFoundException('Produto da venda não encontrado.');

        const oldQuantity = Number(sale.Quantidade);
        const quantity =
          args.quantity === undefined
            ? oldQuantity
            : this.requiredNumber(args, 'quantity', 1);
        if (!Number.isInteger(quantity)) {
          throw new BadRequestException('A quantidade precisa ser um número inteiro.');
        }
        const unitPrice =
          args.unitPrice === undefined
            ? oldQuantity > 0
              ? Number(sale.Preco_gasto) / oldQuantity
              : 0
            : this.requiredNumber(args, 'unitPrice');
        const stockDelta = oldQuantity - quantity;
        if (stockDelta < 0 && -stockDelta > Number(product.quantidade)) {
          throw new BadRequestException(
            `Estoque insuficiente. Disponível: ${product.quantidade}.`,
          );
        }
        product.quantidade = Number(product.quantidade) + stockDelta;
        await product.save({ session });
        sale.Quantidade = quantity;
        sale.Preco_gasto = unitPrice * quantity;
        updatedSale = await sale.save({ session });
      });
      if (!updatedSale) throw new Error('A transação não atualizou a venda.');
      return updatedSale.toObject();
    } finally {
      await session.endSession();
    }
  }
}
