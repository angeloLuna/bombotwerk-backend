import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AdminCollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll() {
    return this.prisma.collection.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateCollectionDto, adminUserId: string) {
    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        tagline: dto.tagline ?? null,
        description: dto.description ?? null,
        bgImage: dto.bgImage ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        heroImageUrl: dto.heroImageUrl ?? null,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        seoKeywords: dto.seoKeywords ?? null,
        imageAltText: dto.imageAltText ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_created_collection',
        entityType: 'Collection',
        entityId: collection.id,
        after: JSON.parse(JSON.stringify(collection)),
      },
    });

    return collection;
  }

  async update(id: string, dto: UpdateCollectionDto, adminUserId: string) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Collection ${id} not found`);

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.collection.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict)
        throw new BadRequestException(`Slug "${dto.slug}" is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.slug && dto.slug !== existing.slug) {
        await tx.redirect.upsert({
          where: { source: `/colecciones/${existing.slug}` },
          update: { destination: `/colecciones/${dto.slug}` },
          create: {
            source: `/colecciones/${existing.slug}`,
            destination: `/colecciones/${dto.slug}`,
          },
        });

        // Avoid redirect chains
        await tx.redirect.updateMany({
          where: { destination: `/colecciones/${existing.slug}` },
          data: { destination: `/colecciones/${dto.slug}` },
        });
      }

      const updated = await tx.collection.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.tagline !== undefined && { tagline: dto.tagline || null }),
          ...(dto.description !== undefined && { description: dto.description || null }),
          ...(dto.bgImage !== undefined && { bgImage: dto.bgImage || null }),
          ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl || null }),
          ...(dto.heroImageUrl !== undefined && { heroImageUrl: dto.heroImageUrl || null }),
          ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle || null }),
          ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription || null }),
          ...(dto.seoKeywords !== undefined && { seoKeywords: dto.seoKeywords || null }),
          ...(dto.imageAltText !== undefined && { imageAltText: dto.imageAltText || null }),
        },
      });

      await tx.auditLog.create({
        data: {
          adminUserId,
          action: 'admin_updated_collection',
          entityType: 'Collection',
          entityId: id,
          before: JSON.parse(JSON.stringify(existing)),
          after: JSON.parse(JSON.stringify(updated)),
        },
      });

      return updated;
    });
  }

  async uploadImage(file: Express.Multer.File, adminUserId: string) {
    if (!file) {
      throw new BadRequestException('El archivo de imagen es requerido.');
    }

    const uploadResult = await this.storage.uploadFile(file, 'collections/uploads');

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_uploaded_image',
        entityType: 'CollectionImage',
        entityId: uploadResult.key,
        after: { url: uploadResult.publicUrl },
      },
    });

    return {
      url: uploadResult.publicUrl,
      key: uploadResult.key,
    };
  }
}
