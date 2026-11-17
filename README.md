# Poker Night Tracker

Mobile-first, dark-theme tracker for home cash games. Tap a player tile to log a buy-in, hold it (or tap the dots) for other amounts or a cash-out, and follow everything in a timestamped activity feed with undo. Ending the night shows who pays whom, with a copy-to-clipboard recap for the group chat. Includes history and all-time standings.

- Vite + React, no backend. Data is saved in the browser (localStorage); export/import JSON from the Leaders tab.
- `npm install && npm run dev` to run locally, `npm test` for the money-math tests.

## Deploy
1. Push this folder to a GitHub repo.
2. In Vercel: Add New → Project → import the repo. Framework preset is auto-detected as Vite (build `npm run build`, output `dist`). Deploy.
