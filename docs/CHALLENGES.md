# Technical challenges

## 1. Timezones and week boundaries
"Sunday after 18:00 local time", "this week", and streaks all depend on the user's timezone, including daylight-saving changes and users who travel. **Approach:** store an IANA timezone per user, store training dates as local `DATE`, and do all week calculations with a timezone-aware library (`date-fns-tz` / `Temporal`). Unit tests cover the DST weekends in March and October.

## 2. Reliable Sunday reports on Railway
A server can restart or be down at exactly the wrong moment. **Approach:** no single "fire at 18:00" timer. A job runs every 15 minutes and generates every report that is due but missing; a unique key prevents duplicates. Opening the reports page also triggers generation if one is due. Only one app replica may run the scheduler unless a database lock is added.

## 3. Privacy: no data leaks via the API (IDOR)
The biggest risk in a social app is an endpoint that returns too much, or accepts someone else's id. **Approach:** owner queries are always filtered on the session's user id; friend views go through one policy module and field-limited mappers; a dedicated automated test suite tries to access every private resource as another user.

## 4. Photo metadata
Weighing-scale photos are usually taken at home with a phone, and contain GPS coordinates in their EXIF data. **Approach:** every upload is re-encoded server-side, which removes all metadata, before it is stored.

## 5. What "weight verification" can and can't do
The app can *require* a photo for every weight entry, store it privately, and link it to that entry. It can't *prove* the photo shows that number or that person; automatic digit reading (OCR) on scale displays is unreliable. **Approach for now:** evidence is mandatory and stored with a hash (re-uploading the same photo is detected). Automatic reading of the number could be an optional later addition.

## 6. Email for password recovery
Password recovery needs a working email service and a verified sender domain. **Approach:** an email adapter with a provider (e.g. Resend or any SMTP); in development, emails are printed to the console. A sender domain is needed for production.

## 7. Seven languages, including generated text
Interface text is straightforward with i18n files. Reports and notifications are generated on the server, so they're stored as translation keys + parameters and translated in the browser. Translations for seven languages will be drafted carefully but should ideally be checked by a native speaker.

## 8. Reports that don't make things up
The report must only draw conclusions the data supports. **Approach:** rule-based conclusions with minimum-data thresholds (e.g. no trend with fewer than two sessions in a week); reasons are only quoted from the user's own reflections. No AI text generation.

## 9. Account deletion across database and storage
See [DATABASE.md](DATABASE.md#notes). Database rows cascade; files are deleted separately with a retry mechanism.

## 10. Local development database
MySQL and Docker are not installed on this Mac yet. **Options:** `brew install mysql` (lightweight, recommended), or Docker Desktop with a `docker-compose.yml`. MySQL Workbench connects to it the same way in both cases.

## 11. Constraints Prisma doesn't support
`CHECK` constraints (rating 1–5, duration limits) are added as raw SQL in the migration files. They're the last line of defence after Zod validation.

## 12. Definitions that affect the statistics
A few terms need a fixed definition before building, because they change the numbers:
- **Streak:** consecutive calendar days with at least one session (a rest day breaks the streak) — or consecutive weeks reaching the day goal?
- **Consistency:** proposed as the percentage of weeks in the selected period in which the training-day goal was reached (or, without a goal, training days ÷ days in the period).
- **Training days vs sessions:** two sessions on one day = 1 day, 2 sessions.
