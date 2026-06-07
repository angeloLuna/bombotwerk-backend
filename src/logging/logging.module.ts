import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogService } from './activity-log.service';
import { AuditLogService } from './audit-log.service';
import { ActivityLogController } from './activity-log.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService, AuditLogService],
  exports: [ActivityLogService, AuditLogService],
})
export class LoggingModule {}
