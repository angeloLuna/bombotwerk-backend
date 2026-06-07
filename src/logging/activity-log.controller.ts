import { Controller, Post, Body, Req, Headers } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Controller('activity-logs')
export class ActivityLogController {
  private jwtSecret: string;

  constructor(
    private readonly service: ActivityLogService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('BACKEND_JWT_SECRET') ||
      'fallback-secret-for-jwt-signing-12345';
  }

  @Post()
  async create(
    @Body() dto: {
      eventType: string;
      productId?: string;
      orderId?: string;
      guestEmail?: string;
      metadata?: any;
    },
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ) {
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        userId = decoded.userId || decoded.id || null;
      } catch (err) {
        // Silent catch for invalid/expired tokens in public storefront logger
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const resolvedIp = typeof ip === 'string' 
      ? ip.split(',')[0].trim() 
      : Array.isArray(ip) 
        ? ip[0] 
        : null;

    return this.service.log({
      userId,
      guestEmail: dto.guestEmail || null,
      orderId: dto.orderId || null,
      productId: dto.productId || null,
      eventType: dto.eventType,
      metadata: dto.metadata || {},
      ip: resolvedIp,
      userAgent,
    });
  }
}
