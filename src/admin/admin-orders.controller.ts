import { Controller, Get, Post, Patch, Param, Query, UseGuards, HttpCode, HttpStatus, Req, Body } from '@nestjs/common';
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
    @Query('fulfillmentStatus') fulfillmentStatus?: string,
    @Query('fulfillmentPreset') fulfillmentPreset?: string,
    @Query('email') email?: string,
    @Query('orderNumber') orderNumber?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll({ 
      status, 
      fulfillmentStatus,
      fulfillmentPreset,
      email, 
      orderNumber, 
      startDate, 
      endDate 
    });
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

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { status: string },
    @Req() req: any,
  ) {
    return this.service.updateStatus(id, dto.status, req.user.id);
  }

  @Patch(':id/fulfillment-status')
  updateFulfillment(
    @Param('id') id: string,
    @Body() dto: { fulfillmentStatus: string },
    @Req() req: any,
  ) {
    return this.service.updateFulfillmentStatus(id, dto.fulfillmentStatus, req.user.id);
  }

  @Patch(':id/shipping')
  updateShipping(
    @Param('id') id: string,
    @Body() dto: { 
      carrier: string; 
      trackingNumber: string; 
      trackingUrl?: string; 
      shippedAt?: string; 
      deliveredAt?: string;
    },
    @Req() req: any,
  ) {
    return this.service.updateShipping(id, dto, req.user.id);
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: { content: string },
    @Req() req: any,
  ) {
    return this.service.addNote(id, dto.content, req.user.id);
  }
}
