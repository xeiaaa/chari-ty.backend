import { IsOptional, IsString } from 'class-validator';

export class UpdateGalleryItemDto {
  @IsOptional()
  @IsString()
  caption?: string;
}
