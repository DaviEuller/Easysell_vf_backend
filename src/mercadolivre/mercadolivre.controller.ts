import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { MercadoLivreService } from './mercadolivre.service.js';
import { MercadoLivreProductListingDto } from '../produtos/dto/mercadolivre-product-listing.dto.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    companyId?: string;
    empresaid?: string;
  };
};

@Controller('mercadolivre')
@ApiTags('Mercado Livre')
export class MercadoLivreController {
  constructor(private readonly mercadoLivreService: MercadoLivreService) {}

  @Get('oauth/callback')
  @ApiExcludeEndpoint()
  oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') authorizationError: string | undefined,
  ) {
    return this.mercadoLivreService.completeAuthorization(
      code ?? '',
      state ?? '',
      authorizationError,
    );
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  status(@Req() request: AuthenticatedRequest) {
    return this.mercadoLivreService.getStatus(request.user);
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  connect(@Req() request: AuthenticatedRequest) {
    return this.mercadoLivreService.connect(request.user);
  }

  @Delete('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  disconnect(@Req() request: AuthenticatedRequest) {
    return this.mercadoLivreService.disconnect(request.user);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sync(@Req() request: AuthenticatedRequest) {
    return this.mercadoLivreService.syncNow(request.user);
  }

  @Get('categories/:categoryId/attributes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  categoryAttributes(
    @Req() request: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ) {
    return this.mercadoLivreService.getCategoryAttributes(
      request.user,
      categoryId,
    );
  }

  @Post('products/:productId/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  publishProduct(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() listing: MercadoLivreProductListingDto,
  ) {
    return this.mercadoLivreService.publishProduct(
      request.user,
      productId,
      listing,
    );
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listPurchases(
    @Req() request: AuthenticatedRequest,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const page = this.parsePositiveInteger(pageValue, 'page', 1);
    const limit = this.parsePositiveInteger(limitValue, 'limit', 50);
    return this.mercadoLivreService.listPurchases(request.user, page, limit);
  }

  @Get('purchases/:purchaseId/fiscal-documents/:documentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async downloadFiscalDocument(
    @Req() request: AuthenticatedRequest,
    @Param('purchaseId') purchaseId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const file = await this.mercadoLivreService.downloadFiscalDocument(
      request.user,
      purchaseId,
      documentId,
    );
    const safeFileName = file.fileName.replace(/[^\w.-]/g, '_').slice(0, 120);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFileName}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.content);
  }

  private parsePositiveInteger(
    value: string | undefined,
    field: string,
    defaultValue: number,
  ) {
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(
        `${field} precisa ser um inteiro positivo.`,
      );
    }
    return parsed;
  }
}
