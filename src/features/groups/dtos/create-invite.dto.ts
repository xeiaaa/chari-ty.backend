import { IsString, IsEnum, ValidateIf } from 'class-validator';
import { GroupMemberRole } from '../../../../generated/prisma';

/**
 * DTO for creating a group invitation
 */
export class CreateInviteDto {
  @ValidateIf((o) => !o.userId)
  @IsString()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  userId?: string;

  @IsEnum(GroupMemberRole, { message: 'Role must be viewer, editor, or admin' })
  role: Exclude<GroupMemberRole, 'owner'>;
}
