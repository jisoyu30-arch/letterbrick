# Data Quality

Last updated: 2026-06-04

LetterBrick data quality checks run in GitHub Actions and can also run locally.

## Workflow

`.github/workflows/data-quality.yml`

Schedule:

- UTC: 00:20 daily
- KST: 09:20 daily

Manual execution is available through GitHub Actions `workflow_dispatch`.

## Commands

Run audit:

```bash
npm run audit:data-quality
```

Notify from an existing result file:

```bash
npm run audit:data-quality:notify
```

## Result File

Default result path:

`data-quality-result.json`

Override:

`DATA_QUALITY_RESULT_PATH`

## Firestore Writes

When `FIREBASE_SERVICE_ACCOUNT` is configured, the audit also writes:

`admin_data_quality/latest`

`admin_data_quality_runs/{runId}`

Stored fields include:

- `status`
- `startedAt`
- `completedAt`
- `issueCounts`
- `content`
- `firestore`
- `issuesTop`
- `issueTotal`
- `githubRunUrl`
- `source`

The admin dashboard reads these documents to render the Data Quality console.

## Checks

Content checks:

- missing text
- missing author/inspiration
- missing source
- unlabeled source
- duplicate content text
- short growth sentence
- missing growth learning point
- missing growth core skill
- invalid healing theme
- missing healing question
- short healing passage
- healing theme count drift

Firestore checks run only when `FIREBASE_SERVICE_ACCOUNT` is configured:

- recent 500 saved records sample
- malformed saved records
- duplicate `uid/date/sentence` records
- recent 7-day record drop
- today count

## Remediation Toolkit

Issue guidance is defined in:

`scripts/quality-remediation-map.cjs`

Each known issue code maps to:

- `owner`
- `action`
- `checklist`

The audit result includes this remediation object on each issue. The admin
dashboard displays owner/action guidance in the Data Quality console.

## Duplicate Cleanup

Manual workflow:

`.github/workflows/quality-duplicate-cleanup.yml`

Local dry-run:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' npm run quality:duplicates:dry
```

Local commit:

```bash
QUALITY_DUPLICATE_COMMIT=true QUALITY_DUPLICATE_CONFIRM=DELETE_DUPLICATES FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' npm run quality:duplicates:commit
```

Safety controls:

- cleanup is manual-only
- default mode is dry-run
- commit requires `--commit` and `QUALITY_DUPLICATE_CONFIRM=DELETE_DUPLICATES`
- duplicate grouping uses `uid/date/sentence`
- the oldest saved record is kept and later duplicates become delete candidates
- the workflow writes a JSON summary before any operator acts on it

Cleanup writes:

`admin_quality_cleanup/latest`

`admin_quality_cleanup_runs/{runId}`

The admin Release Readiness console reads the latest cleanup result as one of
its release gates.

## Release Readiness Console

The admin dashboard combines these gates:

- Firebase read
- Data quality
- Monthly archive
- Archive job
- Restore run
- Duplicate cleanup
- Content audit

Each gate renders as pass, warn, or fail. Missing operational history is treated
as warn, not fail, so a new environment can still boot cleanly while showing what
needs to be initialized.

## Release Report

Manual workflow:

`.github/workflows/release-report.yml`

Local command:

```bash
npm run release:report
```

With Firebase credentials, the report reads the latest operational signals from
Firestore and writes metadata to:

`admin_release/latest`

`admin_release_reports/{reportId}`

Generated files:

- `release-reports/{reportId}.md`
- `release-reports/{reportId}.html`
- `release-reports/{reportId}.json`

GitHub Actions uploads these files as an artifact and writes the Markdown report
to the run summary. If any gate is `fail`, the command exits with code 1 after
creating the report.

## Required Secret

For Firestore checks:

`FIREBASE_SERVICE_ACCOUNT`

Without this secret, content checks still run and Firestore checks are marked as
not checked.

## Optional Notification Secret

For Slack notifications:

`DATA_QUALITY_SLACK_WEBHOOK_URL`

When absent, the workflow still writes GitHub Actions Summary and skips Slack.

## Failure Behavior

- `error` issues make the audit command exit with code 1.
- `warn` issues keep the command successful but still appear in Summary/Slack.
- notification runs with `always()` so failed audits still report.
