import { IsArray, IsOptional, IsString } from 'class-validator';

export class GroupUploadItemDto {
  @IsString()
  publicId: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class AddGroupUploadsDto {
  @IsArray()
  items: GroupUploadItemDto[];
}
