// Feature toggle and helpers for points/gamification
// Set to `false` to disable all points writes/behaviour across the app.
export const POINTS_ENABLED = false;

export function arePointsEnabled(): boolean {
  return POINTS_ENABLED;
}

// Generic noop used by code that would sync or write points.
export async function noopSyncPoints(..._args: any[]): Promise<void> {
  // Intentionally do nothing when points are disabled.
  return Promise.resolve();
}

// Helper to get a points-related key (kept for compatibility).
export function getPointsKey(userId: string): string {
  return `feedtoki_points_${userId}_v2`;
}
