import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { EasyBotController } from './easybot.controller.js';
import { EasyBotService } from './easybot.service.js';
import {
  EasyBotAccount,
  EasyBotAccountSchema,
} from './entities/easybot-account.entity.js';
import {
  EasyBotContact,
  EasyBotContactSchema,
} from './entities/easybot-contact.entity.js';
import {
  EasyBotMessage,
  EasyBotMessageSchema,
} from './entities/easybot-message.entity.js';

@Module({
  imports: [
    AuthModule,
    AiModule,
    MongooseModule.forFeature([
      { name: EasyBotAccount.name, schema: EasyBotAccountSchema },
      { name: EasyBotContact.name, schema: EasyBotContactSchema },
      { name: EasyBotMessage.name, schema: EasyBotMessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [EasyBotController],
  providers: [EasyBotService],
})
export class EasyBotModule {}
