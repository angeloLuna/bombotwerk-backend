import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export function getAdminEmails(adminEmailsEnv: string): string[] {
  return adminEmailsEnv
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, adminEmailsEnv: string): boolean {
  if (!email) return false;
  return getAdminEmails(adminEmailsEnv).includes(email.trim().toLowerCase());
}

@Injectable()
export class AuthService {
  private adminEmailsEnv = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.adminEmailsEnv = this.configService.get<string>('ADMIN_EMAILS') || '';
  }

  async googleLogin(payload: { email: string; name?: string; image?: string; provider?: string }) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    
    // Check if the user should be an admin
    const isAdmin = isAdminEmail(normalizedEmail, this.adminEmailsEnv);
    const role = isAdmin ? 'admin' : 'customer';

    // Upsert the user in the database
    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: payload.name,
        image: payload.image,
        provider: payload.provider || 'google',
        role: role, // Keep role up-to-date in case ADMIN_EMAILS env variable changes
      },
      create: {
        email: normalizedEmail,
        name: payload.name,
        image: payload.image,
        provider: payload.provider || 'google',
        role: role,
      },
    });

    // Check if we can link this User to any existing Guest Customer record by email
    const customer = await this.prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });
    if (customer && !customer.userId) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { userId: user.id },
      });
    }

    return user;
  }
}
