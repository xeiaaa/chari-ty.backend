import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsString()
  groupUploadId: string;

  @IsNumber()
  order: number;
}

export class ReorderGroupUploadsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  orderMap: ReorderItemDto[];
}
