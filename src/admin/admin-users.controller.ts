import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('email') email?: string,
    @Query('name') name?: string,
    @Query('hasOrders') hasOrders?: string,
    @Query('isRegistered') isRegistered?: string,
    @Query('isGuest') isGuest?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      email,
      name,
      hasOrders,
      isRegistered,
      isGuest,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
