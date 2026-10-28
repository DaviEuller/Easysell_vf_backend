import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CreateEasyBotContactDto } from './dto/create-easybot-contact.dto.js';
import { SendEasyBotMessageDto } from './dto/send-easybot-message.dto.js';
import { UpdateEasyBotContactDto } from './dto/update-easybot-contact.dto.js';
import { EasyBotService } from './easybot.service.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    companyId?: string;
    empresaid?: string;
  };
};

@Controller('easybot')
@UseGuards(JwtAuthGuard)
export class EasyBotController {
  constructor(private readonly easyBotService: EasyBotService) {}

  @Get('status')
  getConnectionStatus(@Req() request: AuthenticatedRequest) {
    return this.easyBotService.getConnectionStatus(request.user);
  }

  @Post('connect')
  connect(@Req() request: AuthenticatedRequest) {
    return this.easyBotService.connect(request.user);
  }

  @Post('disconnect')
  disconnect(@Req() request: AuthenticatedRequest) {
    return this.easyBotService.disconnect(request.user);
  }

  @Get('contacts')
  listContacts(@Req() request: AuthenticatedRequest) {
    return this.easyBotService.listContacts(request.user);
  }

  @Post('contacts')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  createContact(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEasyBotContactDto,
  ) {
    return this.easyBotService.createContact(request.user, dto);
  }

  @Patch('contacts/:contactId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateContact(
    @Req() request: AuthenticatedRequest,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateEasyBotContactDto,
  ) {
    return this.easyBotService.updateContact(request.user, contactId, dto);
  }

  @Delete('contacts/:contactId')
  deleteContact(
    @Req() request: AuthenticatedRequest,
    @Param('contactId') contactId: string,
  ) {
    return this.easyBotService.deleteContact(request.user, contactId);
  }

  @Get('contacts/:contactId/messages')
  listMessages(
    @Req() request: AuthenticatedRequest,
    @Param('contactId') contactId: string,
  ) {
    return this.easyBotService.listMessages(request.user, contactId);
  }

  @Post('messages')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  sendMessage(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SendEasyBotMessageDto,
  ) {
    return this.easyBotService.sendMessage(request.user, dto);
  }
}
