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
  UseGuards,
} from '@nestjs/common';
import { CompanyService } from './company.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { BootstrapCompanyDto } from './dto/bootstrap-company.dto.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard.js';

@Controller('company')
@ApiTags('Empresas')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMyCompanySummary(@Req() request: { user: { userId: string } }) {
    return this.companyService.getMyCompanySummary(request.user.userId);
  }

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companyService.create(createCompanyDto);
  }

  @Post('bootstrap/:id')
  bootstrap(
    @Param('id') userId: string,
    @Body() bootstrapCompanyDto: BootstrapCompanyDto,
  ) {
    return this.companyService.bootstrap(userId, bootstrapCompanyDto);
  }

  @Post('employees')
  createEmployee(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.companyService.createEmployee(createEmployeeDto);
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.companyService.updateEmployee(id, updateEmployeeDto);
  }

  @Delete('employees/:id')
  removeEmployee(@Param('id') id: string) {
    return this.companyService.removeEmployee(id);
  }

  @Get('employees/by-company/:companyId')
  findEmployeesByCompanyId(@Param('companyId') companyId: string) {
    return this.companyService.findEmployeesByCompanyId(companyId);
  }

  @Get('employees/by-name')
  findEmployeesByName(@Query('name') name: string) {
    return this.companyService.findEmployeesByName(name);
  }

  @Get()
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companyService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyService.remove(id);
  }
}
