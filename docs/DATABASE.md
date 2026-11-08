# Database design (proposal)

MySQL 8, managed through Prisma migrations. **The Prisma schema is the single source of truth**: MySQL Workbench is used to inspect data and query plans, not to change tables. A change made in Workbench would be overwritten or break the next migration.

## Conventions

- Primary keys: UUID strings (`CHAR(36)`). IDs can't be guessed or counted, which is an extra layer on top of the access checks.
- All user-owned tables have `userId` with `ON DELETE CASCADE`, so deleting an account removes everything that belongs to it.
- Training dates are stored as `DATE` in the user's local calendar (a session on Monday stays on Monday, whatever the timezone). Timestamps (`createdAt` …) are UTC.
- Durations are stored as whole minutes; hours/minutes is only a display format.
- Weight in kg as `DECIMAL(5,2)`, height in cm as `SMALLINT`.
- Value ranges Prisma can't express (ratings 1–5, duration 1–1440, weight, height) are added as `CHECK` constraints via raw SQL in the migration and also validated with Zod. MySQL doesn't allow a `CHECK` on a column used by a cascading foreign key, so "you can't befriend yourself" is enforced in the application.
- The schema actually in use is [server/prisma/schema.prisma](../server/prisma/schema.prisma); this page explains it.

## Overview

```
User ─1:1─ UserProfile
 │   ─1:1─ PrivacySettings
 │   ─1:1─ UserPreferences
 │   ─1:n─ AuthSession, PasswordResetToken
 │   ─n:m─ Sport            (via UserSport: "sports I practise")
 │   ─n:m─ Gym              (via UserGym: "gyms I train at")
 │   ─1:n─ Sport            (custom sports; system sports have ownerId NULL)
 │   ─1:n─ TrainingSession ── Sport, Gym
 │   ─1:n─ WeeklyGoal ── Sport (optional, for "3 MMA sessions")
 │   ─1:n─ WeeklyReport
 │   ─1:n─ WeightMeasurement ─1:1─ WeightEvidence
 │   ─1:n─ UserAchievement ── Achievement
 │   ─1:n─ Notification
 ├─ Friendship (requester ↔ addressee)
 └─ Reaction   (from user → target: session / achievement / streak / goal)
```

All 15 requested tables are included. Four extra tables are needed: `AuthSession` and `PasswordResetToken` for secure login and recovery, `UserSport` and `UserGym` for the many-to-many links between users and sports or gyms, and `Reaction` for congratulations/motivation.

## Draft Prisma schema

```prisma
// ---------- Accounts ----------

model User {
  id              String    @id @default(uuid()) @db.Char(36)
  email           String    @unique @db.VarChar(191)
  passwordHash    String    @db.VarChar(255)
  emailVerifiedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  profile       UserProfile?
  privacy       PrivacySettings?
  preferences   UserPreferences?
  authSessions  AuthSession[]
  resetTokens   PasswordResetToken[]
  sports        UserSport[]
  customSports  Sport[]             @relation("CustomSports")
  sessions      TrainingSession[]
  goals         WeeklyGoal[]
  reports       WeeklyReport[]
  weights       WeightMeasurement[]
  achievements  UserAchievement[]
  notifications Notification[]      @relation("NotificationRecipient")
  sentRequests     Friendship[]     @relation("Requester")
  receivedRequests Friendship[]     @relation("Addressee")
  reactionsGiven    Reaction[]      @relation("ReactionFrom")
  reactionsReceived Reaction[]      @relation("ReactionTo")
}

model UserProfile {
  userId        String        @id @db.Char(36)
  username      String        @unique @db.VarChar(30)
  firstName     String        @db.VarChar(60)
  bio           String?       @db.VarChar(280)
  avatarKey     String?       @db.VarChar(255)   // object storage key
  heightCm      Int?          @db.SmallInt
  trainingLevel TrainingLevel @default(BEGINNER)
  personalGoals String?       @db.Text
  timezone      String        @default("Europe/Amsterdam") @db.VarChar(64)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([firstName])
}
// "Current weight" is not stored here: it is the latest WeightMeasurement,
// so there is no second copy that can get out of sync.

model AuthSession {
  id         String   @id @default(uuid()) @db.Char(36)
  userId     String   @db.Char(36)
  tokenHash  String   @unique @db.Char(64)
  userAgent  String?  @db.VarChar(255)
  createdAt  DateTime @default(now())
  lastUsedAt DateTime @default(now())
  expiresAt  DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Char(36)
  userId    String    @db.Char(36)
  tokenHash String    @unique @db.Char(64)
  expiresAt DateTime
  usedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model PrivacySettings {
  userId               String     @id @db.Char(36)
  discoverable         Boolean    @default(true)      // search & suggestions show only username, first name, avatar
  profileVisibility    Visibility @default(FRIENDS)   // bio, gym, sports
  activityVisibility   Visibility @default(FRIENDS)   // date, sport, duration, weekly hours
  streaksVisibility    Visibility @default(FRIENDS)
  achievementsVisibility Visibility @default(FRIENDS)
  dashboardVisibility  Visibility @default(PRIVATE)   // weekly report / stats
  weightVisibility     Visibility @default(PRIVATE)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserPreferences {
  userId    String   @id @db.Char(36)
  language  Language @default(EN)
  theme     Theme    @default(SYSTEM)
  textSize  TextSize @default(MEDIUM)
  notifyFriendRequests    Boolean @default(true)
  notifyFriendAccepted    Boolean @default(true)
  notifyFriendMilestones  Boolean @default(true)
  notifyReactions         Boolean @default(true)
  notifyWeeklyReport      Boolean @default(true)
  notifyStreaks           Boolean @default(true)
  notifyGoals             Boolean @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ---------- Training ----------

model Sport {
  id       String  @id @default(uuid()) @db.Char(36)
  slug     String? @unique @db.VarChar(40)   // built-in sports only, used for translation
  name     String  @db.VarChar(50)
  color    String  @db.Char(7)               // #RRGGBB for the calendar
  ownerId  String? @db.Char(36)              // NULL = built-in (MMA, BJJ, …)

  owner    User?             @relation("CustomSports", fields: [ownerId], references: [id], onDelete: Cascade)
  sessions TrainingSession[]
  users    UserSport[]
  goals    WeeklyGoal[]

  @@unique([ownerId, name])
}

model UserSport {
  userId  String @db.Char(36)
  sportId String @db.Char(36)

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  sport Sport @relation(fields: [sportId], references: [id], onDelete: Cascade)
  @@id([userId, sportId])
  @@index([sportId])
}

// A user can train at several gyms; the first (position 0) is the default for new sessions.
model UserGym {
  userId   String @db.Char(36)
  gymId    String @db.Char(36)
  position Int    @db.TinyInt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  gym  Gym  @relation(fields: [gymId], references: [id], onDelete: Cascade)
  @@id([userId, gymId])
  @@index([gymId])
}

model Gym {
  id          String  @id @default(uuid()) @db.Char(36)
  name        String  @db.VarChar(100)
  city        String  @db.VarChar(100)
  createdById String? @db.Char(36)

  members  UserGym[]
  sessions TrainingSession[]
  @@unique([name, city])     // shared list, so "same gym" suggestions work
}

model TrainingSession {
  id              String      @id @default(uuid()) @db.Char(36)
  userId          String      @db.Char(36)
  sportId         String      @db.Char(36)
  gymId           String?     @db.Char(36)
  date            DateTime    @db.Date
  durationMinutes Int         @db.SmallInt     // CHECK 1..1440
  punctuality     Punctuality                  // ON_TIME | LATE
  motivation      Int         @db.TinyInt      // before training, CHECK 1..5
  rating          Int         @db.TinyInt      // how it went, CHECK 1..5
  intensity       Int         @db.TinyInt      // CHECK 1..5
  reflection      String?     @db.Text         // PRIVATE: why it went well/badly
  shareDetails    Boolean     @default(false)  // explicit opt-in to show rating/reflection to friends
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  sport     Sport      @relation(fields: [sportId], references: [id], onDelete: Restrict)
  gym       Gym?       @relation(fields: [gymId], references: [id], onDelete: SetNull)

  @@index([userId, date])     // calendar, stats, streaks, reports
  @@index([sportId])
}
// Deleting a custom sport that still has sessions is blocked (Restrict, and a 409
// `sport_in_use` from the API); the user moves or deletes those sessions first.
// Because of this Restrict, account deletion removes the user's sessions explicitly
// before the user row: MySQL doesn't guarantee which of the two cascades runs first.

// ---------- Goals & reports ----------
// Goals are versioned: changing or deleting one sets archivedAt (and active = false)
// and, on a change, creates a new row. A week is measured against the goals that
// existed at its end, so old reports and streaks don't change afterwards.

model WeeklyGoal {
  id          String    @id @default(uuid()) @db.Char(36)
  userId      String    @db.Char(36)
  type        GoalType  // TOTAL_MINUTES | TRAINING_DAYS | PUNCTUALITY_PCT | SPORT_SESSIONS
  target      Int
  sportId     String?   @db.Char(36)   // required when type = SPORT_SESSIONS
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  archivedAt  DateTime?

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  sport Sport? @relation(fields: [sportId], references: [id], onDelete: Cascade)
  @@index([userId, active])
}

model WeeklyReport {
  id          String    @id @default(uuid()) @db.Char(36)
  userId      String    @db.Char(36)
  weekStart   DateTime  @db.Date        // Monday, local
  timezone    String    @db.VarChar(64)
  stats       Json      // totals, days, sessions, per sport, punctuality, avg duration
  goalResults Json      // snapshot: [{ goalId, type, target, actual, achieved }]
  comparison  Json      // vs previous week, with % change
  highlights  Json      // best/worst sessions + user's own reasons
  conclusion  Json      // [{ key, params }] -> translated in the client
  generatedAt DateTime  @default(now())
  viewedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, weekStart])   // idempotent generation
}

// ---------- Social ----------

model Friendship {
  id          String           @id @default(uuid()) @db.Char(36)
  requesterId String           @db.Char(36)
  addresseeId String           @db.Char(36)
  pairKey     String           @unique @db.Char(73)  // "<smallerId>:<largerId>" blocks A→B and B→A duplicates
  status      FriendshipStatus @default(PENDING)     // PENDING | ACCEPTED | DECLINED
  createdAt   DateTime         @default(now())
  respondedAt DateTime?

  requester User @relation("Requester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee User @relation("Addressee", fields: [addresseeId], references: [id], onDelete: Cascade)
  @@index([requesterId, status])
  @@index([addresseeId, status])
}

model Reaction {
  id         String       @id @default(uuid()) @db.Char(36)
  fromUserId String       @db.Char(36)
  toUserId   String       @db.Char(36)
  targetType ReactionTarget   // SESSION | ACHIEVEMENT | STREAK | WEEKLY_GOAL
  targetId   String       @db.VarChar(64)
  type       ReactionType     // RESPECT | WELL_DONE | KEEP_GOING
  createdAt  DateTime     @default(now())

  fromUser User @relation("ReactionFrom", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUser   User @relation("ReactionTo", fields: [toUserId], references: [id], onDelete: Cascade)
  @@unique([fromUserId, targetType, targetId, type])
  @@index([toUserId, createdAt])
}

model Achievement {
  id          String              @id @default(uuid()) @db.Char(36)
  code        String              @unique @db.VarChar(50)  // STREAK_3W, STREAK_7W, STREAK_26W, WEEK_20H, TOTAL_100H, WEEKLY_GOAL
  category    AchievementCategory
  threshold   Int
  repeatable  Boolean             @default(false)          // e.g. weekly goal reached

  users UserAchievement[]
}

model UserAchievement {
  id            String   @id @default(uuid()) @db.Char(36)
  userId        String   @db.Char(36)
  achievementId String   @db.Char(36)
  periodKey     String   @default("") @db.VarChar(10)  // "" or "2026-W45" for repeatables
  earnedAt      DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)
  @@unique([userId, achievementId, periodKey])
}

model Notification {
  id        String           @id @default(uuid()) @db.Char(36)
  userId    String           @db.Char(36)
  type      NotificationType
  actorId   String?          @db.Char(36)
  payload   Json             // { key, params, link }
  readAt    DateTime?
  createdAt DateTime         @default(now())

  user User @relation("NotificationRecipient", fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, readAt, createdAt])
}

// ---------- Weight ----------

model WeightMeasurement {
  id         String   @id @default(uuid()) @db.Char(36)
  userId     String   @db.Char(36)
  weightKg   Decimal  @db.Decimal(5, 2)
  measuredAt DateTime
  note       String?  @db.VarChar(280)
  createdAt  DateTime @default(now())

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  evidence WeightEvidence?
  @@index([userId, measuredAt])
}

model WeightEvidence {
  id            String   @id @default(uuid()) @db.Char(36)
  measurementId String   @unique @db.Char(36)
  storageKey    String   @db.VarChar(255)
  mimeType      String   @db.VarChar(50)
  sizeBytes     Int
  sha256        String   @db.Char(64)        // detects re-use of the same photo
  uploadedAt    DateTime @default(now())

  measurement WeightMeasurement @relation(fields: [measurementId], references: [id], onDelete: Cascade)
}
```

Enums: `TrainingLevel` (BEGINNER, INTERMEDIATE, ADVANCED, COMPETITIVE, PROFESSIONAL), `Visibility` (PRIVATE, FRIENDS), `Language` (NL, EN, DE, FR, PT, IT, ES), `Theme` (LIGHT, DARK, SYSTEM), `TextSize` (SMALL, MEDIUM, LARGE), plus the ones named in the comments above.

## Housekeeping

`PendingFileDeletion (id, key, attempts, lastError, createdAt)`: storage keys to delete. Rows are written in the same transaction as the database change that orphans a file (replacing an avatar, deleting an account), then processed immediately (only that request's own keys); failures are retried every 15 minutes by the scheduler. Processing is idempotent, so concurrent runs over the same rows are harmless.

## Notes

- **Cascades and files:** a database cascade can't delete files in the bucket. Account deletion therefore first collects all storage keys (avatar, evidence), deletes the user (cascade removes all rows), then deletes the objects. If object deletion fails, the keys go into a retry queue so no orphaned photos remain.
- **Statistics are not stored** (except in weekly report snapshots). They are computed from `TrainingSession` using the `(userId, date)` index; at the volume of one person's sessions that takes milliseconds.
- **Friend activity feed** = sessions of accepted friends with `activityVisibility = FRIENDS`, selecting only `date, sport, durationMinutes`.
