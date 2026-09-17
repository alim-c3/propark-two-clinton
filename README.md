# ProPark · Two Clinton Park

Valet OS demo for Two Clinton Park / 50 Clinton Place, New Rochelle.

Client-side Zustand store. No database required for the demo.

## Routes

- `/` sales pitch
- `/features`
- `/resident` guest + resident check-in
- `/valet` curb / garage board
- `/manager` occupancy and staff

## Local

```bash
npm install
npx vite dev --host 0.0.0.0 --port 8080
```

Open `/resident` → Get going → `/valet`.

## Vercel

Import this repo. Override the build command to:

```
npx vite build
```

Do not use `npm run build` as-is — that script also runs a Postgres migrate step this demo does not use.

No environment variables required.
