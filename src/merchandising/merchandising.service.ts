import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MerchandisingService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductTypeCards() {
    return this.prisma.productTypeCard.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        imageUrl: true,
        imageAlt: true,
        badgeLabel: true,
        badgeType: true,
        href: true,
        linkType: true,
        sortOrder: true,
        highlight: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }
}
