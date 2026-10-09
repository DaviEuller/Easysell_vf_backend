import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EquipeService } from './equipe.service.js';
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { CreateEquipeTaskDto } from './dto/create-equipe-task.dto.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import type { TaskAttachmentUpload } from './equipe.service.js';

interface AuthenticatedRequest {
  user: {
    userId: string;
  };
}

@Controller('equipe')
@UseGuards(JwtAuthGuard)
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Post()
  create(
    @Body() createEquipeDto: CreateEquipeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.create(createEquipeDto, request.user.userId);
  }

  @Get()
  findAll(
    @Query('companyId') companyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.findAll(companyId, request.user.userId);
  }

  @Get('funcionarios')
  findEmployees(
    @Query('companyId') companyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.findEmployees(companyId, request.user.userId);
  }

  @Get('minhas-tarefas')
  findMyTasks(@Req() request: AuthenticatedRequest) {
    return this.equipeService.findMyTasks(request.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.equipeService.findOne(id, request.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEquipeDto: UpdateEquipeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.update(
      id,
      updateEquipeDto,
      request.user.userId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.equipeService.remove(id, request.user.userId);
  }

  @Post(':id/tasks')
  addTask(
    @Param('id') id: string,
    @Body() createTaskDto: CreateEquipeTaskDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.addTask(
      id,
      createTaskDto,
      request.user.userId,
    );
  }

  @Delete(':id/tasks/:taskId')
  removeTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.removeTask(id, taskId, request.user.userId);
  }

  @Post(':id/tasks/:taskId/attachment')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  submitTaskAttachment(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body('report') report: string,
    @UploadedFile() file: TaskAttachmentUpload,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.equipeService.submitTaskAttachment(
      id,
      taskId,
      request.user.userId,
      file,
      report,
    );
  }

  @Get(':id/tasks/:taskId/file')
  async getTaskAttachment(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const attachment = await this.equipeService.getTaskAttachment(
      id,
      taskId,
      request.user.userId,
    );
    const fallbackName = attachment.filename.replace(/[^\x20-\x7E]/g, '_');
    response.setHeader('Content-Type', attachment.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    );
    attachment.stream.on('error', (error: Error) => response.destroy(error));
    attachment.stream.pipe(response);
  }
}
