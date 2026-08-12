# Dryo — Cardamom Dryer & Curing House Management Platform (ERP)

A phone-first PWA prototype for running a cardamom curing house: farmer intake,
drying/curing chambers, batch lifecycle tracking, and graded inventory.

Built on the same design system, typography (Google Sans), design tokens, and shell
architecture as the DarLink PWA — teal `#173b3d` / cream `#fef9ef` palette, the master–detail
shell (bottom nav on phone, left rail on desktop), and a shared component kit.

## Stack

- React 19 + TypeScript + Vite 8
- `vite-plugin-pwa` (installable, offline service worker)
- Zustand for app state (mock data, in-memory mutations)
- `lucide-react` icons

## Roles

Phone + OTP login (demo — any 6-digit OTP works):

| Role | Demo number | Navigation |
| --- | --- | --- |
| **Manager** | `9847012345` | Dashboard · Batches · Inventory · Account |
| **Operator** | `9847067890` | Today · Chambers · Intake · Account |

## Modules

- **Dashboard** — live KPIs, running chamber temperatures, batches in cure, fault alerts.
- **Batches** — every lot from intake → drying → curing → grading → ready → dispatched, with a
  lifecycle timeline and one-tap stage advancement.
- **Chambers** — kilns and dryers with live temperature / humidity / load gauges and start-stop-clear controls.
- **Intake** — farmer green-cardamom weigh-ins, ready to load into an idle chamber.
- **Inventory** — cured, graded stock (AGEB / AGB / AGS / AGES) by grade and store location.
- **Notifications** — over-temp alerts, moisture-target reminders, dispatch confirmations.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build + service worker
npm run preview  # serve the production build
```

## Design provenance

The design tokens (`src/shared/styles/tokens.css`), global reset, and component primitives
mirror the DarLink system so Dryo reads as part of the same product family. Domain screens and
data model are specific to cardamom curing operations.
