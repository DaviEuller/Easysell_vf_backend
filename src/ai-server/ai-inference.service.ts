import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class AiInferenceService {
  async complete(serviceKey: string | undefined, payload: unknown) {
    this.authorize(serviceKey);
    this.validatePayload(payload);

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'A chave do provedor de IA não está configurada neste servidor.',
      );
    }

    const baseUrl =
      process.env.AI_API_BASE_URL?.trim() || 'https://api.groq.com/openai/v1';
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
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45_000),
        },
      );
    } catch {
      throw new BadGatewayException(
        'Não foi possível conectar ao provedor de IA.',
      );
    }

    let providerPayload: unknown;
    try {
      providerPayload = await response.json();
    } catch {
      throw new BadGatewayException(
        `O provedor de IA retornou uma resposta inválida (HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      const status =
        response.status >= 400 && response.status <= 599
          ? response.status
          : 502;
      throw new HttpException(
        {
          statusCode: status,
          message: `O provedor de IA respondeu com HTTP ${response.status}.`,
        },
        status,
      );
    }
    if (!isRecord(providerPayload) || !Array.isArray(providerPayload.choices)) {
      throw new BadGatewayException(
        'O provedor de IA retornou um formato de resposta inválido.',
      );
    }
    return providerPayload;
  }

  private authorize(serviceKey: string | undefined) {
    const expectedKey = process.env.AI_SERVICE_KEY?.trim();
    if (!expectedKey) {
      throw new ServiceUnavailableException(
        'AI_SERVICE_KEY não está configurada neste servidor.',
      );
    }
    if (!serviceKey) {
      throw new UnauthorizedException('Chave interna inválida.');
    }
    const expectedHash = createHash('sha256').update(expectedKey).digest();
    const suppliedHash = createHash('sha256').update(serviceKey).digest();
    if (!timingSafeEqual(expectedHash, suppliedHash)) {
      throw new UnauthorizedException('Chave interna inválida.');
    }
  }

  private validatePayload(
    payload: unknown,
  ): asserts payload is Record<string, unknown> {
    if (
      !isRecord(payload) ||
      typeof payload.model !== 'string' ||
      !payload.model.trim() ||
      !Array.isArray(payload.messages) ||
      payload.messages.length === 0 ||
      payload.messages.length > 51 ||
      !payload.messages.every(
        (message) =>
          isRecord(message) &&
          typeof message.role === 'string' &&
          (typeof message.content === 'string' || message.content === null),
      ) ||
      payload.stream === true
    ) {
      throw new BadRequestException(
        'A solicitação de inferência tem formato inválido.',
      );
    }
  }
}
