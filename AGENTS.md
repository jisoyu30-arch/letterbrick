# LetterBrick Codex Guide

## Project Identity

LetterBrick is a Korean writing-practice and copywork service built around the promise:

> 매일 한 문장 앞에 다시 돌아오는 사람이 되는 것.

The product should feel like a calm writing ritual, not a challenge app. Avoid visual or copy patterns that make it feel like a 100-day completion race.

## Working Rules

- User-facing copy is Korean.
- Keep code, filenames, and internal comments practical and consistent with the existing static HTML/JS structure.
- Preserve the distinction between:
  - 성장편: sentence structure practice, transformation practice, scoring, growth feedback.
  - 힐링편: literary/healing passage, reason the passage is meaningful, copywork, reflection, AI coach response.
- When adding passages, include source attribution. If adapted or newly written, mark the source as `레터브릭 오리지널`.
- Avoid repeated exposure of the same phrase or passage when possible.
- Mobile copywork must keep the source passage visible or easily recoverable while the user types.
- Desktop copywork should not shrink the source passage just because the mobile behavior needs it.

## Sensitive Files

Do not commit or expose secret material without explicit review. This repository contains or has contained files such as:

- `.env`
- `.env.local`
- `.env.production`
- `serviceAccount.json`
- `google-credentials.json`

Before publishing or pushing, inspect `.gitignore`, `.vercelignore`, and Git status carefully.

## Important Surfaces

- Main app/demo: `public/index.html`, `public/demo.html`
- Crowdfunding: `public/crowdfunding.html`, `public/crowdfunding-tumblbug.html`, `crowdfunding.html`
- Admin: `public/admin.html`
- Taste test: `public/taste-test.html`
- Growth content: `public/growth-sentences.js`, `public/data.js`
- Google Sheets Apps Script: `scripts/google_apps_script.js`
- Visual direction: `DESIGN_GUIDELINES.md`

## Design Direction

Follow `DESIGN_GUIDELINES.md`. The key shift is from "100일 완주" to "매일 다시 돌아오는 루틴".

Use visual language such as:

- daily message arrival
- a writing chair or writing place the user returns to
- one line written again
- calm paper/serif/editorial mood

Avoid:

- countdown-heavy visuals
- completion trophies or stamps
- "Day 1 to Day 100" progress race language
- layouts that imply the service ends after 100 days

