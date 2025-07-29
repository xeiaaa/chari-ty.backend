import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GalleryItemOrderDto {
  @IsString()
  fundraiserGalleryId: string;

  @IsNumber()
  order: number;
}

export class ReorderGalleryItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryItemOrderDto)
  orderMap: GalleryItemOrderDto[];
}
