import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {

  constructor(private readonly service: AdminOrdersService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('email') email?: string,
    @Query('orderNumber') orderNumber?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll({ status, email, orderNumber, startDate, endDate });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/resend-email')
  @HttpCode(HttpStatus.OK)
  resendEmail(@Param('id') id: string) {
    return this.service.resendEmail(id);
  }
}
