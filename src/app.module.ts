import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProdutosModule } from './produtos/produtos.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { CompanyModule } from './company/company.module.js';
import { EquipeModule } from './equipe/equipe.module.js';
import { AiModule } from './ai/ai.module.js';
import { FaturasModule } from './faturas/faturas.module.js';
import { EasyBotModule } from './easybot/easybot.module.js';
import { MercadoLivreModule } from './mercadolivre/mercadolivre.module.js';
import { InvoiceImportModule } from './invoice-import/invoice-import.module.js';
export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),

    AuthModule,
    UsersModule,

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),

    ProdutosModule,

    ClientesModule,

    CompanyModule,

    EquipeModule,

    AiModule,

    FaturasModule,

    EasyBotModule,

    MercadoLivreModule,

    InvoiceImportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
