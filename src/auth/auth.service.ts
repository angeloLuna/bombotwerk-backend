import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private adminEmails: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const adminEmailsEnv = this.configService.get<string>('ADMIN_EMAILS') || '';
    this.adminEmails = adminEmailsEnv
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  async googleLogin(payload: { email: string; name?: string; image?: string }) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    
    // Check if the user should be an admin
    const isAdmin = this.adminEmails.includes(normalizedEmail);
    const role = isAdmin ? 'admin' : 'customer';

    // Upsert the user in the database
    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: payload.name,
        image: payload.image,
        role: role, // Keep role up-to-date in case ADMIN_EMAILS env variable changes
      },
      create: {
        email: normalizedEmail,
        name: payload.name,
        image: payload.image,
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
