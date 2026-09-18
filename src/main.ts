import * as dns from 'node:dns';

import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();