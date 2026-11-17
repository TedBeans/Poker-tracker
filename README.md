# Poker Night Tracker

Mobile-first tracker for home cash games: pick who's playing, log buy-ins and rebuys, enter cash-outs, and see who's up or down plus who pays whom. Includes history and all-time standings.

- Vite + React, no backend. Data is saved in the browser (localStorage); export/import JSON from the Leaders tab.
- `npm install && npm run dev` to run locally, `npm test` for the money-math tests.

## Deploy
1. Push this folder to a GitHub repo.
2. In Vercel: Add New → Project → import the repo. Framework preset is auto-detected as Vite (build `npm run build`, output `dist`). Deploy.
