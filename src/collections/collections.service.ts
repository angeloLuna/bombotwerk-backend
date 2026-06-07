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
        let availabilityText = 'Agotado';

        if (v.availabilityMode === 'discontinued') {
          availability = 'unavailable';
          availabilityText = 'Descontinuado';
        } else if (v.availabilityMode === 'made_to_order_only') {
          availability = 'crafted-cdmx';
          availabilityText = `Hecho bajo pedido · Entrega estimada ${v.madeToOrderMinDays ?? 7}–${v.madeToOrderMaxDays ?? 9} días`;
        } else if (s.quantity > 0) {
          availability = 'ready-to-ship';
          availabilityText = 'Disponible';
        } else if (s.quantity === 0 && v.availabilityMode === 'stock_and_made_to_order') {
          availability = 'crafted-cdmx';
          availabilityText = `Bajo pedido · Entrega estimada ${v.madeToOrderMinDays ?? 7}–${v.madeToOrderMaxDays ?? 9} días`;
        } else {
          availability = 'unavailable';
          availabilityText = 'Agotado';
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
        availabilityMode: v.availabilityMode,
        madeToOrderMinDays: v.madeToOrderMinDays,
        madeToOrderMaxDays: v.madeToOrderMaxDays,
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

  async findAll() {
    return this.prisma.collection.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        description: true,
        bgImage: true,
        coverImageUrl: true,
        heroImageUrl: true,
        sortOrder: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
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
            images: {
              orderBy: [
                { isCover: 'desc' },
                { sortOrder: 'asc' },
                { createdAt: 'asc' },
              ],
            },
          },
        },
      },
    });

    if (!collection) {
      const redirect = await this.prisma.redirect.findUnique({
        where: { source: `/colecciones/${slug}` },
      });
      if (redirect) {
        return { redirect: true, destination: redirect.destination } as any;
      }
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
