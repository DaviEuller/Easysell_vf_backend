import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AssistInvoiceImportDto } from './dto/assist-invoice-import.dto.js';
import { ConfirmInvoiceImportDto } from './dto/confirm-invoice-import.dto.js';
import { CreateManualInvoiceImportDto } from './dto/create-manual-invoice-import.dto.js';
import {
  InvoiceImportService,
  MAX_INVOICE_FILE_SIZE,
} from './invoice-import.service.js';
import type { UploadedInvoiceFile } from './invoice-import.service.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    companyId?: string;
    empresaid?: string;
  };
};

@Controller('invoice-imports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Importação de notas fiscais')
export class InvoiceImportController {
  constructor(private readonly invoiceImportService: InvoiceImportService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_INVOICE_FILE_SIZE, files: 1 },
    }),
  )
  upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedInvoiceFile | undefined,
  ) {
    return this.invoiceImportService.importFile(request.user, file);
  }

  @Post('manual')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  createManual(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateManualInvoiceImportDto,
  ) {
    return this.invoiceImportService.createManual(request.user, input);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('status') status?: string) {
    return this.invoiceImportService.list(request.user, status);
  }

  @Get(':invoiceId')
  getOne(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoiceImportService.getOne(request.user, invoiceId);
  }

  @Post(':invoiceId/assist')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  assist(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() input: AssistInvoiceImportDto,
  ) {
    return this.invoiceImportService.assist(
      request.user,
      invoiceId,
      input.question,
    );
  }

  @Post(':invoiceId/confirm')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  confirm(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() input: ConfirmInvoiceImportDto,
  ) {
    return this.invoiceImportService.confirm(request.user, invoiceId, input);
  }

  @Post(':invoiceId/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoiceImportService.reject(request.user, invoiceId);
  }
}
