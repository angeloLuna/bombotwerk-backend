import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
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
      return true; // No authorization header, proceed as guest
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return true; // Invalid token format, proceed as guest
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Attach user profile info to request context
      request.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error: any) {
      // Invalid or expired token, proceed as guest rather than throwing error
      console.warn('[OptionalJwtAuthGuard] Invalid or expired token:', error?.message);
    }

    return true;
  }
}
