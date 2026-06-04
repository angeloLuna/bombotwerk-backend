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

  async create(dto: CreateCollectionDto) {
    return this.prisma.collection.create({ data: dto });
  }

  async update(id: string, dto: UpdateCollectionDto) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Collection ${id} not found`);
    return this.prisma.collection.update({ where: { id }, data: dto });
  }

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('El archivo de imagen es requerido.');
    }

    const uploadResult = await this.storage.uploadFile(file, 'collections/uploads');
    return {
      url: uploadResult.publicUrl,
      key: uploadResult.key,
    };
  }
}
