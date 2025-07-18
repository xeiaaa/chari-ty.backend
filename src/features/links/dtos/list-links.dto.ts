import { IsOptional, IsString } from 'class-validator';

export class ListLinksDto {
  @IsOptional()
  @IsString()
  search?: string;
}
