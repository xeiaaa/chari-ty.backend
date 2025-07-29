import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CloudinaryAssetDto } from '../../../common/dtos/cloudinary-asset.dto';

export class GalleryItemDto {
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  asset: CloudinaryAssetDto;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class CreateGalleryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryItemDto)
  items: GalleryItemDto[];
}
