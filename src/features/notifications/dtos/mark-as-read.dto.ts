import { IsString, IsNotEmpty } from 'class-validator';

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
