-- CreateEnum
CREATE TYPE "GroupMemberStatus" AS ENUM ('active', 'invited', 'removed');

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "status" "GroupMemberStatus" NOT NULL DEFAULT 'invited';
