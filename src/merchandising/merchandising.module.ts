import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchandisingController } from './merchandising.controller';
import { MerchandisingService } from './merchandising.service';

@Module({
  imports: [PrismaModule],
  controllers: [MerchandisingController],
  providers: [MerchandisingService],
  exports: [MerchandisingService],
})
export class MerchandisingModule {}
