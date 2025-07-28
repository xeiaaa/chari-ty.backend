import { faker } from '@faker-js/faker/.';
import {
  AccountType,
  Group,
  GroupMember,
  GroupMemberRole,
  GroupMemberStatus,
  PrismaClient,
  User,
} from '../../generated/prisma';
import { createDevelopmentToken } from '../test-utils';
import { OnboardingDto } from 'src/features/auth/dtos/onboarding.dto';

const prisma = new PrismaClient();

interface CreateFakeUserOptions {
  accountType?: AccountType;
  setupComplete?: boolean;
}

interface CreateFakeUserResult {
  user: User;
  group?: Group;
  groupMember?: GroupMember;
}

interface CreateFakeUserWithTokenResult extends CreateFakeUserResult {
  token: string;
}

export const createFakeUser = async (
  options: CreateFakeUserOptions = {},
): Promise<CreateFakeUserResult> => {
  const { accountType = AccountType.individual, setupComplete = true } =
    options;

  const user = await prisma.user.create({
    data: {
      id: faker.string.uuid(),
      clerkId: faker.string.uuid(),
      email: faker.internet.email(),
      username: faker.internet.username(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      avatarUrl: faker.image.url(),
      bio: faker.lorem.paragraph(),
      accountType,
      setupComplete,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    },
  });

  if (setupComplete) {
    const companyName = faker.company.name();

    const group = await prisma.group.create({
      data: {
        name: companyName,
        slug: faker.helpers.slugify(companyName),
        type: accountType,
        description: faker.company.catchPhrase(),
        avatarUrl: faker.image.avatar(),
        website: faker.internet.url(),
        verified: accountType === AccountType.nonprofit,
        documentsUrls: [],
        ownerId: user.id,
        ein: accountType === AccountType.nonprofit ? faker.string.uuid() : null,
        members: {
          create: {
            userId: user.id,
            role: GroupMemberRole.owner,
            status: GroupMemberStatus.active,
          },
        },
      },
    });

    const groupMember = await prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          groupId: group.id,
          userId: user.id,
        },
      },
    });

    return { user, group, groupMember: groupMember || undefined };
  }

  return { user };
};

export const createFakeUserWithToken = async (
  options: CreateFakeUserOptions = {},
): Promise<CreateFakeUserWithTokenResult> => {
  const { user, group, groupMember } = await createFakeUser(options);
  const token = createDevelopmentToken(user.clerkId);
  return { user, group, token, groupMember };
};

export const addUserToGroup = async (
  user: User,
  group: Group,
  role: GroupMemberRole = GroupMemberRole.viewer,
  status: GroupMemberStatus = GroupMemberStatus.active,
) => {
  return await prisma.groupMember.create({
    data: {
      userId: user.id,
      groupId: group.id,
      role,
      status,
    },
  });
};

export const createIndividualOnboardingData = (
  override: Partial<OnboardingDto> = {},
) => {
  return {
    accountType: AccountType.individual,
    bio: faker.lorem.paragraph(),
    avatarUrl: faker.image.url(),
    ...override,
  };
};

export const createTeamOnboardingData = (
  override: Partial<OnboardingDto> = {},
) => {
  return {
    accountType: AccountType.team,
    name: faker.company.name(),
    mission: faker.company.catchPhrase(),
    avatarUrl: faker.image.url(),
    website: faker.internet.url(),
    documentsUrls: [faker.internet.url(), faker.internet.url()],
    members: [
      {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        role: GroupMemberRole.admin,
      },
    ],
    ...override,
  };
};

export const createNonprofitOnboardingData = (
  override: Partial<OnboardingDto> = {},
) => {
  return {
    accountType: AccountType.nonprofit,
    name: faker.company.name(),
    mission: faker.company.catchPhrase(),
    avatarUrl: faker.image.url(),
    website: faker.internet.url(),
    ein: faker.string.numeric(9),
    documentsUrls: [faker.internet.url(), faker.internet.url()],
    members: [
      {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        role: GroupMemberRole.admin,
      },
    ],
    ...override,
  };
};
