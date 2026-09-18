import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userDocument: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const { password, ...userData } = createUserDto;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new this.userDocument({
      ...userData,
      passwordHash,
    });

    return user.save();
  }

  async findOne(id: string): Promise<UserDocument | null> {
    return this.userDocument.findById(id).exec();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userDocument.find().exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userDocument.findOne({ email }).exec();
  }

  async remove(id: string): Promise<UserDocument> {
    const user = await this.userDocument.findByIdAndDelete(id).exec();

    if (!user) {
      throw new NotFoundException(
        `Usuário com id ${id} não encontrado`,
      );
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.userDocument
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(
        `Usuário com id ${id} não encontrado`,
      );
    }

    return user;
  }
}
