import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AiInferenceService } from './ai-inference.service.js';

@Controller()
export class AiInferenceController {
  constructor(private readonly aiInferenceService: AiInferenceService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('v1/chat/completions')
  complete(
    @Headers('x-ai-service-key') serviceKey: string | undefined,
    @Body() payload: unknown,
  ) {
    return this.aiInferenceService.complete(serviceKey, payload);
  }
}
