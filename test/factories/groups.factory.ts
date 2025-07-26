import { faker } from '@faker-js/faker';
import {
  Group,
  PrismaClient,
  User,
  GroupMemberRole,
} from '../../generated/prisma';

const prisma = new PrismaClient();

export const createGroup = async (
  user: User,
  override: Partial<Group> = {},
) => {
  return await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        id: faker.string.uuid(),
        name: faker.company.name(),
        description: faker.lorem.paragraph(),
        slug: faker.helpers.slugify(faker.lorem.words(2)),
        type: 'team',
        ownerId: user.id,
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        ...override,
      },
    });

    const groupMember = await tx.groupMember.create({
      data: {
        id: faker.string.uuid(),
        userId: user.id,
        groupId: group.id,
        role: 'owner',
        status: 'active',
        joinedAt: faker.date.past(),
        createdAt: faker.date.past(),
      },
    });

    return { group, groupMember };
  });
};

export const createInvite = async (
  group: Group,
  identifier: { email: string } | { userId: string },
  role: GroupMemberRole,
) => {
  const groupMember = await prisma.groupMember.create({
    data: {
      id: faker.string.uuid(),
      userId: 'userId' in identifier ? identifier.userId : undefined,
      invitedEmail: 'email' in identifier ? identifier.email : undefined,
      groupId: group.id,
      role,
      status: 'invited',
      joinedAt: faker.date.past(),
      createdAt: faker.date.past(),
    },
  });

  return { groupMember };
};
