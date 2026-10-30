import {
  Body,
  Controller,
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
import { CreateFaturaDto } from './dto/create-fatura.dto.js';
import { SetFaturaStatusDto } from './dto/set-fatura-status.dto.js';
import { FaturasService } from './faturas.service.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('faturas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Faturas')
export class FaturasController {
  constructor(private readonly faturasService: FaturasService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.faturasService.list(request.user);
  }

  @Get('vendas-disponiveis')
  listAvailableSales(@Req() request: AuthenticatedRequest) {
    return this.faturasService.listAvailableSales(request.user);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateFaturaDto) {
    return this.faturasService.create(request.user, dto);
  }

  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  setStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: SetFaturaStatusDto,
  ) {
    if (body.installmentNumber !== undefined) {
      return this.faturasService.setInstallmentStatus(
        request.user,
        id,
        body.installmentNumber,
        body.status,
      );
    }
    return this.faturasService.setStatus(request.user, id, body.status);
  }

  @Get(':id/whatsapp')
  getWhatsAppCharge(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.faturasService.getWhatsAppCharge(request.user, id);
  }
}
