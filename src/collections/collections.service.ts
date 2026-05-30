import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private prisma: PrismaService) {}

  private formatProductAvailabilities(product: any) {
    if (!product) return null;

    const formattedVariants = product.variants.map((v: any) => {
      const formattedStocks = v.stocks.map((s: any) => {
        let availability: 'ready-to-ship' | 'crafted-cdmx' | 'unavailable' = 'unavailable';
        let availabilityText = 'Unavailable';

        if (s.quantity > 0) {
          availability = 'ready-to-ship';
          availabilityText = 'Ships within 24h';
        } else if (s.quantity === 0 && v.madeToOrderEnabled) {
          availability = 'crafted-cdmx';
          availabilityText = 'Crafted in CDMX — Ready in 5–7 days';
        }

        return {
          id: s.id,
          size: s.size,
          quantity: s.quantity,
          availability,
          availabilityText,
        };
      });

      return {
        id: v.id,
        sku: v.sku,
        color: v.color,
        madeToOrderEnabled: v.madeToOrderEnabled,
        stocks: formattedStocks,
      };
    });

    return {
      ...product,
      variants: formattedVariants,
    };
  }

  async findAll() {
    return this.prisma.collection.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          include: {
            variants: {
              include: {
                stocks: true,
              },
            },
            media: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with slug "${slug}" not found.`);
    }

    const formattedProducts = collection.products.map((p) =>
      this.formatProductAvailabilities(p),
    );

    return {
      ...collection,
      products: formattedProducts,
    };
  }
}
