/*
  Warnings:

  - A unique constraint covering the columns `[userId,groupId]` on the table `group_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invitedEmail,groupId]` on the table `group_members` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "unique_user_group" ON "group_members"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_invitedEmail_group" ON "group_members"("invitedEmail", "groupId");
