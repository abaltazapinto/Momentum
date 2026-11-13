# Legacy task recovery plan

## Recovery available in the app

On 2026-11-13 a read-only check found 7 records still present under `/tasks`.
The configured authentication API key resolved to `shopping-list-d3a29`, while the
database was `compras-e2b70`. That mixed configuration has been removed. The correct
Web app config is required for sign-in. The app requires a non-anonymous account.

`node scripts/backup-legacy-tasks.mjs` reads only that original `/tasks` path and
writes a private, timestamped JSON backup under ignored `recovery/`. The database rules
deny unauthenticated reads, so it reads through the Firebase CLI with the project
owner's login (`npx firebase login` first). It refuses to
overwrite a file and never writes to Firebase. Do not put backups in `public/` or commit them.

After signing in, use **Recuperar tarefas antigas** to read `/tasks` through the
authenticated SDK, or **Importar cópia** with the JSON backup if the legacy endpoint is
no longer readable. Recovery preserves IDs and metadata and uses per-task transactions
to copy only missing records into the current user's namespace. Re-running skips existing
records. No recovery runs before login, no rules are relaxed, and the original list is
retained. A denied read must never be treated as an empty source.

## Manual account migration

The following script is prepare-only. It does not read from or write to production.

## Source and destination

- Source of truth: `/tasks`, preserved unchanged.
- Destination: `users/{uid}/tasks`.
- Input: an exported JSON backup containing a top-level `tasks` object.
- Command: `npm run prepare:migration -- backup.json users.json <uid>`.

The script writes only a local JSON file. It refuses to overwrite a different existing output. Re-running it with the same backup and UID reuses the equivalent output, making preparation idempotent. Structured task fields are preserved; legacy string tasks are converted to `{ title, completed: false }`.

## UID validation

Do not derive a UID from an email address or invent one. Obtain it after signing in to the target Firebase project with the intended account:

1. Sign in through Momentum using the recovery email/password flow.
2. Read `auth.currentUser.uid` in the authenticated client, or copy the UID of that same account from Firebase Console → Authentication → Users.
3. Confirm the UID is the intended account before preparing the output.
4. Review the generated JSON and destination `users/{uid}/tasks` before any manual import.

The migration script validates that the UID is a single safe Firebase path segment. It cannot prove account ownership; that requires the Firebase Auth session/Console check above.

## Production procedure (not executed here)

After independent review, import the prepared object only into `users/{uid}/tasks` using a controlled Firebase Console import or an authenticated, reviewed tool. Do not delete, rename, or overwrite `/tasks`. Verify task count and representative task IDs before and after the import, then retain `/tasks` as the rollback source.

## Rules proposal

Before enabling these rules in production, check whether other applications use the same project and UID namespace. Realtime Database rules do not identify the calling web app by its Firebase API key. If the project is shared, use an app-specific namespace (for example `momentumUsers/{uid}/tasks`) or a dedicated Firebase project; changing the namespace requires an explicitly reviewed application/data migration.

For an isolated Momentum namespace, the minimum rules are:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "tasks": {
          "$taskId": {
            ".validate": "newData.hasChildren(['title']) && newData.child('title').isString()"
          }
        }
      }
    }
  }
}
```

These rules protect `users/{uid}/tasks` from unauthenticated and cross-UID access, but they do not isolate Momentum from another application that intentionally shares the same `users` namespace and authenticated users.
