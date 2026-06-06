import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Helper to map DB variants into the business-rule formatted availability
  private formatProductAvailabilities(product: any) {
    if (!product) return null;

    const formattedVariants = product.variants.map((v: any) => {
      let formattedImages = [];
      const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
      if (v.images) {
        formattedImages = v.images.map((img: any) => ({
          ...img,
          url: (img.key && publicBaseUrl) ? `${publicBaseUrl}/${img.key}` : img.url,
        }));
      }

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
        colorHex: v.colorHex,
        availabilityMode: v.availabilityMode,
        madeToOrderMinDays: v.madeToOrderMinDays,
        madeToOrderMaxDays: v.madeToOrderMaxDays,
        stocks: formattedStocks,
        images: formattedImages,
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

    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const formattedImages = (product.images || []).map((img: any) => ({
      ...img,
      url: (img.key && publicBaseUrl) ? `${publicBaseUrl}/${img.key}` : img.url,
    }));

    return {
      ...product,
      variants: formattedVariants,
      images: formattedImages,
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
    isFeatured?: boolean;
    sale?: boolean;
  }) {
    const where: any = { isActive: true };

    if (filters?.category) {
      where.category = { equals: filters.category, mode: 'insensitive' };
    }

    if (filters?.collection) {
      where.collection = { slug: filters.collection };
    }

    if (filters?.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
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
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: [
            { sortOrder: 'asc' },
            { isCover: 'desc' },
            { createdAt: 'asc' },
          ],
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

    if (filters?.sale === true) {
      formatted = formatted.filter((p) => {
        const hasDiscount = p.compareAtPrice !== null && p.compareAtPrice !== undefined;
        
        // Sum total stock quantities
        const totalStock = p.variants?.reduce((sum: number, v: any) => {
          return sum + (v.stocks?.reduce((sSum: number, s: any) => sSum + s.quantity, 0) ?? 0);
        }, 0) ?? 0;
        
        // Low stock is > 0 and <= 5 (as per requirements "también puede incluir productos con bajo stock")
        const hasLowStock = totalStock > 0 && totalStock <= 5;
        
        return hasDiscount || hasLowStock;
      });
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
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: [
            { sortOrder: 'asc' },
            { isCover: 'desc' },
            { createdAt: 'asc' },
          ],
        },
        collection: true,
      },
    });

    if (!product || !product.isActive) {
      const redirect = await this.prisma.redirect.findUnique({
        where: { source: `/product/${slug}` },
      });
      if (redirect) {
        return { redirect: true, destination: redirect.destination } as any;
      }
      throw new NotFoundException(`Product with slug "${slug}" not found.`);
    }

    return this.formatProductAvailabilities(product);
  }

  async findImagesByProductId(productId: string) {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [
        { sortOrder: 'asc' },
        { isCover: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return images.map((img) => ({
      ...img,
      url: (img.key && publicBaseUrl) ? `${publicBaseUrl}/${img.key}` : img.url,
    }));
  }
}
