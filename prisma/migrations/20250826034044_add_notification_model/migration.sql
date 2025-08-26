-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('donation_received', 'fundraiser_goal_reached', 'group_invitation', 'invitation_accepted', 'verification_request_submitted', 'verification_rejected', 'verification_approved');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('unread', 'read', 'archived');

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'unread',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "fundraiserId" TEXT,
    "groupId" TEXT,
    "donationId" TEXT,
    "invitationId" TEXT,
    "verificationRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "public"."fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "public"."donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "public"."group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "public"."group_verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
