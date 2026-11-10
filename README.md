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

New data is scoped to `users/{uid}/tasks` and requires Firebase Authentication. The
The current browser flow starts anonymously and can link that same Firebase UID to an
email/password account. This preserves the tasks created before linking and lets the
same user recover them on another device. No service-account key is stored in the app.
Deploy `firebase.database.rules.json` in the Firebase Console only after backup and
validation; this PR does not change production rules or migrate existing `/tasks`.

`recurrence.js` contains the pure recurring-task model: one stable task definition,
dated completion events, idempotent session recording, weekly progress and a
replanning suggestion. It never creates calendar events.

Run `npm test` for the deterministic LeetCode 3x/week end-to-end fixture.

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
