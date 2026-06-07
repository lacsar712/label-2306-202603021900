import StatCard from './StatCard.vue';
import LevelDistribution from './LevelDistribution.vue';
import ChannelPie from './ChannelPie.vue';
import BirthdayReminder from './BirthdayReminder.vue';
import CampaignBanner from './CampaignBanner.vue';
import CheckinTrend from './CheckinTrend.vue';
import TicketSLA from './TicketSLA.vue';
import PointsExpiry from './PointsExpiry.vue';

export const COMPONENT_MAP = {
  STAT_CARD: StatCard,
  LEVEL_DISTRIBUTION: LevelDistribution,
  CHANNEL_PIE: ChannelPie,
  BIRTHDAY_REMINDER: BirthdayReminder,
  CAMPAIGN_BANNER: CampaignBanner,
  CHECKIN_TREND: CheckinTrend,
  TICKET_SLA: TicketSLA,
  POINTS_EXPIRY: PointsExpiry,
};

export const COMPONENT_META = {
  STAT_CARD: { name: '统计卡片', icon: 'DataLine', defaultWidth: 3, defaultHeight: 3, minWidth: 2, maxWidth: 12, minHeight: 2, maxHeight: 12, config: { statType: 'TOTAL_MEMBERS' } },
  LEVEL_DISTRIBUTION: { name: '等级分布', icon: 'TrendCharts', defaultWidth: 6, defaultHeight: 6, minWidth: 4, maxWidth: 12, minHeight: 4, maxHeight: 12 },
  CHANNEL_PIE: { name: '渠道分布', icon: 'PieChart', defaultWidth: 6, defaultHeight: 6, minWidth: 4, maxWidth: 12, minHeight: 4, maxHeight: 12 },
  BIRTHDAY_REMINDER: { name: '生日提醒', icon: 'Bell', defaultWidth: 4, defaultHeight: 6, minWidth: 3, maxWidth: 12, minHeight: 4, maxHeight: 12 },
  CAMPAIGN_BANNER: { name: '活动 Banner', icon: 'Promotion', defaultWidth: 12, defaultHeight: 2, minWidth: 6, maxWidth: 12, minHeight: 2, maxHeight: 4 },
  CHECKIN_TREND: { name: '签到趋势', icon: 'Histogram', defaultWidth: 4, defaultHeight: 6, minWidth: 3, maxWidth: 12, minHeight: 4, maxHeight: 12, config: { days: 7 } },
  TICKET_SLA: { name: '工单 SLA 概览', icon: 'Tickets', defaultWidth: 4, defaultHeight: 6, minWidth: 3, maxWidth: 12, minHeight: 4, maxHeight: 12 },
  POINTS_EXPIRY: { name: '积分过期预警', icon: 'Clock', defaultWidth: 12, defaultHeight: 5, minWidth: 6, maxWidth: 12, minHeight: 4, maxHeight: 12 },
};

export const STAT_TYPES = [
  { value: 'TOTAL_MEMBERS', label: '总会员数' },
  { value: 'ACTIVE_MEMBERS', label: '活跃会员' },
  { value: 'TOTAL_POINTS', label: '总积分' },
  { value: 'TODAY_SIGNINS', label: '今日签到' },
  { value: 'OPEN_TICKETS', label: '待处理工单' },
  { value: 'PENDING_REVIEW_CAMPAIGNS', label: '待审核活动' },
];
