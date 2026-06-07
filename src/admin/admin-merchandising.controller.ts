import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { AdminMerchandisingService } from './admin-merchandising.service';
import { CreateProductTypeCardDto } from './dto/create-product-type-card.dto';
import { UpdateProductTypeCardDto } from './dto/update-product-type-card.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin/merchandising/product-type-cards')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMerchandisingController {
  constructor(private readonly service: AdminMerchandisingService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateProductTypeCardDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.service.uploadImage(file, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductTypeCardDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.service.delete(id, req.user.id);
  }
}
