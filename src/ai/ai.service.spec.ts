import { readFileSync } from 'node:fs';
import { Model, Types } from 'mongoose';
import { vi } from 'vitest';
import { AiService } from './ai.service.js';
import {
  AiConversationDocument,
  AiConversationMessage,
  PendingAiAction,
} from './entities/ai-conversation.entity.js';
import { ClienteDocument } from '../clientes/Schemas/clientes.schemas.js';
import { ProdutoDocument } from '../produtos/Schemas/Schemas.produtos.js';
import { EmployeeDocument } from '../company/schemas/employee.schema.js';
import { CompanyDocument } from '../company/schemas/company.schema.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { UserRole } from '../users/enum/user.role.enum.js';

const companyId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const agentConfig = JSON.parse(
  readFileSync(new URL('./agent.json', import.meta.url), 'utf8'),
) as { model: string };

class ConversationModelMock {
  static findOne = vi.fn();
  static findOneAndUpdate = vi.fn();

  id = '507f1f77bcf86cd799439013';
  updatedAt = new Date();
  title = '';
  userId = '';
  companyId = '';
  messages: AiConversationMessage[] = [];
  pendingAction: PendingAiAction | null = null;

  constructor(values: Partial<ConversationModelMock>) {
    Object.assign(this, values);
  }

  async save() {
    return this;
  }
}

describe('AiService', () => {
  let service: AiService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let productModel: Model<ProdutoDocument>;
  let employeeModel: Model<EmployeeDocument>;
  let companyModel: Model<CompanyDocument>;
  let previousApiKey: string | undefined;
  let previousBaseUrl: string | undefined;
  let previousModel: string | undefined;
  let previousAiServiceUrl: string | undefined;
  let previousAiServiceKey: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.GROQ_API_KEY;
    previousBaseUrl = process.env.AI_API_BASE_URL;
    previousModel = process.env.AI_MODEL;
    previousAiServiceUrl = process.env.AI_SERVICE_URL;
    previousAiServiceKey = process.env.AI_SERVICE_KEY;
    process.env.GROQ_API_KEY = 'test-api-key';
    process.env.AI_API_BASE_URL = 'https://ai.example.test/v1';
    delete process.env.AI_SERVICE_URL;
    delete process.env.AI_SERVICE_KEY;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const userModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue({
            company: new Types.ObjectId(companyId),
            role: UserRole.ADMINISTRADOR,
          }),
        })),
      })),
    };
    ConversationModelMock.findOne.mockReset();
    ConversationModelMock.findOneAndUpdate.mockReset();
    productModel = vi.fn() as unknown as Model<ProdutoDocument>;
    employeeModel = vi.fn() as unknown as Model<EmployeeDocument>;
    companyModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          lean: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue({
              _id: companyId,
              name: 'Empresa Teste',
              categoria: 'Varejo',
            }),
          })),
        })),
      })),
    } as unknown as Model<CompanyDocument>;
    service = new AiService(
      ConversationModelMock as unknown as Model<AiConversationDocument>,
      productModel,
      {} as Model<ClienteDocument>,
      employeeModel,
      companyModel,
      userModel as unknown as Model<UserDocument>,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (previousApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.AI_API_BASE_URL;
    else process.env.AI_API_BASE_URL = previousBaseUrl;
    if (previousModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = previousModel;
    if (previousAiServiceUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = previousAiServiceUrl;
    if (previousAiServiceKey === undefined) delete process.env.AI_SERVICE_KEY;
    else process.env.AI_SERVICE_KEY = previousAiServiceKey;
  });

  it('creates a product in Mongo when the model calls create_product', async () => {
    const conversationSave = vi.spyOn(ConversationModelMock.prototype, 'save');
    const createdProduct = {
      _id: '507f1f77bcf86cd799439014',
      name: 'Caderno',
      categoria: 'Papelaria',
      companyId,
      preco: 12.5,
      quantidade: 8,
    };
    const save = vi.fn().mockResolvedValue({
      toObject: () => createdProduct,
    });
    const productConstructor = productModel as unknown as ReturnType<
      typeof vi.fn
    >;
    productConstructor.mockImplementation(function (
      _values: Record<string, unknown>,
    ) {
      return { save };
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_create_product',
                    function: {
                      name: 'create_product',
                      arguments: JSON.stringify({
                        name: 'Caderno',
                        category: 'Papelaria',
                        price: 12.5,
                        stock: 8,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await service.chat(
      { userId, companyId },
      'Cadastre um caderno.',
    );

    expect(result.pendingAction).toBeNull();
    expect(result.result).toEqual(createdProduct);
    expect(result.assistantMessage).toBe('Produto cadastrado com sucesso.');
    expect(productConstructor).toHaveBeenCalledOnce();
    expect(productConstructor).toHaveBeenCalledWith({
      name: 'Caderno',
      categoria: 'Papelaria',
      companyId,
      preco: 12.5,
      quantidade: 8,
    });
    expect(save).toHaveBeenCalledOnce();
    expect(conversationSave).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as { model: string; messages: Record<string, unknown>[] };
    expect(requestBody.model).toBe(
      process.env.AI_MODEL?.trim() || agentConfig.model,
    );
    expect(requestBody.messages[1]).toEqual({
      role: 'user',
      content: 'Cadastre um caderno.',
    });
  });

  it('proposes a Mercado Livre listing and waits for administrator confirmation', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_marketplace_product',
                    function: {
                      name: 'create_marketplace_product',
                      arguments: JSON.stringify({
                        name: 'Caderno',
                        category: 'Papelaria',
                        price: 39.9,
                        stock: 5,
                        listing: {
                          categoryId: 'MLB1234',
                          condition: 'new',
                          listingTypeId: 'gold_special',
                          pictures: ['https://cdn.example.test/caderno.jpg'],
                          shippingMode: 'me2',
                          freeShipping: false,
                          localPickup: false,
                          attributes: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await service.chat(
      { userId, companyId },
      'Cadastre este produto no Mercado Livre.',
    );

    expect(result.pendingAction).toMatchObject({
      name: 'create_marketplace_product',
      status: 'pending',
      arguments: {
        name: 'Caderno',
        listing: { categoryId: 'MLB1234' },
      },
    });

    const action = result.pendingAction as PendingAiAction;
    const pendingConversation = new ConversationModelMock({
      pendingAction: action,
      userId,
      companyId,
    });
    const executingConversation = new ConversationModelMock({
      pendingAction: { ...action, status: 'executing' },
      userId,
      companyId,
    });
    const completedConversation = new ConversationModelMock({
      pendingAction: null,
      userId,
      companyId,
    });
    const publicationResult = {
      productId: '507f1f77bcf86cd799439016',
      publication: { status: 'published', itemId: 'MLB1234567890' },
    };
    const publishProduct = vi.fn().mockResolvedValue(publicationResult);
    Object.assign(service, {
      moduleRef: {
        get: vi.fn(() => ({ createAndPublishProduct: publishProduct })),
      },
    });
    ConversationModelMock.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(pendingConversation),
    });
    ConversationModelMock.findOneAndUpdate
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(executingConversation),
      })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(completedConversation),
      });

    const confirmed = await service.confirmAction(
      { userId, companyId },
      result.conversation.id,
      action.id,
    );

    expect(publishProduct).toHaveBeenCalledWith(
      { userId, companyId },
      expect.objectContaining({
        name: 'Caderno',
        listing: expect.objectContaining({ categoryId: 'MLB1234' }),
      }),
    );
    expect(confirmed.result).toEqual(publicationResult);
    expect(confirmed.assistantMessage).toBe(
      'Produto cadastrado e anúncio publicado no Mercado Livre.',
    );
  });

  it('rejects an authenticated company ID that differs from the user record', async () => {
    await expect(
      service.chat(
        { userId, companyId: '507f1f77bcf86cd799439099' },
        'Liste meus produtos.',
      ),
    ).rejects.toThrow(
      'A empresa da sessão não corresponde ao cadastro do usuário. Faça login novamente.',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proposes an employee registration for explicit confirmation', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_create_employee',
                    function: {
                      name: 'create_employee',
                      arguments: JSON.stringify({
                        name: 'Ana Silva',
                        cpf: '12345678901',
                        funcao: 'Vendedora',
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await service.chat(
      { userId, companyId },
      'Cadastre Ana Silva, CPF 12345678901, como vendedora.',
    );

    expect(result.pendingAction).toMatchObject({
      name: 'create_employee',
      status: 'pending',
      arguments: {
        name: 'Ana Silva',
        cpf: '12345678901',
        funcao: 'Vendedora',
      },
    });
    expect(employeeModel).not.toHaveBeenCalled();
  });

  it('creates a proposed employee only after administrator confirmation', async () => {
    const createdEmployee = {
      _id: '507f1f77bcf86cd799439015',
      name: 'Ana Silva',
      cpf: '12345678901',
      funcao: 'Vendedora',
      companyId,
    };
    const save = vi.fn().mockResolvedValue({
      toObject: () => createdEmployee,
    });
    const employeeConstructor = employeeModel as unknown as ReturnType<
      typeof vi.fn
    >;
    employeeConstructor.mockImplementation(function (
      _values: Record<string, unknown>,
    ) {
      return { save };
    });

    const action: PendingAiAction = {
      id: 'call_create_employee',
      name: 'create_employee',
      arguments: {
        name: 'Ana Silva',
        cpf: '12345678901',
        funcao: 'Vendedora',
      },
      status: 'pending',
      createdAt: new Date(),
    };
    const pendingConversation = new ConversationModelMock({
      pendingAction: action,
    });
    const executingConversation = new ConversationModelMock({
      pendingAction: { ...action, status: 'executing' },
    });
    const completedConversation = new ConversationModelMock({
      pendingAction: null,
    });
    ConversationModelMock.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(pendingConversation),
    });
    ConversationModelMock.findOneAndUpdate
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(executingConversation),
      })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(completedConversation),
      });

    const result = await service.confirmAction(
      { userId, companyId },
      pendingConversation.id,
      action.id,
    );

    expect(employeeConstructor).toHaveBeenCalledWith({
      name: 'Ana Silva',
      cpf: '12345678901',
      companyId,
      funcao: 'Vendedora',
    });
    expect(save).toHaveBeenCalledOnce();
    expect(result.result).toEqual(createdEmployee);
    expect(result.assistantMessage).toBe(
      'Ação create_employee executada com confirmação.',
    );
  });

  it('answers WhatsApp contacts with read-only product and sales tools', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'Temos cadernos disponíveis.',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.replyForWhatsApp({ userId, companyId }, 'Cliente', [
        { role: 'user', content: 'Tem caderno?' },
      ]),
    ).resolves.toBe('Temos cadernos disponíveis.');

    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as {
      messages: Record<string, unknown>[];
      tools: { function: { name: string } }[];
    };
    expect(requestBody.messages[0].content).toContain('EasyBot');
    expect(requestBody.tools.map((tool) => tool.function.name)).toEqual([
      'list_products',
      'list_sales',
    ]);
  });

  it('uses the separate authenticated inference service when configured', async () => {
    process.env.AI_SERVICE_URL = 'https://ai-service.example.test/';
    process.env.AI_SERVICE_KEY = 'internal-test-key';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Resposta remota.' } }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.replyForWhatsApp({ userId, companyId }, 'Cliente', [
        { role: 'user', content: 'Olá' },
      ]),
    ).resolves.toBe('Resposta remota.');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ai-service.example.test/v1/chat/completions',
      expect.objectContaining({
        headers: {
          'x-ai-service-key': 'internal-test-key',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  it('proposes WhatsApp messages for administrator confirmation', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_send_whatsapp',
                    function: {
                      name: 'send_whatsapp_message',
                      arguments: JSON.stringify({
                        contactId: '507f1f77bcf86cd799439015',
                        message: 'Seu pedido está pronto.',
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await service.chat(
      { userId, companyId },
      'Avise a Maria que o pedido está pronto.',
    );

    expect(result.pendingAction).toMatchObject({
      name: 'send_whatsapp_message',
      status: 'pending',
      arguments: {
        contactId: '507f1f77bcf86cd799439015',
        message: 'Seu pedido está pronto.',
      },
    });
    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as { tools: { function: { name: string } }[] };
    expect(requestBody.tools.map((tool) => tool.function.name)).toContain(
      'send_whatsapp_message',
    );
  });

  it('suggests invoice matches only from the company catalog and returns structured review items', async () => {
    const productId = new Types.ObjectId('507f1f77bcf86cd799439015');
    const query = {
      select: vi.fn(),
      sort: vi.fn(),
      limit: vi.fn(),
      lean: vi.fn(),
      exec: vi.fn().mockResolvedValue([
        {
          _id: productId,
          name: 'Caneca de cerâmica',
          categoria: 'Casa',
          preco: 30,
        },
      ]),
    };
    query.select.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    Object.assign(productModel, {
      find: vi.fn().mockReturnValue(query),
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      description: 'Caneca de cerâmica',
                      quantity: 2,
                      unitPrice: 15,
                      total: 30,
                      productId: null,
                      confidence: 0.72,
                      clarification: null,
                    },
                  ],
                  answer: 'Encontrei uma correspondência provável.',
                }),
              },
            },
          ],
        }),
      ),
    );

    await expect(
      service.assistInvoiceReview(
        { userId },
        {
          items: [],
          ocrLines: ['Caneca cerâmica 2 un. R$ 15,00 R$ 30,00'],
          question: 'Confira o valor total.',
        },
      ),
    ).resolves.toEqual({
      items: [
        {
          description: 'Caneca de cerâmica',
          quantity: 2,
          unitPrice: 15,
          total: 30,
          productId: productId.toString(),
          confidence: 0.9,
        },
      ],
      answer: 'Encontrei uma correspondência provável.',
      needsClarification: false,
      clarificationQuestion: null,
    });

    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as { tools: unknown[]; messages: { content: string }[] };
    expect(requestBody.tools).toEqual([]);
    expect(requestBody.messages[1].content).toContain(
      'Caneca cerâmica 2 un. R$ 15,00 R$ 30,00',
    );
    expect(requestBody.messages[1].content).toContain(productId.toString());
  });

  it('does not persist an incomplete user message when the provider fails', async () => {
    const saveSpy = vi.spyOn(ConversationModelMock.prototype, 'save');
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));

    await expect(
      service.chat({ userId }, 'Resuma as vendas recentes.'),
    ).rejects.toThrow();

    expect(saveSpy).not.toHaveBeenCalled();
  });
});
