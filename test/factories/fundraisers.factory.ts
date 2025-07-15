import { CreateFundraiserDto } from '../../src/features/fundraisers/dtos/create-fundraiser.dto';
import { faker } from '@faker-js/faker';
import {
  Fundraiser,
  FundraiserCategory,
  FundraiserOwnerType,
  FundraiserStatus,
  Group,
  PrismaClient,
  User,
} from '../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export const createFakeFundraiser = async (
  owner: User | Group,
  override: Partial<Fundraiser> = {},
) => {
  const isUser = 'email' in owner;

  const fundraiser = await prisma.fundraiser.create({
    data: {
      id: faker.string.uuid(),
      status: FundraiserStatus.draft,
      slug: faker.helpers.slugify(faker.lorem.words(3)),
      title: faker.lorem.sentence(),
      summary: faker.lorem.paragraph(1),
      description: faker.lorem.paragraphs(3),
      category: FundraiserCategory.other,
      goalAmount: new Decimal(
        faker.number.float({ min: 100, max: 100000, fractionDigits: 2 }),
      ),
      currency: 'USD',
      endDate: faker.date.future(),
      coverUrl: faker.image.url(),
      galleryUrls: [faker.image.url(), faker.image.url()],
      ownerType: isUser ? FundraiserOwnerType.user : FundraiserOwnerType.group,
      userId: isUser ? owner.id : undefined,
      groupId: !isUser ? owner.id : undefined,
      isPublic: false,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...override,
    },
  });

  return { fundraiser };
};

export const buildFakeFundraiser = (
  owner: User | Group,
  override: Partial<CreateFundraiserDto> = {},
): CreateFundraiserDto => {
  const isUser = 'email' in owner;

  return {
    title: faker.lorem.sentence(),
    summary: faker.lorem.paragraph(1),
    description: faker.lorem.paragraphs(3),
    category: FundraiserCategory.other,
    goalAmount: faker.number.float({
      min: 100,
      max: 100000,
      fractionDigits: 2,
    }),
    currency: 'USD',
    endDate: faker.date.future().toISOString(),
    coverUrl: faker.image.url(),
    galleryUrls: [faker.image.url(), faker.image.url()],
    ownerType: isUser ? FundraiserOwnerType.user : FundraiserOwnerType.group,
    groupId: !isUser ? owner.id : undefined,
    isPublic: false,
    ...override,
  };
};
