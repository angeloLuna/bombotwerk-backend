import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('BACKEND_JWT_SECRET') ||
      'fallback-secret-for-jwt-signing-12345';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      return true; // No authorization header, proceed as guest
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return true; // Invalid token format, proceed as guest
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (decoded && decoded.userId) {
        // Verify user exists in database to prevent stale guest session linking errors
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (user) {
          // Attach user profile info to request context
          request.user = {
            id: user.id,
            email: user.email,
            role: user.role,
          };
        }
      }
    } catch (error: any) {
      // Invalid or expired token, proceed as guest rather than throwing error
      console.warn('[OptionalJwtAuthGuard] Invalid or expired token:', error?.message);
    }

    return true;
  }
}
