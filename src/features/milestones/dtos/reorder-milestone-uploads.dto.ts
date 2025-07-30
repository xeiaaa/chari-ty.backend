import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderMilestoneItemDto {
  @IsString()
  milestoneUploadId: string;

  @IsNumber()
  order: number;
}

export class ReorderMilestoneUploadsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMilestoneItemDto)
  orderMap: ReorderMilestoneItemDto[];
}
