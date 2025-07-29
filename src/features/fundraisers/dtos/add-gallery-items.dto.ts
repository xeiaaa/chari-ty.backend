import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GalleryItemDto {
  @IsString()
  publicId: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class AddGalleryItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryItemDto)
  items: GalleryItemDto[];
}
