import { NestFactory } from '@nestjs/core';
import { AiInferenceModule } from './ai-inference.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AiInferenceModule);
  const port = Number(process.env.AI_SERVICE_PORT || 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
