export class FundraisingOverviewDto {
  activeFundraisers: number;
  totalRaised: number;
  goalCompletionRate: {
    completed: number;
    total: number;
  };
  avgDonationPerFundraiser: number;
}

export class TeamOverviewDto {
  members: number;
  pendingInvitations: number;
  lastMemberJoined: {
    name: string;
    date: string;
  };
}

export class RecentActivityDto {
  type: 'fundraiser_created' | 'donation_received' | 'member_joined';
  user: string;
  action: string;
  target?: string;
  amount?: string;
  date: string;
}

export class FundraiserHighlightDto {
  name: string;
  raised?: number;
  goal?: number;
  created?: string;
  donations?: number;
  amount?: number;
}

export class FundraiserHighlightsDto {
  topPerforming: FundraiserHighlightDto;
  mostRecent: FundraiserHighlightDto;
  mostDonatedToday: FundraiserHighlightDto;
}

export class DashboardDto {
  fundraising: FundraisingOverviewDto;
  team: TeamOverviewDto;
  recentActivity: RecentActivityDto[];
  highlights: FundraiserHighlightsDto;
}
