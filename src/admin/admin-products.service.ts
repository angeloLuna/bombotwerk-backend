import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

const PRODUCT_INCLUDE = {
  variants: {
    include: {
      stocks: true,
    },
  },
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  collection: {
    select: { id: true, name: true, slug: true },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ───────────────────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Single ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    // Ensure slug is unique
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create product
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          price: dto.price,
          category: dto.category,
          isActive: dto.isActive ?? true,
          isNewArrival: dto.isNewArrival ?? false,
          collectionId: dto.collectionId ?? null,
        },
      });

      // 2. Create media records
      if (dto.mediaUrls && dto.mediaUrls.length > 0) {
        await tx.productMedia.createMany({
          data: dto.mediaUrls.map((url, i) => ({
            url,
            sortOrder: i,
            productId: product.id,
          })),
        });
      }

      // 3. Create variants + stocks
      for (const v of dto.variants) {
        const variant = await tx.productVariant.create({
          data: {
            sku: v.sku,
            color: v.color ?? null,
            madeToOrderEnabled: v.stocks.some((s) => s.madeToOrderEnabled),
            productId: product.id,
          },
        });

        await tx.sizeStock.createMany({
          data: v.stocks.map((s) => ({
            size: s.size,
            quantity: s.quantity,
            variantId: variant.id,
          })),
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: PRODUCT_INCLUDE,
      });
    });
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id); // throws 404 if not found

    // If slug is being changed, check uniqueness
    if (dto.slug) {
      const conflict = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict)
        throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update scalar fields
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isNewArrival !== undefined && { isNewArrival: dto.isNewArrival }),
          ...(dto.collectionId !== undefined && { collectionId: dto.collectionId || null }),
        },
      });

      // 2. Replace media if provided
      if (dto.mediaUrls !== undefined) {
        await tx.productMedia.deleteMany({ where: { productId: id } });
        if (dto.mediaUrls.length > 0) {
          await tx.productMedia.createMany({
            data: dto.mediaUrls.map((url, i) => ({
              url,
              sortOrder: i,
              productId: id,
            })),
          });
        }
      }

      // 3. Replace variants + stocks if provided
      if (dto.variants !== undefined) {
        // Delete old stocks + variants
        const oldVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true },
        });
        await tx.sizeStock.deleteMany({
          where: { variantId: { in: oldVariants.map((v) => v.id) } },
        });
        await tx.productVariant.deleteMany({ where: { productId: id } });

        // Create new
        for (const v of dto.variants) {
          const variant = await tx.productVariant.create({
            data: {
              sku: v.sku,
              color: v.color ?? null,
              madeToOrderEnabled: v.stocks?.some((s) => s.madeToOrderEnabled) ?? false,
              productId: id,
            },
          });

          if (v.stocks && v.stocks.length > 0) {
            await tx.sizeStock.createMany({
              data: v.stocks.map((s) => ({
                size: s.size,
                quantity: s.quantity,
                variantId: variant.id,
              })),
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: PRODUCT_INCLUDE,
      });
    });
  }

  // ─── Deactivate (soft-delete) ────────────────────────────────────────────────

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
