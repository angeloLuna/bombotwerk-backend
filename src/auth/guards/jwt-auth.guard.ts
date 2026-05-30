import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwtSecret: string;

  constructor(private readonly configService: ConfigService) {
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
      
      // Attach user profile info to request context
      request.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
