import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    userId?: string | null;
    guestEmail?: string | null;
    orderId?: string | null;
    productId?: string | null;
    eventType: string;
    metadata?: any;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId: data.userId || null,
          guestEmail: data.guestEmail || null,
          orderId: data.orderId || null,
          productId: data.productId || null,
          eventType: data.eventType,
          metadata: data.metadata || {},
          ip: data.ip || null,
          userAgent: data.userAgent || null,
        },
      });
    } catch (error) {
      console.error('[ActivityLogService] Failed to create activity log:', error);
      // Fail silently to prevent interrupting user actions if logging fails
    }
  }
}
