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
  Req,
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
  create(@Body() dto: CreateProductDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string, @Req() req: any) {
    return this.service.deactivate(id, req.user.id);
  }

  @Post(':productId/images')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt: string,
    @Body('type') type: string,
    @Body('isCover') isCover: string,
    @Body('sortOrder') sortOrder: string,
    @Req() req: any,
  ) {
    return this.service.uploadImage(
      productId,
      file,
      alt,
      type as any,
      isCover === 'true',
      sortOrder ? parseInt(sortOrder) : undefined,
      req.user.id,
    );
  }

  @Post(':productId/images/url')
  addImageUrl(
    @Param('productId') productId: string,
    @Body() dto: { url: string; alt?: string; type?: string; isCover?: boolean; sortOrder?: number },
    @Req() req: any,
  ) {
    return this.service.addImageUrl(productId, dto, req.user.id);
  }

  @Post(':productId/images/upload-raw')
  @UseInterceptors(FileInterceptor('file'))
  uploadRawImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.service.uploadRawImage(productId, file, req.user.id);
  }

  @Patch(':productId/images/bulk')
  updateImagesBulk(
    @Param('productId') productId: string,
    @Body() dto: { images: any[]; deletedImageIds: string[] },
    @Req() req: any,
  ) {
    return this.service.updateImagesBulk(productId, dto, req.user.id);
  }

  @Patch(':productId/images/reorder')
  reorderImages(
    @Param('productId') productId: string,
    @Body('ids') ids: string[],
    @Req() req: any,
  ) {
    return this.service.reorderImages(productId, ids, req.user.id);
  }

  @Patch(':productId/images/:imageId')
  updateImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() dto: { alt?: string; type?: string; sortOrder?: number; isCover?: boolean },
    @Req() req: any,
  ) {
    return this.service.updateImage(productId, imageId, dto, req.user.id);
  }

  @Delete(':productId/images/:imageId')
  @HttpCode(HttpStatus.OK)
  deleteImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Req() req: any,
  ) {
    return this.service.deleteImage(productId, imageId, req.user.id);
  }
}
