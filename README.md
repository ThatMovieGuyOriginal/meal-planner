# Body Composition & Meal Planner

A personal calorie, macro and meal planner that runs in the browser and works offline. There are no accounts
and no server: each person's data stays in their own browser, and backup files move it between devices.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Run locally with live reload |
| `npm test` | Run the unit tests |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build locally, with its production security headers |
| `npx vercel --prod` | Deploy to Vercel |

## Structure

- `src/domain/` holds the calculations and food and exercise data. It has no UI code and is what the tests cover.
- `src/state/` holds the store, saving to the browser, and backup import, export and migration.
- `src/ui/` holds shared components and styles.
- `src/modules/` holds one folder per screen.
- `src/app/` holds navigation and the app frame.

## Adding a new tool

1. Create `src/modules/<name>/index.tsx` and export an `AppModule` (see `src/modules/types.ts`).
2. Add it to `MODULES` in `src/modules/registry.ts`.

Navigation, the More screen and Settings > Arrange pick it up automatically. Existing users get it at the end of
their saved order.

## Rules that protect saved data

- **Never rename a food or exercise id.** Saved plans, recipes and backups refer to them.
- **New saved settings** go in `AppState` and `defaultState()`, and need a line in `sanitizeState()` in
  `src/state/backup.ts`. The round-trip test fails if an exported setting doesn't come back.
- **Incompatible changes to the saved format** need a bump to `SCHEMA_VERSION` and a migration in `parseBackup()`.

## Old version

The previous single-file app, `body_composition_weekly_meal_planner_v6.html`, is kept locally and isn't in this
repository or deployed. Keep your local copy until existing data has been exported from it, because that browser
data can only be reached through the old page. The new app imports its export files.
