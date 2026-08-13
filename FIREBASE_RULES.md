# Firebase Rules Reference

Last updated: 2026-06-04

This file documents the production rules LetterBrick needs when Firebase is the
official data store.

## Admin Accounts

Current admin emails used by `public/admin.html`:

- `njell@kakao.com`
- `jisoyu30@gmail.com`

Keep this list synchronized with Firebase Authentication and the admin page.

## Firestore Rules

Use this pattern to keep user entries private while allowing admin-only archive
metadata access.

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn()
        && request.auth.token.email in [
          'njell@kakao.com',
          'jisoyu30@gmail.com'
        ];
    }

    match /records/{userId}/entries/{entryId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
      allow read: if isAdmin();
    }

    match /paid_beta_entitlements/{userId} {
      allow read: if signedIn() && request.auth.uid == userId;
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_archives/{month} {
      allow read, create, update, delete: if isAdmin()
        && month.matches('^\\d{4}-\\d{2}$');
    }

    match /admin_archive_runs/{runId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_archive_restore_runs/{runId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_data_quality/{docId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_data_quality_runs/{runId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_quality_cleanup/{docId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_quality_cleanup_runs/{runId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_release/{docId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_release_reports/{reportId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /admin_paid_beta_grants/{runId} {
      allow read, create, update, delete: if isAdmin();
    }
  }
}
```

## Firebase Storage Rules

Archive CSV files are uploaded by the admin dashboard to:

`admin_archives/{month}/{filename}`

```txt
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn()
        && request.auth.token.email in [
          'njell@kakao.com',
          'jisoyu30@gmail.com'
        ];
    }

    match /admin_archives/{month}/{fileName} {
      allow read, write, delete: if isAdmin()
        && month.matches('^\\d{4}-\\d{2}$')
        && fileName.matches('^letterbrick_archive_(records|sogam)_\\d{4}-\\d{2}\\.csv$');
    }
  }
}
```

## Operational Notes

- Archive generation happens in the admin browser, then uploads CSV files to
  Firebase Storage.
- `admin_archives/{month}` stores counts, file names, Storage paths, download
  URLs, upload status, and upload errors.
- `admin_archive_runs/{runId}` stores scheduled archive execution status,
  counts, failure messages, and retry diagnostics.
- `admin_archive_restore_runs/{runId}` stores archive restore dry-run and
  commit logs, duplicate counts, written counts, and restore diagnostics.
- `admin_data_quality/latest` stores the latest data quality result for the
  admin dashboard.
- `admin_data_quality_runs/{runId}` stores historical data quality results.
- `admin_quality_cleanup/latest` stores the latest duplicate cleanup dry-run or
  commit result.
- `admin_quality_cleanup_runs/{runId}` stores historical duplicate cleanup
  results.
- `admin_release/latest` stores the latest release report metadata.
- `admin_release_reports/{reportId}` stores historical release report metadata.
- `paid_beta_entitlements/{uid}` stores per-user paid beta access, daily AI
  quota, cohort, and expiration. Users can read only their own entitlement.
- `admin_paid_beta_grants/{runId}` stores manual paid beta grant logs written by
  `npm run beta:grant`.
- If Storage rules reject a file, the admin dashboard marks the archive as
  `error` or `partial` and shows an upload retry button.
- The delete button removes Storage files first, then deletes the Firestore
  archive metadata.
