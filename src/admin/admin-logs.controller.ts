import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit')
  async getAuditLogs(
    @Query('page') pageNum = '1',
    @Query('limit') limitNum = '20',
    @Query('adminUserId') adminUserId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const page = Math.max(1, parseInt(pageNum) || 1);
    const limit = Math.max(1, parseInt(limitNum) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (adminUserId) {
      where.adminUserId = adminUserId;
    }
    if (action) {
      where.action = action;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          adminUser: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: logs,
    };
  }

  @Get('activity')
  async getActivityLogs(
    @Query('page') pageNum = '1',
    @Query('limit') limitNum = '20',
    @Query('userId') userId?: string,
    @Query('guestEmail') guestEmail?: string,
    @Query('eventType') eventType?: string,
  ) {
    const page = Math.max(1, parseInt(pageNum) || 1);
    const limit = Math.max(1, parseInt(limitNum) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) {
      where.userId = userId;
    }
    if (guestEmail) {
      where.guestEmail = {
        contains: guestEmail,
        mode: 'insensitive',
      };
    }
    if (eventType) {
      where.eventType = eventType;
    }

    const [total, logs] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: logs,
    };
  }
}
