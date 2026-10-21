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
import { UserDocument } from '../users/schemas/user.schema.js';

const companyId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';

class ConversationModelMock {
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
  let previousApiKey: string | undefined;
  let previousBaseUrl: string | undefined;
  let previousModel: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.GROQ_API_KEY;
    previousBaseUrl = process.env.AI_API_BASE_URL;
    previousModel = process.env.AI_MODEL;
    process.env.GROQ_API_KEY = 'test-api-key';
    process.env.AI_API_BASE_URL = 'https://ai.example.test/v1';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const userModel = {
      findById: vi.fn(() => ({
        select: vi.fn(() => ({
          exec: vi.fn().mockResolvedValue({
            company: new Types.ObjectId(companyId),
          }),
        })),
      })),
    };
    productModel = vi.fn() as unknown as Model<ProdutoDocument>;
    service = new AiService(
      ConversationModelMock as unknown as Model<AiConversationDocument>,
      productModel,
      {} as Model<ClienteDocument>,
      userModel as unknown as Model<UserDocument>,
      {} as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.AI_API_BASE_URL;
    else process.env.AI_API_BASE_URL = previousBaseUrl;
    if (previousModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = previousModel;
  });

  it('persists a write proposal without executing it before confirmation', async () => {
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

    const result = await service.chat({ userId }, 'Cadastre um caderno.');

    expect(result.pendingAction).toMatchObject({
      id: 'call_create_product',
      name: 'create_product',
      status: 'pending',
    });
    expect(productModel).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as { messages: Record<string, unknown>[] };
    expect(requestBody.messages[1]).toEqual({
      role: 'user',
      content: 'Cadastre um caderno.',
    });
  });
});
