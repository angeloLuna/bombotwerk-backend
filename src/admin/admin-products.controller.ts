import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminProductsController {

  constructor(private readonly service: AdminProductsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Post(':productId/images')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt?: string,
    @Body('type') type?: string,
    @Body('isCover') isCover?: string,
    @Body('sortOrder') sortOrder?: string,
  ) {
    return this.service.uploadImage(
      productId,
      file,
      alt,
      type as any,
      isCover === 'true' || isCover === 'true' || false,
      sortOrder ? parseInt(sortOrder) : undefined,
    );
  }

  @Post(':productId/images/url')
  addImageUrl(
    @Param('productId') productId: string,
    @Body() dto: { url: string; alt?: string; type?: string; isCover?: boolean; sortOrder?: number },
  ) {
    return this.service.addImageUrl(productId, dto);
  }

  @Post(':productId/images/upload-raw')
  @UseInterceptors(FileInterceptor('file'))
  uploadRawImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadRawImage(productId, file);
  }

  @Patch(':productId/images/bulk')
  updateImagesBulk(
    @Param('productId') productId: string,
    @Body() dto: { images: any[]; deletedImageIds: string[] },
  ) {
    return this.service.updateImagesBulk(productId, dto);
  }

  @Patch(':productId/images/reorder')
  reorderImages(
    @Param('productId') productId: string,
    @Body('ids') ids: string[],
  ) {
    return this.service.reorderImages(productId, ids);
  }

  @Patch(':productId/images/:imageId')
  updateImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() dto: { alt?: string; type?: string; sortOrder?: number; isCover?: boolean },
  ) {
    return this.service.updateImage(productId, imageId, dto);
  }

  @Delete(':productId/images/:imageId')
  @HttpCode(HttpStatus.OK)
  deleteImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.deleteImage(productId, imageId);
  }
}
