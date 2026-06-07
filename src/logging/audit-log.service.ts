import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    adminUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: any;
    after?: any;
    metadata?: any;
  }) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          adminUserId: data.adminUserId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          before: data.before || null,
          after: data.after || null,
          metadata: data.metadata || null,
        },
      });
    } catch (error) {
      console.error('[AuditLogService] Failed to create audit log:', error);
      // Fail silently to prevent administrative disruptions
    }
  }
}
