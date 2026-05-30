import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Helper to map DB variants into the business-rule formatted availability
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

    let hasReadyToShip = false;
    let hasMadeToOrder = false;

    for (const v of formattedVariants) {
      for (const s of v.stocks) {
        if (s.availability === 'ready-to-ship') {
          hasReadyToShip = true;
        } else if (s.availability === 'crafted-cdmx') {
          hasMadeToOrder = true;
        }
      }
    }

    let productAvailability: 'ready-to-ship' | 'crafted-cdmx' | 'unavailable' = 'unavailable';
    let availabilityText = 'Agotado';

    if (hasReadyToShip) {
      productAvailability = 'ready-to-ship';
      availabilityText = 'Envío inmediato';
    } else if (hasMadeToOrder) {
      productAvailability = 'crafted-cdmx';
      availabilityText = 'Bajo pedido';
    }

    return {
      ...product,
      variants: formattedVariants,
      availability: productAvailability,
      availabilityText,
    };
  }

  async findAllActive(filters?: {
    category?: string;
    collection?: string;
    availability?: string;
    sort?: string;
    search?: string;
  }) {
    const where: any = { isActive: true };

    if (filters?.category) {
      where.category = { equals: filters.category, mode: 'insensitive' };
    }

    if (filters?.collection) {
      where.collection = { slug: filters.collection };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' }; // default
    if (filters?.sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (filters?.sort === 'price_desc') {
      orderBy = { price: 'desc' };
    } else if (filters?.sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy,
      include: {
        variants: {
          include: {
            stocks: true,
          },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        collection: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    let formatted = products.map((p) => this.formatProductAvailabilities(p));

    if (filters?.availability) {
      if (filters.availability === 'ready_to_ship') {
        formatted = formatted.filter((p) => p.availability === 'ready-to-ship');
      } else if (filters.availability === 'made_to_order') {
        formatted = formatted.filter((p) => p.availability === 'crafted-cdmx');
      }
    }

    return formatted;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        variants: {
          include: {
            stocks: true,
          },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        collection: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException(`Product with slug "${slug}" not found.`);
    }

    return this.formatProductAvailabilities(product);
  }
}
