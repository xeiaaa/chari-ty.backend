import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';

export class CloudinaryAssetDto {
  @IsString()
  @IsNotEmpty()
  cloudinaryAssetId: string;

  @IsString()
  @IsNotEmpty()
  publicId: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  eagerUrl?: string;

  @IsString()
  @IsNotEmpty()
  format: string;

  @IsString()
  @IsNotEmpty()
  resourceType: string;

  @IsNumber()
  size: number;

  @IsOptional()
  @IsNumber()
  pages?: number;

  @IsString()
  @IsNotEmpty()
  originalFilename: string;

  @IsString()
  @IsNotEmpty()
  uploadedAt: string;
}
