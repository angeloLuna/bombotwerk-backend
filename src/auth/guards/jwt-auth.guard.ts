import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization format. Expected Bearer <token>');
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (!decoded || !decoded.userId) {
        throw new UnauthorizedException('Invalid authentication token structure');
      }

      // Verify user exists in database to prevent foreign key errors (e.g. after DB resets)
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User no longer exists in database. Please log in again.');
      }

      // Attach user profile info to request context
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
