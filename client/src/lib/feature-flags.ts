/**
 * Feature flag utilities for conditional UI rendering
 */

/**
 * Check if NEWS UI features should be enabled
 * Default: false (disabled)
 */
export function isNewsUIEnabled(): boolean {
  return import.meta.env.VITE_NEWS_UI === 'true';
}

/**
 * Check if OUTREACH UI features should be enabled
 * Default: true (enabled) - existing flag
 */
export function isOutreachUIEnabled(): boolean {
  return import.meta.env.VITE_OUTREACH_UI !== 'false';
}