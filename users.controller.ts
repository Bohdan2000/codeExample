import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth } from '@nestjs/swagger';
import { v1 as uuidv1 } from 'uuid';
import { CreateUserCommand } from '../../application/commands/implementations/user/create-user.command';
import { DeleteUserCommand } from '../../application/commands/implementations/user/delete-user.command';
import { SelectDistrictCommand } from '../../application/commands/implementations/user/select-district.command';
import { UpdateUserCommand } from '../../application/commands/implementations/user/update-user.command';
import { GetUserQuery } from '../../application/queries/implementations/user/get-user.query';
import { GetUsersQuery } from '../../application/queries/implementations/user/get-users.query';
import { Role } from '../../domain/enums/role.enum';
import { AuthGuard } from '../../shared/auth/guards/auth.guard';
import { RolesGuard } from '../../shared/auth/guards/role.guard';
import { ErrorsInterceptor } from '../../shared/interceptors/errors.interceptor';
import { LoggingInterceptor } from '../../shared/interceptors/logging.interceptor';
import { UnitOfWorkInterceptor } from '../../shared/interceptors/unit-of-work.interceptor';
import { CreateUserModel } from '../dtos/user/create-user-model';
import { DistrictAdministratorReadModel } from '../dtos/user/district-administrator-read-model';
import { SchoolAdministratorReadModel } from '../dtos/user/school-administrator-read-model';
import { TeacherReadModel } from '../dtos/user/teacher-read-model';
import { UpdateUserModel } from '../dtos/user/update-user-model';
import { UserFilterModel } from '../dtos/user/user-filter-model';
import { UserReadModel } from '../dtos/user/user-read-model';
import { SelectDistrictModel } from '../dtos/user/select-district-model';
import { CreateUserGuard } from '../../shared/auth/guards/create-user.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @UseGuards(
    RolesGuard([Role.SA, Role.DistrictAdministrator, Role.SchoolAdministrator, Role.SchoolTeacher, Role.ClassTeacher]),
    CreateUserGuard(),
  )
  @UseInterceptors(UnitOfWorkInterceptor, ErrorsInterceptor)
  async create(@Body() dto: CreateUserModel): Promise<string> {
    const id = uuidv1();
    await this.commandBus.execute(new CreateUserCommand({ ...dto, id }));
    return id;
  }

  @Get('current')
  @UseGuards(
    RolesGuard([
      Role.SA,
      Role.DistrictAdministrator,
      Role.SchoolAdministrator,
      Role.SchoolTeacher,
      Role.ClassTeacher,
      Role.Student,
    ]),
  )
  @UseInterceptors(ErrorsInterceptor)
  async findCurrent(): Promise<UserReadModel> {
    return this.queryBus.execute(new GetUserQuery());
  }

  @Get(':userId')
  @UseGuards(
    RolesGuard([Role.SA, Role.DistrictAdministrator, Role.SchoolAdministrator, Role.SchoolTeacher, Role.ClassTeacher]),
  )
  @UseInterceptors(ErrorsInterceptor)
  async findOne(@Param('userId') userId: string): Promise<UserReadModel> {
    return this.queryBus.execute(new GetUserQuery(userId));
  }

  @Get()
  @UseGuards(
    RolesGuard([Role.SA, Role.DistrictAdministrator, Role.SchoolAdministrator, Role.SchoolTeacher, Role.ClassTeacher]),
  )
  @UseInterceptors(ErrorsInterceptor)
  async getAll(
    @Query() dto: UserFilterModel,
  ): Promise<DistrictAdministratorReadModel[] | SchoolAdministratorReadModel[] | TeacherReadModel[]> {
    return this.queryBus.execute(new GetUsersQuery(dto));
  }

  @Put(':userId')
  @UseGuards(
    RolesGuard([Role.SA, Role.DistrictAdministrator, Role.SchoolAdministrator, Role.SchoolTeacher, Role.ClassTeacher]),
  )
  @UseInterceptors(UnitOfWorkInterceptor, ErrorsInterceptor)
  async update(@Param('userId') userId: string, @Body() dto: UpdateUserModel): Promise<void> {
    return this.commandBus.execute(new UpdateUserCommand({ ...dto, userId }));
  }

  @Delete(':userId')
  @UseGuards(RolesGuard([Role.SA, Role.DistrictAdministrator, Role.SchoolAdministrator]))
  @UseInterceptors(UnitOfWorkInterceptor, ErrorsInterceptor)
  async delete(@Param('userId') userId: string): Promise<void> {
    return this.commandBus.execute(new DeleteUserCommand(userId));
  }

  @Post('select-district')
  @UseGuards(RolesGuard([Role.SA]))
  @UseInterceptors(UnitOfWorkInterceptor, ErrorsInterceptor)
  async selectDistrict(@Body() dto: SelectDistrictModel): Promise<void> {
    return this.commandBus.execute(new SelectDistrictCommand(dto.districtId));
  }
}
