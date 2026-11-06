/**
 * Creates the weekly report for one user right away, instead of waiting for Sunday 18:00.
 * For development and support, e.g. after restoring data. An existing report is kept.
 *
 *   npm run report:generate -w server -- <email> [weekStart YYYY-MM-DD]
 */
import { isIsoDate, startOfWeek } from '@pace/shared';
import { prisma } from '../src/lib/prisma';
import { dueWeekStart, generateReport } from '../src/modules/reports/generate';

const [email, week] = process.argv.slice(2);
if (!email || (week && !isIsoDate(week))) {
  console.error('Usage: npm run report:generate -w server -- <email> [weekStart YYYY-MM-DD]');
  process.exit(1);
}
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
  select: { id: true, profile: { select: { timezone: true } } },
});
if (!user?.profile) {
  console.error('No user with this email.');
  process.exit(1);
}
const { timezone } = user.profile;
const weekStart = week ? startOfWeek(week) : dueWeekStart(timezone);
const created = await generateReport({ prisma }, user.id, weekStart, timezone);
console.log(
  created
    ? `Report created for the week of ${weekStart}.`
    : `A report for ${weekStart} already existed.`,
);
await prisma.$disconnect();
