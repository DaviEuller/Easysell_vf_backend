import { Module } from '@nestjs/common';
import { AiInferenceController } from './ai-inference.controller.js';
import { AiInferenceService } from './ai-inference.service.js';

@Module({
  controllers: [AiInferenceController],
  providers: [AiInferenceService],
})
export class AiInferenceModule {}
