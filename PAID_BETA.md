# Paid Beta Operations

Last updated: 2026-06-08

LetterBrick paid beta should run as a controlled cohort before public paid
launch. The goal is to validate retention, AI coaching quality, and willingness
to pay without opening unlimited AI usage.

## Paid Beta Shape

Recommended cohort:

- Size: 100 users first, then 300 if support load is manageable
- Duration: 30 days
- Entry price: 6,900 KRW trial or 18,000 KRW workbook + 1 month
- Daily live AI quota: 6 calls per user
- Fallback: local coach analysis when quota is exhausted or API fails

## User Experience

The home screen now renders a Paid Beta panel.

Free / ungranted users see:

- local coach analysis
- no live AI API calls
- paid beta waiting state

Granted users see:

- active paid beta status
- daily live AI quota used / limit
- expiration date
- automatic fallback after quota exhaustion

## Grant Access

Dry run:

```bash
npm run beta:grant -- --dry-run --uid=test_uid --email=test@example.com
```

Grant by UID:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
npm run beta:grant -- --uid=USER_UID --email=user@example.com --days=30 --quota=6
```

Grant by email when the user already exists in `users`:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
npm run beta:grant -- --email=user@example.com --days=30 --quota=6
```

Optional flags:

- `--plan=paid_beta`
- `--cohort=beta-2026-06`
- `--source=manual`
- `--monthlyReport=false`

## Firestore Writes

The grant script writes:

- `paid_beta_entitlements/{uid}`
- `users/{uid}.paidBeta`
- `admin_paid_beta_grants/{runId}`

Users read only their own `paid_beta_entitlements/{uid}` document. Admins can
read and write all paid beta grant documents.

## Required Firebase Rules

Apply the paid beta rules documented in:

`FIREBASE_RULES.md`

## Beta Metrics

Track these before expanding the cohort:

- first session completion rate
- D2 return rate
- D7 retention
- live AI success rate
- local fallback rate
- daily quota exhaustion count
- refund / complaint count
- qualitative quote quality from user interviews

Minimum expansion bar:

- D7 retention: 20%+
- live AI success rate: 95%+
- refund / complaint rate: under 5%
- at least 10 strong user quotes from the first 100 users

## Launch Decision

Do not move to public paid launch until:

- live AI key works in production
- paid beta grants are visible in the app
- data quality and release report gates are pass or explainable warn
- paid beta users can finish a full growth and healing session
- at least one weekly operator review has checked records, feedback, AI errors,
  and support issues
