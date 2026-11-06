// Built-in sports and the achievement catalogue. Safe to run repeatedly.
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import { AchievementCategory, PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

// Muted, distinguishable colours for the calendar.
const SPORTS = [
  { slug: 'mma', name: 'MMA', color: '#C2413A' },
  { slug: 'kickboxing', name: 'Kickboxing', color: '#D97A2B' },
  { slug: 'boxing', name: 'Boxing', color: '#B8892F' },
  { slug: 'muay-thai', name: 'Muay Thai', color: '#9C5A3C' },
  { slug: 'bjj', name: 'BJJ', color: '#3E63B8' },
  { slug: 'wrestling', name: 'Wrestling', color: '#6A4FB3' },
  { slug: 'judo', name: 'Judo', color: '#2F7F9E' },
  { slug: 'gym', name: 'Gym / Strength', color: '#4B5563' },
  { slug: 'conditioning', name: 'Conditioning', color: '#2E8B6E' },
  { slug: 'running', name: 'Running', color: '#3B9C4A' },
  { slug: 'cycling', name: 'Cycling', color: '#7A8F2E' },
  { slug: 'swimming', name: 'Swimming', color: '#2C8FC4' },
  { slug: 'mobility', name: 'Mobility / Yoga', color: '#A35C8C' },
];

const ACHIEVEMENTS = [
  { code: 'FIRST_SESSION', category: AchievementCategory.MILESTONE, threshold: 1 },
  { code: 'STREAK_3W', category: AchievementCategory.STREAK, threshold: 3 },
  { code: 'STREAK_7W', category: AchievementCategory.STREAK, threshold: 7 },
  { code: 'STREAK_26W', category: AchievementCategory.STREAK, threshold: 26 },
  { code: 'WEEK_20H', category: AchievementCategory.VOLUME, threshold: 20 * 60 },
  { code: 'TOTAL_100H', category: AchievementCategory.VOLUME, threshold: 100 * 60 },
  { code: 'TOTAL_500H', category: AchievementCategory.VOLUME, threshold: 500 * 60 },
  { code: 'WEEKLY_GOAL', category: AchievementCategory.GOAL, threshold: 1, repeatable: true },
];

async function main() {
  for (const sport of SPORTS) {
    await prisma.sport.upsert({
      where: { slug: sport.slug },
      update: { name: sport.name, color: sport.color },
      create: sport,
    });
  }
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: { category: achievement.category, threshold: achievement.threshold },
      create: achievement,
    });
  }
  console.log(`Seeded ${SPORTS.length} sports and ${ACHIEVEMENTS.length} achievements.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
