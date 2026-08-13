# LetterBrick Codex Handover

Last reviewed by Codex: 2026-06-04

## Current State

Codex can work directly in this project folder:

`C:\Users\njell\LetterBrick`

This is a mostly static HTML/JS project with Firebase/Google Sheets support scripts and crowdfunding/demo/admin pages. It has a Git repo on `main` tracking `origin/main`.

The current working tree is not clean. Notable status from the first Codex intake:

- Modified: `.gitignore`, `.vercelignore`, `crowdfunding.html`, `public/crowdfunding.html`
- Deleted tracked image assets under `public/images/`
- Added many new image assets, workbook preview HTML files, videos, scripts, and `public/growth-sentences.js`
- Added sensitive-looking untracked file: `.env.production`

Do not reset or discard these changes unless the user explicitly asks.

## Claude Work Context Found

Claude history suggests recent LetterBrick work involved:

- crowdfunding page revisions
- admin page expansion
- Google Sheets Apps Script integration
- taste-test result sharing and LetterBrick routing
- mobile source-passage visibility while typing
- growth/healing passage quality and attribution
- growth feedback becoming more personalized and less repetitive
- healing passage explanation under "이 문장이 특별한 이유" / "이 글이 좋은 이유"
- growth side removing the "special reason" block where it does not fit
- growth 30-day sentence filling

## High-Priority Risks

1. Secrets may be present in the repo folder.
   Review `.env*`, `serviceAccount.json`, and any Google/Firebase credentials before committing or deploying.

2. `public/crowdfunding.html` has a very large diff.
   Review visually before committing, because the diff includes thousands of line changes.

3. Several tracked images are deleted.
   Confirm whether the new replacement assets are intentional and whether old references still exist.

4. Source attribution needs a pass.
   Some passages use wording like `온:사유 번역`, `온:사유 의역`, or `원문 영감`. Check whether this matches the intended copyright/source policy.

5. Mobile/desktop behavior diverges intentionally.
   Mobile should keep the passage accessible while typing. Desktop should keep the fuller passage display.

## Suggested Next Work Order

1. Run a visual smoke test for:
   - `public/index.html`
   - `public/taste-test.html`
   - `public/admin.html`
   - `public/crowdfunding.html`
   - `public/dev-showcase.html`

2. Review Git changes for publish safety:
   - secrets
   - deleted images
   - broken image/video references
   - accidental generated files

3. Fix or verify core user issues:
   - mobile copywork source visibility
   - healing "이 글이 좋은 이유"
   - growth feedback variety
   - growth 30-day sentence data
   - taste-test share card and CTA routing
   - admin Google Sheets sync

4. Only after review, prepare a clean commit plan.

## Useful Commands

```powershell
git status --short --branch
git diff --stat
rg -n "특별한 이유|이 글이 좋은 이유|취향|공유|Google|Apps Script|시트|admin|관리자" public scripts js
```

For local viewing, this project may be opened as static files, but a simple local server is safer for assets:

```powershell
node scripts/local-static-server.cjs
```

Run it from `C:\Users\njell\LetterBrick` if a browser smoke test is needed.

## Dev Showcase

`public/dev-showcase.html` is a development-progress screen inspired by developer build reels:

- phone-sized live preview iframe
- code/work-log panel
- build timeline
- quick switches for main app, taste test, admin, and crowdfunding pages

Local URL after starting the server:

`http://127.0.0.1:8000/public/dev-showcase.html`
