import { faker } from '@faker-js/faker';
import {
  Donation,
  DonationStatus,
  Fundraiser,
  User,
  PrismaClient,
} from '../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export const createFakeDonation = async (
  fundraiser: Fundraiser,
  donor?: User,
  override: Partial<Donation> = {},
) => {
  const donation = await prisma.donation.create({
    data: {
      id: faker.string.uuid(),
      fundraiserId: fundraiser.id,
      donorId: donor?.id || null,
      amount: new Decimal(
        faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      ),
      currency: fundraiser.currency,
      name: faker.person.fullName(),
      message: faker.lorem.sentence(),
      isAnonymous: faker.datatype.boolean(),
      status: DonationStatus.completed,
      stripeId: faker.string.alphanumeric(20),
      fundraiserLinkId: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...override,
    },
  });

  return { donation };
};

export const buildFakeDonation = (
  fundraiser: Fundraiser,
  override: Partial<{
    amount: number;
    currency: string;
    name?: string;
    message?: string;
    isAnonymous: boolean;
    status: DonationStatus;
    stripeId?: string;
    fundraiserLinkId?: string;
  }> = {},
) => {
  return {
    amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
    currency: fundraiser.currency,
    name: faker.person.fullName(),
    message: faker.lorem.sentence(),
    isAnonymous: faker.datatype.boolean(),
    status: DonationStatus.completed,
    stripeId: faker.string.alphanumeric(20),
    fundraiserLinkId: null,
    ...override,
  };
};

export const createFakeAnonymousDonation = async (
  fundraiser: Fundraiser,
  override: Partial<Donation> = {},
) => {
  return createFakeDonation(fundraiser, undefined, {
    isAnonymous: true,
    donorId: null,
    name: faker.person.fullName(),
    ...override,
  });
};

export const createFakePendingDonation = async (
  fundraiser: Fundraiser,
  donor?: User,
  override: Partial<Donation> = {},
) => {
  return createFakeDonation(fundraiser, donor, {
    status: DonationStatus.pending,
    stripeId: null,
    ...override,
  });
};

export const createFakeFailedDonation = async (
  fundraiser: Fundraiser,
  donor?: User,
  override: Partial<Donation> = {},
) => {
  return createFakeDonation(fundraiser, donor, {
    status: DonationStatus.failed,
    stripeId: faker.string.alphanumeric(20),
    ...override,
  });
};

export const createFakeRefundedDonation = async (
  fundraiser: Fundraiser,
  donor?: User,
  override: Partial<Donation> = {},
) => {
  return createFakeDonation(fundraiser, donor, {
    status: DonationStatus.refunded,
    stripeId: faker.string.alphanumeric(20),
    ...override,
  });
};
