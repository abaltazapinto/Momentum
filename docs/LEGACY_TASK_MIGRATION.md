# Legacy task recovery plan

This plan is prepare-only. It does not read from or write to the production Firebase project.

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
