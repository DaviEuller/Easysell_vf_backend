import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { MongooseModule } from '@nestjs/mongoose';;
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProdutosModule } from './produtos/produtos.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { CompanyModule } from './company/company.module.js';
export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      }),

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

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
