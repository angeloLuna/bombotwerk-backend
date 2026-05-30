// TODO: Protect with AdminGuard when admin authentication is implemented.

import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { AdminCollectionsService } from './admin-collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Controller('admin/collections')
export class AdminCollectionsController {
  constructor(private readonly service: AdminCollectionsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateCollectionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.service.update(id, dto);
  }
}
