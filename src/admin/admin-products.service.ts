import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

const PRODUCT_INCLUDE = {
  variants: {
    include: {
      stocks: true,
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  images: {
    orderBy: [
      { sortOrder: 'asc' as const },
      { isCover: 'desc' as const },
      { createdAt: 'asc' as const },
    ],
  },
  collection: {
    select: { id: true, name: true, slug: true },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── List ───────────────────────────────────────────────────────────────────

  private formatProductImages(product: any) {
    if (!product) return null;
    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (product.images) {
      product.images = product.images.map((img: any) => ({
        ...img,
        url: (img.key && publicBaseUrl) ? `${publicBaseUrl}/${img.key}` : img.url,
      }));
    }
    if (product.variants) {
      product.variants = product.variants.map((v: any) => {
        if (v.images) {
          v.images = v.images.map((img: any) => ({
            ...img,
            url: (img.key && publicBaseUrl) ? `${publicBaseUrl}/${img.key}` : img.url,
          }));
        }
        return v;
      });
    }
    return product;
  }

  // ─── List ───────────────────────────────────────────────────────────────────

  async findAll() {
    const products = await this.prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => this.formatProductImages(p));
  }

  // ─── Single ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return this.formatProductImages(product);
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto, adminUserId: string) {
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
          isFeatured: dto.isFeatured ?? false,
          compareAtPrice: dto.compareAtPrice ?? null,
          collectionId: dto.collectionId ?? null,
          seoTitle: dto.seoTitle ?? null,
          seoDescription: dto.seoDescription ?? null,
          seoKeywords: dto.seoKeywords ?? null,
          canonicalSlug: dto.canonicalSlug ?? null,
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
            colorHex: v.colorHex ?? null,
            availabilityMode: v.availabilityMode ?? 'stock_only',
            madeToOrderMinDays: v.madeToOrderMinDays ?? 7,
            madeToOrderMaxDays: v.madeToOrderMaxDays ?? 9,
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

        if (v.images && v.images.length > 0) {
          await tx.variantImage.createMany({
            data: v.images.map((img: any, idx: number) => ({
              url: img.url,
              key: img.key ?? null,
              altText: img.alt || img.altText || null,
              sortOrder: img.sortOrder ?? idx,
              variantId: variant.id,
            })),
          });
        }
      }

      const res = await tx.product.findUnique({
        where: { id: product.id },
        include: PRODUCT_INCLUDE,
      });
      const formatted = this.formatProductImages(res);

      // Log Audit Log
      await tx.auditLog.create({
        data: {
          adminUserId,
          action: 'admin_created_product',
          entityType: 'Product',
          entityId: product.id,
          after: JSON.parse(JSON.stringify(formatted)),
        },
      });

      return formatted;
    });
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProductDto, adminUserId: string) {
    const existing = await this.findOne(id); // throws 404 if not found

    // If slug is being changed, check uniqueness
    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict)
        throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Create redirect if slug has changed
      if (dto.slug && dto.slug !== existing.slug) {
        await tx.redirect.upsert({
          where: { source: `/product/${existing.slug}` },
          update: { destination: `/product/${dto.slug}` },
          create: {
            source: `/product/${existing.slug}`,
            destination: `/product/${dto.slug}`,
          },
        });

        // Avoid redirect chains
        await tx.redirect.updateMany({
          where: { destination: `/product/${existing.slug}` },
          data: { destination: `/product/${dto.slug}` },
        });
      }

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
          ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
          ...(dto.compareAtPrice !== undefined && { compareAtPrice: dto.compareAtPrice || null }),
          ...(dto.collectionId !== undefined && { collectionId: dto.collectionId || null }),
          ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle || null }),
          ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription || null }),
          ...(dto.seoKeywords !== undefined && { seoKeywords: dto.seoKeywords || null }),
          ...(dto.canonicalSlug !== undefined && { canonicalSlug: dto.canonicalSlug || null }),
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
        // Find old variants
        const oldVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true },
        });
        const oldVariantIds = oldVariants.map((v) => v.id);

        // Delete old stocks
        await tx.sizeStock.deleteMany({
          where: { variantId: { in: oldVariantIds } },
        });

        // Track variant images being deleted
        const oldVariantImages = await tx.variantImage.findMany({
          where: { variantId: { in: oldVariantIds } },
          select: { key: true },
        });

        // Find new keys being saved
        const newKeys = new Set<string>();
        for (const v of dto.variants) {
          if (v.images) {
            for (const img of v.images) {
              if (img.key) newKeys.add(img.key);
            }
          }
        }

        // Delete old variant images from database
        await tx.variantImage.deleteMany({
          where: { variantId: { in: oldVariantIds } },
        });

        // Delete old variants
        await tx.productVariant.deleteMany({ where: { productId: id } });

        // Clean up R2 orphaned images
        const keysToDelete = oldVariantImages
          .map((img) => img.key)
          .filter((key): key is string => !!key && !newKeys.has(key));
        for (const key of keysToDelete) {
          try {
            await this.storage.deleteFile(key);
          } catch (err) {
            console.error(`Failed to delete key ${key} from R2:`, err);
          }
        }

        // Create new
        for (const v of dto.variants) {
          const variant = await tx.productVariant.create({
            data: {
              sku: v.sku!,
              color: v.color ?? null,
              colorHex: v.colorHex ?? null,
              availabilityMode: v.availabilityMode ?? 'stock_only',
              madeToOrderMinDays: v.madeToOrderMinDays ?? 7,
              madeToOrderMaxDays: v.madeToOrderMaxDays ?? 9,
              productId: id,
            },
          });

          if (v.stocks && v.stocks.length > 0) {
            await tx.sizeStock.createMany({
              data: v.stocks.map((s) => ({
                size: s.size!,
                quantity: s.quantity ?? 0,
                variantId: variant.id,
              })),
            });
          }

          if (v.images && v.images.length > 0) {
            await tx.variantImage.createMany({
              data: v.images.map((img: any, idx: number) => ({
                url: img.url,
                key: img.key ?? null,
                altText: img.alt || img.altText || null,
                sortOrder: img.sortOrder ?? idx,
                variantId: variant.id,
              })),
            });
          }
        }
      }

      const res = await tx.product.findUnique({
        where: { id },
        include: PRODUCT_INCLUDE,
      });
      const formatted = this.formatProductImages(res);

      // Log Audit Log
      await tx.auditLog.create({
        data: {
          adminUserId,
          action: 'admin_updated_product',
          entityType: 'Product',
          entityId: id,
          before: JSON.parse(JSON.stringify(existing)),
          after: JSON.parse(JSON.stringify(formatted)),
        },
      });

      // If variants/stocks were updated, log admin_updated_inventory
      if (dto.variants !== undefined) {
        await tx.auditLog.create({
          data: {
            adminUserId,
            action: 'admin_updated_inventory',
            entityType: 'Product',
            entityId: id,
            before: JSON.parse(JSON.stringify(existing.variants || [])),
            after: JSON.parse(JSON.stringify(formatted.variants || [])),
          },
        });
      }

      return formatted;
    });
  }

  // ─── Deactivate (soft-delete) ────────────────────────────────────────────────

  async deactivate(id: string, adminUserId: string) {
    const existing = await this.findOne(id);
    const res = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_product',
        entityType: 'Product',
        entityId: id,
        before: JSON.parse(JSON.stringify(existing)),
        after: JSON.parse(JSON.stringify(res)),
        metadata: { deactivated: true },
      },
    });

    return res;
  }

  // ─── Image Management ────────────────────────────────────────────────────────

  async uploadImage(
    productId: string,
    file: Express.Multer.File,
    alt?: string,
    type?: any,
    isCover?: boolean,
    sortOrder?: number,
    adminUserId?: string,
  ) {
    // 1. Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    // 2. Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato de archivo no permitido. Solo se aceptan JPEG, PNG y WEBP.');
    }

    // 3. Validate file size (5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('El archivo excede el tamaño máximo permitido de 5MB.');
    }

    // 4. Upload to R2
    const uploadResult = await this.storage.uploadFile(file, productId);

    // 5. Determine if it is the first image
    const imageCount = await this.prisma.productImage.count({
      where: { productId },
    });
    const shouldBeCover = isCover ?? (imageCount === 0);

    // 6. If setting this to cover, unset all other images for this product
    if (shouldBeCover) {
      await this.prisma.productImage.updateMany({
        where: { productId },
        data: { isCover: false },
      });
    }

    // 7. Save metadata in database
    const newImage = await this.prisma.productImage.create({
      data: {
        productId,
        url: uploadResult.publicUrl,
        key: uploadResult.key,
        alt: alt || null,
        type: type || 'catalog',
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        isCover: shouldBeCover,
      },
    });

    if (adminUserId) {
      await this.prisma.auditLog.create({
        data: {
          adminUserId,
          action: 'admin_uploaded_image',
          entityType: 'ProductImage',
          entityId: newImage.id,
          after: JSON.parse(JSON.stringify(newImage)),
          metadata: { productId },
        },
      });
    }

    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return {
      ...newImage,
      url: (newImage.key && publicBaseUrl) ? `${publicBaseUrl}/${newImage.key}` : newImage.url,
    };
  }

  async addImageUrl(
    productId: string,
    dto: { url: string; alt?: string; type?: string; isCover?: boolean; sortOrder?: number },
    adminUserId: string,
  ) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    if (!dto.url) {
      throw new BadRequestException('La URL de la imagen es requerida.');
    }

    // Determine if it is the first image
    const imageCount = await this.prisma.productImage.count({
      where: { productId },
    });
    const shouldBeCover = dto.isCover ?? (imageCount === 0);

    // If setting this to cover, unset all other images for this product
    if (shouldBeCover) {
      await this.prisma.productImage.updateMany({
        where: { productId },
        data: { isCover: false },
      });
    }

    const newImage = await this.prisma.productImage.create({
      data: {
        productId,
        url: dto.url,
        key: null,
        alt: dto.alt || null,
        type: (dto.type as any) || 'catalog',
        sortOrder: dto.sortOrder !== undefined ? Number(dto.sortOrder) : 0,
        isCover: shouldBeCover,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_uploaded_image',
        entityType: 'ProductImage',
        entityId: newImage.id,
        after: JSON.parse(JSON.stringify(newImage)),
        metadata: { productId },
      },
    });

    return newImage;
  }

  async updateImage(
    productId: string,
    imageId: string,
    dto: { alt?: string; type?: string; sortOrder?: number; isCover?: boolean },
    adminUserId: string,
  ) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    // Verify image exists and belongs to this product
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException(`Image with ID "${imageId}" not found for product "${productId}".`);
    }

    // If setting to cover, unset all other images for this product
    if (dto.isCover === true) {
      await this.prisma.productImage.updateMany({
        where: { productId, id: { not: imageId } },
        data: { isCover: false },
      });
    }

    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(dto.alt !== undefined && { alt: dto.alt }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.sortOrder !== undefined && { sortOrder: Number(dto.sortOrder) }),
        ...(dto.isCover !== undefined && { isCover: dto.isCover }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_product',
        entityType: 'ProductImage',
        entityId: imageId,
        before: JSON.parse(JSON.stringify(image)),
        after: JSON.parse(JSON.stringify(updated)),
        metadata: { productId, detail: 'Updated image metadata' },
      },
    });

    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return {
      ...updated,
      url: updated.key && publicBaseUrl ? `${publicBaseUrl}/${updated.key}` : updated.url,
    };
  }

  async reorderImages(productId: string, ids: string[], adminUserId: string) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    // Update each image's sortOrder in transaction
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.productImage.update({
          where: { id, productId },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_product',
        entityType: 'Product',
        entityId: productId,
        metadata: { reorderedImageIds: ids },
      },
    });

    return { success: true };
  }

  async deleteImage(productId: string, imageId: string, adminUserId: string) {
    // Verify image exists
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException(`Image with ID "${imageId}" not found for product "${productId}".`);
    }

    // Delete from R2 if key exists
    if (image.key) {
      try {
        await this.storage.deleteFile(image.key);
      } catch (err) {
        console.error(`Failed to delete key ${image.key} from R2:`, err);
      }
    }

    // Delete DB record
    await this.prisma.productImage.delete({
      where: { id: imageId },
    });

    // If deleted image was cover, promote another image if available
    if (image.isCover) {
      const nextImage = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      });
      if (nextImage) {
        await this.prisma.productImage.update({
          where: { id: nextImage.id },
          data: { isCover: true },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_deleted_image',
        entityType: 'ProductImage',
        entityId: imageId,
        before: JSON.parse(JSON.stringify(image)),
        metadata: { productId },
      },
    });

    return { success: true };
  }

  async uploadRawImage(productId: string, file: Express.Multer.File, adminUserId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    if (!file) {
      throw new BadRequestException('El archivo de imagen es requerido.');
    }

    const uploadResult = await this.storage.uploadFile(file, `products/${productId}`);
    return {
      url: uploadResult.publicUrl,
      key: uploadResult.key,
    };
  }

  async updateImagesBulk(
    productId: string,
    dto: { images: any[]; deletedImageIds: string[] },
    adminUserId: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    const { images, deletedImageIds } = dto;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete requested images
      if (deletedImageIds && deletedImageIds.length > 0) {
        const toDelete = await tx.productImage.findMany({
          where: { id: { in: deletedImageIds }, productId },
        });
        
        for (const img of toDelete) {
          if (img.key) {
            try {
              await this.storage.deleteFile(img.key);
            } catch (err) {
              console.error(`Failed to delete key ${img.key} from R2:`, err);
            }
          }
        }

        await tx.productImage.deleteMany({
          where: { id: { in: deletedImageIds }, productId },
        });
      }

      // 2. Resolve cover exclusivity
      let coverIndex = -1;
      for (let i = 0; i < images.length; i++) {
        if (images[i].isCover) {
          coverIndex = i;
          break;
        }
      }

      await tx.productImage.updateMany({
        where: { productId },
        data: { isCover: false },
      });

      // 3. Insert and update
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const isThisCover = coverIndex === i;

        if (img.id) {
          await tx.productImage.update({
            where: { id: img.id },
            data: {
              alt: img.alt || null,
              type: img.type || 'catalog',
              view: img.view || 'not_applicable',
              sortOrder: img.sortOrder ?? i,
              isCover: isThisCover,
            },
          });
        } else {
          await tx.productImage.create({
            data: {
              productId,
              url: img.url,
              key: img.key || null,
              alt: img.alt || null,
              type: img.type || 'catalog',
              view: img.view || 'not_applicable',
              sortOrder: img.sortOrder ?? i,
              isCover: isThisCover,
            },
          });
        }
      }

      // 4. Return updated images
      const updatedImages = await tx.productImage.findMany({
        where: { productId },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // Log bulk image update to audit log
      await tx.auditLog.create({
        data: {
          adminUserId,
          action: 'admin_updated_product',
          entityType: 'Product',
          entityId: productId,
          before: JSON.parse(JSON.stringify(product.images || [])),
          after: JSON.parse(JSON.stringify(updatedImages || [])),
          metadata: { detail: 'Bulk image update', deletedImageIds },
        },
      });

      const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
      return updatedImages.map((img) => ({
        ...img,
        url: img.key && publicBaseUrl ? `${publicBaseUrl}/${img.key}` : img.url,
      }));
    });
  }
}
