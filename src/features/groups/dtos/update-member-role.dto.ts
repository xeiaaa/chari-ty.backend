import { IsEnum } from 'class-validator';
import { GroupMemberRole } from '../../../../generated/prisma';

/**
 * DTO for updating a group member's role
 */
export class UpdateMemberRoleDto {
  @IsEnum(GroupMemberRole, { message: 'Role must be admin, editor, or viewer' })
  role: Exclude<GroupMemberRole, 'owner'>;
}
