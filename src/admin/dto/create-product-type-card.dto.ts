import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateProductTypeCardDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsOptional()
  @IsString()
  imageAlt?: string;

  @IsOptional()
  @IsString()
  badgeLabel?: string;

  @IsOptional()
  @IsString()
  badgeType?: string;

  @IsString()
  @IsNotEmpty()
  href: string;

  @IsOptional()
  @IsString()
  linkType?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  highlight?: boolean;
}
