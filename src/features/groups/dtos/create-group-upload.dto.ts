import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CloudinaryAssetDto } from '../../../common/dtos/cloudinary-asset.dto';

export class GroupUploadItemDto {
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  asset: CloudinaryAssetDto;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateGroupUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupUploadItemDto)
  items: GroupUploadItemDto[];
}
