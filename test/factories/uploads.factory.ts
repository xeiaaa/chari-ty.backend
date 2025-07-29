import { faker } from '@faker-js/faker';
import { Upload, User, PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const createFakeUpload = async (
  uploadedBy: User,
  override: Partial<Upload> = {},
) => {
  const upload = await prisma.upload.create({
    data: {
      id: faker.string.uuid(),
      cloudinaryAssetId: faker.string.alphanumeric(20),
      publicId: faker.string.alphanumeric(15),
      url: faker.image.url(),
      eagerUrl: faker.image.url(),
      format: faker.helpers.arrayElement(['jpg', 'png', 'gif', 'pdf']),
      resourceType: faker.helpers.arrayElement(['image', 'video', 'raw']),
      size: faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
      pages: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 50 }), {
        probability: 0.3,
      }),
      originalFilename: faker.system.fileName(),
      uploadedAt: faker.date.past(),
      uploadedById: uploadedBy.id,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...override,
    },
  });

  return { upload };
};

export const buildFakeUpload = (
  override: Partial<{
    cloudinaryAssetId: string;
    publicId: string;
    url: string;
    eagerUrl?: string;
    format: string;
    resourceType: string;
    size: number;
    pages?: number;
    originalFilename: string;
    uploadedAt: Date;
  }> = {},
) => {
  return {
    cloudinaryAssetId: faker.string.alphanumeric(20),
    publicId: faker.string.alphanumeric(15),
    url: faker.image.url(),
    eagerUrl: faker.image.url(),
    format: faker.helpers.arrayElement(['jpg', 'png', 'gif', 'pdf']),
    resourceType: faker.helpers.arrayElement(['image', 'video', 'raw']),
    size: faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
    pages: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 50 }), {
      probability: 0.3,
    }),
    originalFilename: faker.system.fileName(),
    uploadedAt: faker.date.past(),
    ...override,
  };
};

export const createFakeImageUpload = async (
  uploadedBy: User,
  override: Partial<Upload> = {},
) => {
  return createFakeUpload(uploadedBy, {
    format: faker.helpers.arrayElement(['jpg', 'png', 'gif']),
    resourceType: 'image',
    url: faker.image.url(),
    eagerUrl: faker.image.url(),
    pages: null,
    ...override,
  });
};

export const createFakePdfUpload = async (
  uploadedBy: User,
  override: Partial<Upload> = {},
) => {
  return createFakeUpload(uploadedBy, {
    format: 'pdf',
    resourceType: 'raw',
    url: faker.internet.url(),
    eagerUrl: null,
    pages: faker.number.int({ min: 1, max: 50 }),
    originalFilename: faker.system.fileName({ extensionCount: 0 }) + '.pdf',
    ...override,
  });
};

export const createFakeVideoUpload = async (
  uploadedBy: User,
  override: Partial<Upload> = {},
) => {
  return createFakeUpload(uploadedBy, {
    format: faker.helpers.arrayElement(['mp4', 'mov', 'avi']),
    resourceType: 'video',
    url: faker.internet.url(),
    eagerUrl: faker.internet.url(),
    pages: null,
    originalFilename: faker.system.fileName({ extensionCount: 0 }) + '.mp4',
    ...override,
  });
};
