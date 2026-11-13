import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Query,
  Patch,
} from '@nestjs/common';

import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('user')
@ApiTags('Usuários')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('email')
  async findByEmail(@Query('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
