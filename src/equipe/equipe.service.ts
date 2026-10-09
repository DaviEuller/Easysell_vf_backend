import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { UserRole } from '../users/enum/user.role.enum.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { Company, CompanyDocument } from '../company/schemas/company.schema.js';
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { CreateEquipeTaskDto } from './dto/create-equipe-task.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { Equipe, EquipeDocument } from './entities/equipe.entity.js';

const maximumAttachmentSize = 5 * 1024 * 1024;
const maximumTaskReportLength = 2000;
const acceptedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface TaskAttachmentUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class EquipeService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Equipe.name)
    private readonly equipeModel: Model<EquipeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async create(createEquipeDto: CreateEquipeDto, authenticatedUserId: string) {
    const company = await this.findCompanyForAdmin(
      createEquipeDto.companyId,
      authenticatedUserId,
    );
    const linkedUser = createEquipeDto.userEmail
      ? await this.findAvailableAttendant(
          createEquipeDto.userEmail,
          undefined,
          company._id.toString(),
        )
      : undefined;

    const member = await this.equipeModel.create({
      name: createEquipeDto.name,
      age: createEquipeDto.age,
      funcao: createEquipeDto.funcao,
      companyId: company._id,
      dataEntrada: new Date(createEquipeDto.dataEntrada),
      telefone: createEquipeDto.telefone,
      adminId: company.responsavelId,
      ...(linkedUser
        ? { userId: linkedUser._id, userEmail: linkedUser.email }
        : {}),
    });

    if (linkedUser) {
      const account = await this.userModel
        .findByIdAndUpdate(
          linkedUser._id,
          {
            $set: {
              equipeMember: member._id,
              company: company._id,
              role: UserRole.FUNCIONARIO,
            },
          },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
      if (!account) {
        await this.equipeModel.findByIdAndDelete(member._id).exec();
        throw new NotFoundException(
          'A conta do funcionário não está mais disponível',
        );
      }
    }
    return member;
  }

  async findAll(companyId: string, authenticatedUserId: string) {
    await this.findCompanyForAdmin(companyId, authenticatedUserId);
    return this.equipeModel
      .find({ companyId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findEmployees(companyId: string, authenticatedUserId: string) {
    const company = await this.findCompanyForAdmin(
      companyId,
      authenticatedUserId,
    );
    const employeeAccounts = await this.userModel
      .find({ company: company._id, role: UserRole.FUNCIONARIO })
      .select('_id email')
      .exec();
    if (employeeAccounts.length === 0) return [];

    const emailByUserId = new Map(
      employeeAccounts.map((account) => [
        account._id.toString(),
        account.email,
      ]),
    );
    const members = await this.equipeModel
      .find({
        companyId: company._id,
        userId: { $in: employeeAccounts.map((account) => account._id) },
      })
      .sort({ createdAt: -1 })
      .exec();

    return members.map((member) => {
      const result = member.toObject();
      result.userEmail = emailByUserId.get(member.userId?.toString() ?? '');
      return result;
    });
  }

  async findMyTasks(authenticatedUserId: string) {
    const user = await this.userModel.findById(authenticatedUserId).exec();
    if (!user) {
      throw new NotFoundException('A conta do funcionário não foi encontrada');
    }

    let member: EquipeDocument | null = null;
    if (user.equipeMember) {
      member = await this.equipeModel
        .findById(user.equipeMember)
        .exec();
      if (member?.userId?.toString() !== authenticatedUserId) {
        throw new ForbiddenException(
          'O vínculo da conta com o membro da equipe é inválido',
        );
      }
    } else {
      member = await this.equipeModel
        .findOne({ userId: authenticatedUserId })
        .exec();
    }

    if (!member) {
      throw new NotFoundException(
        'Sua conta ainda não está vinculada a um membro da equipe',
      );
    }
    return member;
  }

  async findOne(id: string, authenticatedUserId: string) {
    const equipe = await this.findMember(id);
    await this.findCompanyForAdmin(
      equipe.companyId.toString(),
      authenticatedUserId,
    );
    return equipe;
  }

  async update(
    id: string,
    updateEquipeDto: UpdateEquipeDto,
    authenticatedUserId: string,
  ) {
    const equipe = await this.findMember(id);
    await this.findCompanyForAdmin(
      equipe.companyId.toString(),
      authenticatedUserId,
    );

    const update: Record<string, unknown> = {};
    if (updateEquipeDto.name !== undefined) update.name = updateEquipeDto.name;
    if (updateEquipeDto.age !== undefined) update.age = updateEquipeDto.age;
    if (updateEquipeDto.funcao !== undefined) {
      update.funcao = updateEquipeDto.funcao;
    }
    if (updateEquipeDto.telefone !== undefined) {
      update.telefone = updateEquipeDto.telefone;
    }
    if (updateEquipeDto.dataEntrada !== undefined) {
      update.dataEntrada = new Date(updateEquipeDto.dataEntrada);
    }
    const userEmail = updateEquipeDto.userEmail;
    if (userEmail) {
      const linkedUser = await this.findAvailableAttendant(
        userEmail,
        id,
        equipe.companyId.toString(),
      );
      update.userId = linkedUser._id;
      update.userEmail = linkedUser.email;
      update.company = equipe.companyId;
    }

    const updatedMember = await this.equipeModel
      .findByIdAndUpdate(id, update, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    if (userEmail && updatedMember?.userId) {
      const account = await this.userModel
        .findByIdAndUpdate(
          updatedMember.userId,
          {
            $set: {
              equipeMember: updatedMember._id,
              company: equipe.companyId,
              role: UserRole.FUNCIONARIO,
            },
          },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
      if (!account) {
        throw new NotFoundException(
          'A conta do funcionário não está mais disponível',
        );
      }
      if (equipe.userId && !equipe.userId.equals(updatedMember.userId)) {
        await this.userModel
          .findByIdAndUpdate(
            equipe.userId,
            { $unset: { equipeMember: 1 } },
            { returnDocument: 'after' },
          )
          .exec();
      }
    }

    return updatedMember;
  }

  async remove(id: string, authenticatedUserId: string) {
    const equipe = await this.findMember(id);
    await this.findCompanyForAdmin(
      equipe.companyId.toString(),
      authenticatedUserId,
    );
    if (equipe.userId) {
      await this.userModel
        .findByIdAndUpdate(
          equipe.userId,
          { $unset: { equipeMember: 1 } },
          { returnDocument: 'after' },
        )
        .exec();
    }
    for (const task of equipe.tasks) {
      if (task.attachmentId) {
        await this.getGridFsBucket().delete(task.attachmentId);
      }
    }
    return this.equipeModel.findByIdAndDelete(id).exec();
  }

  async addTask(
    memberId: string,
    createTaskDto: CreateEquipeTaskDto,
    authenticatedUserId: string,
  ) {
    const dueDate = new Date(createTaskDto.dueDate);
    if (!Number.isFinite(dueDate.getTime())) {
      throw new BadRequestException('A data de entrega da tarefa é inválida');
    }

    const equipe = await this.findMember(memberId);
    await this.findCompanyForAdmin(
      equipe.companyId.toString(),
      authenticatedUserId,
    );
    if (!equipe.userId) {
      throw new ConflictException(
        'Vincule uma conta de funcionário antes de atribuir tarefas',
      );
    }

    const updatedEquipe = await this.equipeModel
      .findByIdAndUpdate(
        memberId,
        {
          $push: {
            tasks: { text: createTaskDto.text.trim(), dueDate },
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();

    if (!updatedEquipe) {
      throw new NotFoundException(
        `Membro da equipe com id ${memberId} não encontrado`,
      );
    }
    return updatedEquipe;
  }

  async removeTask(
    memberId: string,
    taskId: string,
    authenticatedUserId: string,
  ) {
    if (!isValidObjectId(taskId)) {
      throw new BadRequestException('ID da tarefa inválido');
    }

    const equipe = await this.findMember(memberId);
    await this.findCompanyForAdmin(
      equipe.companyId.toString(),
      authenticatedUserId,
    );
    const task = equipe.tasks.find((item) => item._id.toString() === taskId);
    if (!task) {
      throw new NotFoundException(
        `Tarefa com id ${taskId} não encontrada para este membro`,
      );
    }

    if (task.attachmentId) {
      await this.getGridFsBucket().delete(task.attachmentId);
    }

    const updatedEquipe = await this.equipeModel
      .findOneAndUpdate(
        { _id: memberId, 'tasks._id': taskId },
        { $pull: { tasks: { _id: taskId } } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedEquipe) {
      throw new NotFoundException(
        `Tarefa com id ${taskId} não encontrada para este membro`,
      );
    }
    return updatedEquipe;
  }

  async submitTaskAttachment(
    memberId: string,
    taskId: string,
    authenticatedUserId: string,
    file: TaskAttachmentUpload,
    report: string,
  ) {
    if (!isValidObjectId(taskId)) {
      throw new BadRequestException('ID da tarefa inválido');
    }
    this.validateAttachment(file);
    const normalizedReport = report?.trim();
    if (!normalizedReport) {
      throw new BadRequestException('Informe o relatório da tarefa');
    }
    if (normalizedReport.length > maximumTaskReportLength) {
      throw new BadRequestException(
        `O relatório deve ter no máximo ${maximumTaskReportLength} caracteres`,
      );
    }

    const member = await this.findMember(memberId);
    if (member.userId?.toString() !== authenticatedUserId) {
      throw new ForbiddenException(
        'Somente o funcionário responsável pode enviar o arquivo da tarefa',
      );
    }

    const task = member.tasks.find((item) => item._id.toString() === taskId);
    if (!task) {
      throw new NotFoundException(
        `Tarefa com id ${taskId} não encontrada para este membro`,
      );
    }
    if (task.completed) {
      throw new ConflictException('Esta tarefa já foi concluída');
    }

    const safeFilename = file.originalname
      .replace(/[\\/\r\n"]/g, '_')
      .slice(0, 180);
    const bucket = this.getGridFsBucket();
    const fileId = await new Promise<ObjectId>((resolve, reject) => {
      const upload = bucket.openUploadStream(safeFilename, {
        metadata: {
          contentType: file.mimetype,
          memberId,
          taskId,
          uploadedBy: authenticatedUserId,
        },
      });
      upload.once('finish', () => resolve(upload.id));
      upload.once('error', reject);
      upload.end(file.buffer);
    });

    let updatedMember: EquipeDocument | null;
    try {
      updatedMember = await this.equipeModel
        .findOneAndUpdate(
          { _id: memberId, 'tasks._id': taskId, 'tasks.completed': false },
          {
            $set: {
              'tasks.$.completed': true,
              'tasks.$.attachmentId': new Types.ObjectId(fileId.toHexString()),
              'tasks.$.attachmentName': safeFilename,
              'tasks.$.attachmentType': file.mimetype,
              'tasks.$.attachmentSize': file.size,
              'tasks.$.submittedAt': new Date(),
              'tasks.$.report': normalizedReport,
            },
          },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
    } catch (error) {
      await bucket.delete(fileId);
      throw error;
    }

    if (!updatedMember) {
      await bucket.delete(fileId);
      throw new ConflictException(
        'A tarefa foi alterada durante o envio. Atualize a página e tente novamente.',
      );
    }
    return updatedMember;
  }

  async getTaskAttachment(
    memberId: string,
    taskId: string,
    authenticatedUserId: string,
  ) {
    if (!isValidObjectId(taskId)) {
      throw new BadRequestException('ID da tarefa inválido');
    }
    const member = await this.findMember(memberId);
    if (member.userId?.toString() !== authenticatedUserId) {
      await this.findCompanyForAdmin(
        member.companyId.toString(),
        authenticatedUserId,
      );
    }

    const task = member.tasks.find((item) => item._id.toString() === taskId);
    if (!task?.attachmentId || !task.attachmentName || !task.attachmentType) {
      throw new NotFoundException('Esta tarefa ainda não possui arquivo enviado');
    }

    const bucket = this.getGridFsBucket();
    const fileId = new ObjectId(task.attachmentId.toString());
    if (!(await bucket.find({ _id: fileId }).hasNext())) {
      throw new NotFoundException('O arquivo da tarefa não foi encontrado');
    }

    return {
      filename: task.attachmentName,
      contentType: task.attachmentType,
      stream: bucket.openDownloadStream(fileId),
    };
  }

  private validateAttachment(file: TaskAttachmentUpload) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo para concluir a tarefa');
    }
    if (file.size > maximumAttachmentSize) {
      throw new BadRequestException('O arquivo deve ter no máximo 5 MB');
    }
    if (!acceptedMimeTypes.has(file.mimetype) || !this.hasValidSignature(file)) {
      throw new BadRequestException(
        'Envie um arquivo PDF, JPEG, PNG ou WebP válido',
      );
    }
  }

  private hasValidSignature(file: TaskAttachmentUpload): boolean {
    const bytes = file.buffer;
    switch (file.mimetype) {
      case 'application/pdf':
        return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
      case 'image/jpeg':
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      case 'image/png':
        return bytes.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
      case 'image/webp':
        return (
          bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
          bytes.subarray(8, 12).toString('ascii') === 'WEBP'
        );
      default:
        return false;
    }
  }

  private async findAvailableAttendant(
    email: string,
    currentMemberId?: string,
    companyId?: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .exec();
    if (
      !user ||
      ![
        UserRole.ADMINISTRADOR,
        UserRole.ATENDENTE,
        UserRole.FUNCIONARIO,
      ].includes(user.role)
    ) {
      throw new NotFoundException(
        'Não foi encontrada uma conta válida para vincular ao funcionário',
      );
    }
    if (
      companyId &&
      user.company &&
      user.company.toString() !== companyId
    ) {
      throw new ForbiddenException(
        'A conta do funcionário não pertence a esta empresa',
      );
    }
    if (user.role === UserRole.ADMINISTRADOR) {
      const responsibleCompany = await this.companyModel
        .findOne({ responsavelId: user._id })
        .exec();
      if (responsibleCompany) {
        throw new ConflictException(
          'A conta responsável pela empresa não pode ser vinculada como funcionário',
        );
      }
    }
    if (
      user.equipeMember &&
      user.equipeMember.toString() !== currentMemberId
    ) {
      throw new ConflictException(
        'Essa conta já está vinculada a outro membro da equipe',
      );
    }
    return user;
  }

  private getGridFsBucket(): GridFSBucket {
    if (!this.connection.db) {
      throw new InternalServerErrorException(
        'O armazenamento de arquivos não está disponível',
      );
    }
    return new GridFSBucket(this.connection.db, {
      bucketName: 'equipeTaskFiles',
    });
  }

  private async findCompanyForAdmin(
    companyId: string,
    authenticatedUserId: string,
  ): Promise<CompanyDocument> {
    if (!isValidObjectId(companyId)) {
      throw new BadRequestException('ID da empresa inválido');
    }

    const company = await this.companyModel.findById(companyId).exec();
    if (!company) {
      throw new NotFoundException(`Empresa com id ${companyId} não encontrada`);
    }

    if (company.responsavelId.toString() !== authenticatedUserId) {
      throw new ForbiddenException(
        'Somente o responsável pela empresa pode gerenciar a equipe',
      );
    }

    return company;
  }

  private async findMember(id: string): Promise<EquipeDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('ID do membro inválido');
    }

    const equipe = await this.equipeModel.findById(id).exec();
    if (!equipe) {
      throw new NotFoundException(
        `Membro da equipe com id ${id} não encontrado`,
      );
    }
    return equipe;
  }
}
