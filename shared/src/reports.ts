import type { GoalResult } from './goals';
import type { Sport } from './profile';
import type { PeriodTotals } from './stats';

/** One sentence of the conclusion, translated in the client. Params are numbers or names. */
export interface ReportLine {
  key: string;
  params?: Record<string, string | number>;
}

export interface ReportSession {
  id: string;
  date: string;
  sport: Sport;
  durationMinutes: number;
  rating: number;
  energy: number | null;
  intensity: number | null;
  motivation: number | null;
  /** The user's own words; never generated. */
  reflection: string | null;
  /** Added November 2026; missing in reports generated before. All the user's own words. */
  ratingReason?: string | null;
  energyReason?: string | null;
  injured?: boolean;
  injuryNote?: string | null;
  injuryCause?: string | null;
}

export interface WeekSummary extends PeriodTotals {
  weekStart: string;
  perDay: { date: string; minutes: number }[];
  goalsAchieved: number;
  goalsTotal: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  generatedAt: string;
  viewedAt: string | null;
  stats: WeekSummary;
  goalResults: GoalResult[];
  /** The week before, computed at the same moment; null without any activity then. */
  previous: WeekSummary | null;
  highlights: {
    best: ReportSession[];
    worst: ReportSession[];
    /** Sessions with low or high energy and the reason given. Missing in older reports. */
    energy?: ReportSession[];
    /** Sessions with an injury. Missing in older reports. */
    injuries?: ReportSession[];
  };
  conclusion: { summary: ReportLine[]; wentWell: ReportLine[]; improve: ReportLine[] };
  streak: number | null;
}

export interface ReportListItem {
  weekStart: string;
  generatedAt: string;
  viewedAt: string | null;
  totalMinutes: number;
  trainingDays: number;
  sessions: number;
  goalsAchieved: number;
  goalsTotal: number;
}
