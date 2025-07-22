import { GroupMemberRole, GroupType } from '../../../../generated/prisma';

export class OrganizationDto {
  id: string;
  type: GroupType;
  name: string;
  role: GroupMemberRole;
  dateActive: string;
}
