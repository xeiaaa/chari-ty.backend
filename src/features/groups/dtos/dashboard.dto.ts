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

export class FundraiserLinkStatsDto {
  totalTrafficSources: number;
  topPerformingLink: {
    alias: string;
    fundraiser: string;
    totalDonations: number;
    donationCount: number;
  };
  donationsFromSharedLinks: number;
  percentageFromSharedLinks: number;
  avgDonationPerLink: number;
}

export class EngagementInsightsDto {
  mostSharedFundraiser: {
    name: string;
    shareCount: number;
    totalRaised: number;
  };
  memberWithMostLinks: {
    name: string;
    linkCount: number;
    totalRaised: number;
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
  linkStats: FundraiserLinkStatsDto;
  engagementInsights: EngagementInsightsDto;
  recentActivity: RecentActivityDto[];
  highlights: FundraiserHighlightsDto;
}
