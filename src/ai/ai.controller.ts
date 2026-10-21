import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { ChatAiDto } from './dto/chat-ai.dto.js';
import { AiService } from './ai.service.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    empresaid?: string;
  };
};

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  chat(
    @Req() request: AuthenticatedRequest,
    @Body() chatDto: ChatAiDto,
  ) {
    return this.aiService.chat(
      request.user,
      chatDto.message,
      chatDto.conversationId,
    );
  }

  @Get('conversations')
  listConversations(@Req() request: AuthenticatedRequest) {
    return this.aiService.listConversations(request.user);
  }

  @Get('conversations/:conversationId')
  getConversation(
    @Req() request: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiService.getConversation(request.user, conversationId);
  }

  @Post('conversations/:conversationId/actions/:actionId/confirm')
  confirmAction(
    @Req() request: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Param('actionId') actionId: string,
  ) {
    return this.aiService.confirmAction(
      request.user,
      conversationId,
      actionId,
    );
  }

  @Post('conversations/:conversationId/actions/:actionId/reject')
  rejectAction(
    @Req() request: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Param('actionId') actionId: string,
  ) {
    return this.aiService.rejectAction(
      request.user,
      conversationId,
      actionId,
    );
  }
}
