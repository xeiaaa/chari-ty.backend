import { GroupMemberRole } from '../../../../generated/prisma';

export class OrganizationDto {
  id: string;
  type: 'team' | 'nonprofit';
  name: string;
  role: GroupMemberRole;
  dateActive: string;
}
