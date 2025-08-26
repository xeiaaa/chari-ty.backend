import { Injectable } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../../../generated/prisma';

@Injectable()
export class NotificationHelpersService {
  constructor(private readonly notificationsService: NotificationsService) {}

  notifyDonationReceived(
    recipientId: string,
    data: {
      fundraiserId: string;
      fundraiserTitle: string;
      amount: number;
      currency: string;
      donorName?: string;
      message?: string;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.donation_received,
      data,
    );
  }

  notifyFundraiserGoalReached(
    recipientId: string,
    data: {
      fundraiserId: string;
      fundraiserTitle: string;
      goalAmount: number;
      currentAmount: number;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.fundraiser_goal_reached,
      data,
    );
  }

  notifyGroupInvitation(
    recipientId: string,
    data: {
      groupId: string;
      groupName: string;
      groupSlug: string;
      inviterName: string;
      role: string;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.group_invitation,
      data,
    );
  }

  notifyInvitationAccepted(
    recipientId: string,
    data: {
      groupId: string;
      groupName: string;
      acceptedBy: string;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.invitation_accepted,
      data,
    );
  }

  notifyVerificationRequestSubmitted(
    recipientId: string,
    data: {
      groupId: string;
      groupName: string;
      submittedBy: string;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.verification_request_submitted,
      data,
    );
  }

  notifyVerificationRejected(
    recipientId: string,
    data: {
      groupId: string;
      groupName: string;
      reason?: string;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.verification_rejected,
      data,
    );
  }

  notifyVerificationApproved(
    recipientId: string,
    data: {
      groupId: string;
      groupName: string;
    },
  ) {
    return this.notificationsService.notify(
      recipientId,
      NotificationType.verification_approved,
      data,
    );
  }
}
