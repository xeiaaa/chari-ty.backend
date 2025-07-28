import { IsString, IsEnum, ValidateIf, IsEmail } from 'class-validator';
import { GroupMemberRole } from '../../../../generated/prisma';

/**
 * DTO for creating a group invitation
 */
export class CreateInviteDto {
  @ValidateIf((o) => !o.userId)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  userId?: string;

  @IsEnum(GroupMemberRole, { message: 'Role must be viewer, editor, or admin' })
  role: Exclude<GroupMemberRole, 'owner'>;
}
