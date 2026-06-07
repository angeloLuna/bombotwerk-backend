import { Controller, Get, Post, Patch, Param, Body, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { AdminCollectionsService } from './admin-collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin/collections')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCollectionsController {

  constructor(private readonly service: AdminCollectionsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateCollectionDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.service.uploadImage(file, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id);
  }
}
