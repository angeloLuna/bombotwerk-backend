import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductTypeCardDto } from './dto/create-product-type-card.dto';
import { UpdateProductTypeCardDto } from './dto/update-product-type-card.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AdminMerchandisingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll() {
    return this.prisma.productTypeCard.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(dto: CreateProductTypeCardDto, adminUserId: string) {
    const card = await this.prisma.productTypeCard.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl,
        imageAlt: dto.imageAlt ?? null,
        badgeLabel: dto.badgeLabel ?? null,
        badgeType: dto.badgeType ?? null,
        href: dto.href,
        linkType: dto.linkType ?? 'category',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        highlight: dto.highlight !== undefined ? dto.highlight : false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_created_product_type_card',
        entityType: 'ProductTypeCard',
        entityId: card.id,
        after: JSON.parse(JSON.stringify(card)),
      },
    });

    return card;
  }

  async update(id: string, dto: UpdateProductTypeCardDto, adminUserId: string) {
    const existing = await this.prisma.productTypeCard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProductTypeCard ${id} not found`);

    const updated = await this.prisma.productTypeCard.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.imageAlt !== undefined && { imageAlt: dto.imageAlt || null }),
        ...(dto.badgeLabel !== undefined && { badgeLabel: dto.badgeLabel || null }),
        ...(dto.badgeType !== undefined && { badgeType: dto.badgeType || null }),
        ...(dto.href !== undefined && { href: dto.href }),
        ...(dto.linkType !== undefined && { linkType: dto.linkType }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.highlight !== undefined && { highlight: dto.highlight }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_updated_product_type_card',
        entityType: 'ProductTypeCard',
        entityId: id,
        before: JSON.parse(JSON.stringify(existing)),
        after: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }

  async delete(id: string, adminUserId: string) {
    const existing = await this.prisma.productTypeCard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProductTypeCard ${id} not found`);

    await this.prisma.productTypeCard.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_deleted_product_type_card',
        entityType: 'ProductTypeCard',
        entityId: id,
        before: JSON.parse(JSON.stringify(existing)),
      },
    });

    return { success: true };
  }

  async uploadImage(file: Express.Multer.File, adminUserId: string) {
    if (!file) {
      throw new BadRequestException('El archivo de imagen es requerido.');
    }

    const uploadResult = await this.storage.uploadFile(file, 'merchandising/uploads');

    await this.prisma.auditLog.create({
      data: {
        adminUserId,
        action: 'admin_uploaded_product_type_card_image',
        entityType: 'ProductTypeCardImage',
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
