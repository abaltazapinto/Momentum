# Momentum App

A modern productivity application focused on helping users move forward one task at a time.

---

## Features

- ✅ Task management
- ✅ Dark / Light theme
- ✅ Responsive layout
- ✅ Persistent storage
- ✅ PWA ready
- ✅ Mobile friendly

## Authentication and recurring tasks

An account is required. Before authentication, only the login screen is visible:
no counters, tasks, task form or recovery controls. Anonymous sessions do not unlock
the workspace. Signing out clears the rendered tasks and returns to the login screen.

The public Web app config for `compras-e2b70` is committed in `.env` (it is not a
secret), so local builds and Netlify builds pick it up automatically. To override it
locally, put values in `.env.local` (see `.env.example`); the config must come from the
**same Firebase project as the database**. Restart Vite after changing it.
Do not reuse the API key from `shopping-list-d3a29` with the `compras-e2b70` database.
The app checks the key's project before enabling sign-in. Without configuration, the
sign-in controls stay disabled and the workspace stays locked.

Enable Email/Password, Google, Facebook and GitHub as needed in Firebase Authentication,
configure their OAuth credentials in the console, and authorize the app's actual domain
(including localhost for development). Never put OAuth secrets or service-account keys
in Vite variables. See [Firebase password auth](https://firebase.google.com/docs/auth/web/password-auth)
and [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

Email **Entrar** and **Criar conta** are explicit actions; account creation does not depend
on a `user-not-found` error. Existing anonymous sessions can still be linked. Switching
from an anonymous session preserves a local copy first; a cancelled social popup does
not sign the user out. Signed-in tasks are scoped to `users/{uid}/tasks`.
After login, the two small icons next to **Sair** export all tasks (with their session
history) as JSON and import a JSON backup. Import copies only missing records into the
current account; existing records are never overwritten. The legacy `/tasks` list was
already recovered; it stays read-only (see `docs/LEGACY_TASK_MIGRATION.md`).

`firebase.database.rules.json` is deployed to `compras-e2b70`
(`npx firebase deploy --only database --project compras-e2b70`). Everything is closed by
default; each user can only read and write `users/{uid}`; the legacy `/tasks` list is
read-only and only readable by the UID stored in `/legacyOwner` (set by an admin with
`firebase database:set`, never committed); `endorsements` stays open for an older app
that shares this database. Run `npm run test:firebase` before changing the rules.

`recurrence.js` contains the pure recurring-task model: one stable task definition,
dated completion events, idempotent session recording, weekly, monthly or yearly
progress (weeks start on Monday, months on the 1st, years on 1 January, at local
midnight) and a
replanning suggestion. It never creates calendar events.

Run `npm test` for the deterministic LeetCode 3x/week end-to-end fixture.
For local browser testing, Firebase emulators can be used only in Vite development mode
with `VITE_FIREBASE_USE_EMULATORS=true` and a `demo-` project. The emulator ports are
9099 (Auth) and 9000 (Database). This still requires signing in to an emulator account.

---

## Live Demo

Netlify URL

---

## Screenshots

Desktop

Mobile

---

## Tech Stack

- HTML
- CSS
- JavaScript
- Vite
- Firebase
- Netlify

---

## Roadmap

- Categories
- Priorities
- Due dates
- Notifications
- Offline support
- AI Assistant

---

## Development Process

Momentum is built using a professional engineering workflow.

- GitHub Issues
- Acceptance Criteria
- Small releases
- Semantic commits
- Continuous deployment
- Manual validation

---

## Engineering

This project is intentionally developed using professional software engineering practices rather than as a simple tutorial project.

Every feature is developed through:

- GitHub Issues
- Acceptance Criteria
- Manual Review
- Validation
- Netlify Deployment
- Versioned Releases

The goal is to demonstrate not only programming ability but also software engineering workflow.

---


## License

## Added

- 🌙 Light/Dark theme toggle
- 💾 Theme preference persisted between sessions
