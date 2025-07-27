import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for accepting a group invitation
 */
export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'Group ID is required' })
  groupId: string;
}
