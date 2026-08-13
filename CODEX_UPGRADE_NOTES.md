# LetterBrick Upgrade Notes

Last updated: 2026-06-04

## Developer Analysis

The current product direction is clear:

- LetterBrick is not a 100-day completion challenge.
- The main promise is returning to one sentence every day.
- Growth edition and healing edition should remain distinct.
- Mobile copywork must keep the source sentence visible.
- Passage attribution must survive the full flow: display, record, admin, and share.
- Admin should show operating signals, not only raw records.

## Applied In This Upgrade

1. Healing attribution fix
   - The healing flow now formats author and source together.
   - Saved healing records now include `healingPassage.source`.
   - Healing share cards now use the same source-aware credit formatter.

2. Taste-test routing fix
   - The result CTA now routes to local `index.html` while developing.
   - On deployed pages, it still routes to the production LetterBrick URL.
   - The selected edition and taste tags are passed as query parameters.

3. Admin operating dashboard
   - Added today participants.
   - Added recent 7-day record count.
   - Added unique logged-in users.
   - Added average session duration.
   - Added edition ratio insight.
   - Added repeat-user signal.
   - Clarified that the admin page uses Firestore while Google Sheets is a sync/support channel.

4. Build room
   - `localhost:8000/` now opens the automation build room.
   - The build room shows actual app-size preview, build playback, and engine logs.

5. Firebase as official data store
   - Firebase Authentication + Firestore is the official operating data path.
   - Google Sheets export is disabled by default with `ENABLE_SHEETS_SYNC = false`.
   - Admin insights now label Firebase/Firestore as the source of truth.

6. Anonymous Firebase guest mode
   - `로그인 없이 체험하기` now signs in with Firebase Anonymous Auth when available.
   - Anonymous users are saved with `isAnonymous: true`.
   - Guest records are written to `records/{uid}/entries` the same way as logged-in users.
   - If Anonymous Auth is unavailable, the app falls back to local-only guest mode.

7. Firebase Admin Health Panel
   - Admin now has a Firebase Health section for auth, Firestore reads, recent saves, and anonymous auth.
   - The panel reads the last local Firestore save status from `lb_last_firestore_save`.
   - The anonymous auth check uses a temporary secondary Firebase app so it does not disturb the admin login session.

8. Personalized onboarding from taste test
   - Taste-test results now render a recommendation panel on the main app home screen.
   - `edition` and `taste` query parameters are converted into a first-run growth/healing recommendation.
   - The recommendation CTA opens the matching edition and can start the healing recommendation automatically.

9. Passage source quality gate
   - Added `npm run audit:passages` for local content QA.
   - The audit checks missing text, source, author/inspiration, healing questions, duplicate text, theme balance, and length outliers.
   - Fixed missing source labels on the first three `HEALING_DAYS` records.
   - Added fallback `source` fields to the built-in healing passages in `index.html`.

10. Admin export snapshot
   - Added an Export Snapshot section to the admin dashboard.
   - Admin can filter recent Firestore entries by date range, edition, and user type.
   - Added CSV export for writing records and a separate CSV export for sogam/coach responses.
   - CSV output includes a UTF-8 BOM for spreadsheet compatibility.

11. Firestore export range expansion
   - Added an export scope selector: current dashboard records or expanded Firestore query.
   - Expanded export reads Firestore `collectionGroup('entries')` in 500-record pages with cursor pagination.
   - Client-side filters still apply after pagination, avoiding additional composite index requirements.
   - Export progress text shows query progress and completion count.

12. Monthly archive automation
   - Added a Monthly Archive section to the admin dashboard.
   - Admin can select a month and generate records/sogam CSV downloads for that month.
   - Archive metadata is saved to Firestore `admin_archives/{month}`.
   - Recent archive metadata is listed in the admin dashboard.

13. Archive storage upgrade
   - Added Firebase Storage SDK to the admin dashboard.
   - Monthly archive CSV files are uploaded to `admin_archives/{month}/{filename}` when Storage rules allow it.
   - `admin_archives/{month}` now stores upload status, Storage path, download URL, and upload errors.
   - Archive list renders records/sogam download links when Storage URLs are available.

14. Archive rules and retry controls
   - Added archive upload retry controls for `error` and `partial` archive states.
   - Added archive regenerate controls that rebuild the selected month and overwrite archive metadata.
   - Added archive delete controls with confirmation, including Firebase Storage object deletion.
   - Added `FIREBASE_RULES.md` with Firestore and Storage rules for admin-only archive access.

15. Scheduled archive automation
   - Added `scripts/generate-monthly-archive.cjs` for Firebase Admin SDK archive generation.
   - Added `.github/workflows/monthly-archive.yml` to run monthly archive generation on GitHub Actions.
   - Scheduled archives write records/sogam CSV files to Firebase Storage and metadata to `admin_archives/{month}`.
   - Added `admin_archive_runs/{runId}` execution logs for status, counts, upload results, and failure diagnostics.
   - Added `ARCHIVE_AUTOMATION.md` with secrets, manual run, dry-run, Firestore, and Storage operation notes.
   - Admin archive rows now show scheduled archive status when available.

16. Archive notification layer
   - Scheduled archive generation now writes `archive-result.json` for downstream notification.
   - Added `scripts/notify-archive-result.cjs` to write GitHub Actions Summary output after each archive run.
   - Added optional Slack notification support through the `ARCHIVE_SLACK_WEBHOOK_URL` GitHub secret.
   - The notification payload includes status, archive month, record counts, upload state, run URL, admin URL, and error text.
   - The workflow notification step runs with `always()` so failures still produce an operator-visible report.

17. Archive restore and audit view
   - Added an archive audit summary to the admin dashboard.
   - The audit view detects recent missing archive months, failed runs, duplicate scheduled runs, and unhealthy upload states.
   - Added archive detail controls for each month.
   - Archive detail shows counts, upload/schedule status, metadata checks, run history, and restore/download checklist.
   - Run history is read from `admin_archive_runs` and displayed without requiring a separate console.

18. Archive restore runner
   - Added `scripts/restore-monthly-archive.cjs` for controlled CSV-backed Firestore recovery.
   - Added `.github/workflows/archive-restore.yml` as a manual-only restore workflow.
   - Restore defaults to dry-run and requires `--commit` plus `RESTORE_CONFIRM=RESTORE_YYYY-MM` before writing records.
   - Restore parses records CSV, optionally merges sogam CSV by `uid/date/sentence`, detects duplicate entries, and previews restore candidates.
   - Restore logs are written to `admin_archive_restore_runs/{runId}` and surfaced in the admin archive detail view.
   - Restored documents use deterministic `restore_` document IDs and include restore metadata fields.

19. Data quality alerting
   - Added `scripts/data-quality-audit.cjs` for combined content and Firestore record quality checks.
   - Added `scripts/notify-data-quality.cjs` for GitHub Actions Summary and optional Slack notifications.
   - Added `.github/workflows/data-quality.yml` to run daily data quality checks.
   - Added `DATA_QUALITY.md` with schedule, commands, secrets, checks, and failure behavior.
   - Firestore checks run when `FIREBASE_SERVICE_ACCOUNT` is available; content checks still run without it.
   - The audit detects source/author regressions, duplicate content, malformed saved records, duplicate saved records, and recent record drops.

20. Admin quality console
   - Data quality audits now write latest and historical metadata to Firestore when service credentials are available.
   - Added admin-only `admin_data_quality/latest` and `admin_data_quality_runs/{runId}` rules documentation.
   - Added a Data Quality section to the admin dashboard.
   - The console shows latest status, error/warning counts, Firestore sample state, top issues, and recent run history.
   - The dashboard can now inspect data quality without opening GitHub Actions.

21. Quality remediation toolkit
   - Added `scripts/quality-remediation-map.cjs` to map data quality issue codes to owner, action, and checklist guidance.
   - Data quality results now include remediation guidance per issue.
   - Admin Data Quality top issues now show owner/action guidance.
   - Added `scripts/quality-duplicate-cleanup.cjs` for duplicate saved-record cleanup dry-runs.
   - Added `.github/workflows/quality-duplicate-cleanup.yml` as a manual-only cleanup workflow.
   - Duplicate cleanup defaults to dry-run and requires `QUALITY_DUPLICATE_CONFIRM=DELETE_DUPLICATES` for commit mode.

22. Release readiness console
   - Duplicate cleanup now stores latest and historical cleanup metadata in Firestore.
   - Added admin-only `admin_quality_cleanup/latest` and `admin_quality_cleanup_runs/{runId}` rules documentation.
   - Added a Release Readiness section to the admin dashboard.
   - The console combines Firebase read, data quality, monthly archive, archive job, restore run, duplicate cleanup, and content audit gates.
   - Each gate renders as pass, warn, or fail with a short operational detail.

23. Release report generator
   - Added `scripts/generate-release-report.cjs` to generate Markdown, HTML, and JSON release reports.
   - Added `.github/workflows/release-report.yml` for manual report generation and artifact upload.
   - Added `npm run release:report`.
   - Release reports read the same operational signals used by the admin readiness console.
   - Report metadata is written to `admin_release/latest` and `admin_release_reports/{reportId}` when Firebase credentials are available.
   - The admin readiness console now includes a Release report gate.

24. Paid beta hardening
   - Added a Paid Beta status panel to the app home screen.
   - Added client-side paid beta entitlement loading from `paid_beta_entitlements/{uid}`.
   - Live AI coaching now requires active paid beta access and a remaining daily quota.
   - Free users and quota-exhausted beta users fall back to local coach analysis instead of calling the live AI API.
   - Added `scripts/grant-paid-beta.cjs` and `npm run beta:grant` for controlled manual beta access grants.
   - Added `PAID_BETA.md` and Firestore rule documentation for paid beta grants.

25. Personal sentence accumulation
   - Added a home-screen sentence wall that shows the user's latest accumulated sentences.
   - Added a My Page sentence wall that separates personal writing from source passage records.
   - The wall extracts the strongest user-owned text per record: healing reflection, healing copy, creative writing, structure rewrite, or copy text.
   - Empty states now make it clear that completing a routine will stack the first personal sentence.

26. Brick house retention loop
   - Reframed visible reward language from stars to bricks where it affects user progress.
   - Added a home-screen brick house panel powered by accumulated growth and healing bricks.
   - The house now progresses through early stages such as first brick, foundation, small house, sentence house, and sentence library.
   - Edition cards, My Page summaries, and early-finish buttons now use brick language consistently.

27. Brick house pacing
   - Recalibrated house milestones around a 5-brick daily rhythm.
   - Small house now lands at 150 bricks, roughly one month of steady practice.
   - The 100-day upgrade now lands at 500 bricks as a second-floor sentence house.
   - Longer-term stages extend into sentence study, sentence library, and universe library goals.

## Proposed Next Upgrades

These need product approval before applying because they affect positioning, data model, or user experience.

### Proposal A. Deployment Handoff Pack

Prepare a final launch handoff package:

- release checklist
- required Firebase/GitHub/Vercel secrets
- post-launch monitoring steps
- rollback plan
- first 24-hour operator checklist

Why it matters: release reports now exist; the last step is giving a human operator a concrete launch/runbook package.
