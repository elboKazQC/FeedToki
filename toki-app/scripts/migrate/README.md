Migration: remove points system

This migration will remove `points` related data from Firestore and user profiles.

How to run (dry-run first):

1. Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a service account JSON with Firestore access.
2. From repo root:
   - Dry run (no writes):
     ```bash
     npx ts-node scripts/migrate/remove-points.ts --dry
     ```
   - Apply changes:
     ```bash
     npx ts-node scripts/migrate/remove-points.ts --apply
     ```

What it does:
- Deletes documents under `/users/{userId}/points/`
- Removes `dailyPointsBudget` field from `/users/{userId}` if present
- Removes `points` field from `/users/{userId}/customFoods/*` and `/globalFoods/*`
- Removes `points` fields inside `/users/{userId}/meals/*` -> `items[]`

Notes:
- Always run with `--dry` first and review the summary before applying.
- Backup your Firestore or export data if needed before applying migration.

Next steps (code cleanup):
- Remove points-related types, utilities and tests (e.g. `lib/points-utils.ts`, tests referencing `points`).
- Update `lib/ai-nutrition-coach.ts` to stop emitting `overallScore`/`dailyPointsBudget` when migrating to pure journal mode.
- Run the test suite and adjust tests accordingly.
