import { IsArray, IsOptional, IsString } from 'class-validator';

export class MilestoneUploadItemDto {
  @IsString()
  publicId: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class AddMilestoneUploadsDto {
  @IsArray()
  items: MilestoneUploadItemDto[];
}
