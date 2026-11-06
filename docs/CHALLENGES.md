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

The app can _require_ a photo for every weight entry, store it privately, and link it to that entry. It can't _prove_ the photo shows that number or that person; automatic digit reading (OCR) on scale displays is unreliable. **Approach for now:** evidence is mandatory and stored with a hash (re-uploading the same photo is detected). Automatic reading of the number could be an optional later addition.

## 6. Email for password recovery

Password recovery needs a working email service and a verified sender domain. **Decision:** for now emails are sent from a Gmail account over SMTP (Nodemailer), using a Gmail _app password_ stored as an environment variable, never the normal password. Everything goes through one email adapter, so switching to a provider with its own domain later is a configuration change. Check: Railway blocks outgoing SMTP on some plans; if that applies, an HTTP-based mail API is the fallback.

## 7. Seven languages, including generated text

Interface text is straightforward with i18n files. Reports and notifications are generated on the server, so they're stored as translation keys + parameters and translated in the browser. Translations for seven languages will be drafted carefully but should ideally be checked by a native speaker.

## 8. Reports that don't make things up

The report must only draw conclusions the data supports. **Approach:** rule-based conclusions with minimum-data thresholds (e.g. no trend with fewer than two sessions in a week); reasons are only quoted from the user's own reflections. No AI text generation.

## 9. Account deletion across database and storage

See [DATABASE.md](DATABASE.md#notes). Database rows cascade; files are deleted separately with a retry mechanism.

## 10. Development database

**Decision:** no local MySQL server. The Railway MySQL server holds two databases: `pace_dev` for development and `railway` for production. Development connects to `pace_dev`, and MySQL Workbench connects to it through Railway's public TCP proxy. The connection string lives only in `server/.env`, which is never committed. `prisma migrate dev` needs a temporary "shadow" database; the Railway root user is allowed to create it.

## 11. Constraints Prisma doesn't support

`CHECK` constraints (rating 1–5, duration limits) are added as raw SQL in the migration files. They're the last line of defence after Zod validation.

## 12. Definitions that affect the statistics

Decided definitions (they change the numbers):

- **Streak:** counted in **weeks**. A week counts when the user trained on at least as many days as their training-day goal (e.g. 5 days). A week below the goal resets the streak to 0. The current week only counts once the goal is reached, and it only breaks the streak after the week has ended. Rest days don't break anything. Without a day goal, there is no streak.
- **Streak achievements** follow this definition: 3-, 7- and 26-week streaks instead of day streaks.
- **Consistency:** the percentage of weeks in the selected period in which the training-day goal was reached (or, without a goal, training days ÷ days in the period).
- **Training days vs sessions:** two sessions on one day = 1 day, 2 sessions.
