import { UnauthorizedException } from '@nestjs/common';
import { vi } from 'vitest';
import { AiInferenceService } from './ai-inference.service.js';

describe('AiInferenceService', () => {
  const service = new AiInferenceService();
  const originalEnv = {
    serviceKey: process.env.AI_SERVICE_KEY,
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: process.env.AI_API_BASE_URL,
  };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.AI_SERVICE_KEY = 'internal-test-key';
    process.env.GROQ_API_KEY = 'provider-test-key';
    process.env.AI_API_BASE_URL = 'https://provider.example.test/v1';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv.serviceKey === undefined) delete process.env.AI_SERVICE_KEY;
    else process.env.AI_SERVICE_KEY = originalEnv.serviceKey;
    if (originalEnv.apiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalEnv.apiKey;
    if (originalEnv.baseUrl === undefined) delete process.env.AI_API_BASE_URL;
    else process.env.AI_API_BASE_URL = originalEnv.baseUrl;
  });

  it('proxies authenticated inference requests to the configured provider', async () => {
    const request = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'Olá' }],
    };
    const providerResponse = {
      choices: [{ message: { content: 'Olá!' } }],
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(providerResponse), { status: 200 }),
    );

    await expect(
      service.complete('internal-test-key', request),
    ).resolves.toEqual(providerResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer provider-test-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }),
    );
  });

  it('rejects callers without the internal service key', async () => {
    await expect(
      service.complete('wrong-key', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Olá' }],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed inference requests without contacting the provider', async () => {
    await expect(
      service.complete('internal-test-key', {
        model: 'test-model',
        messages: [],
      }),
    ).rejects.toThrow('A solicitação de inferência tem formato inválido.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
