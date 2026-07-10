/**
 * Staging safety switch.
 *
 * A staging box that has been seeded with a restore of the production database
 * holds REAL user emails, REAL push tokens, and REAL per-org Linear API keys.
 * Left unguarded, the scheduled jobs would happily email production users, push
 * to their production devices, and pull from their production Linear workspaces
 * using the restored keys - none of which is gated by simply omitting our own
 * Resend/Firebase credentials.
 *
 * Setting `STAGING_SAFE_MODE=true` is a single, explicit kill switch that:
 *   - short-circuits every @Cron background job (no scheduled outbound work), and
 *   - blocks the mail and push providers from making any outbound call.
 *
 * It is intentionally opt-in via env so production (where the var is absent/false)
 * behaves exactly as before. The check reads process.env directly to stay usable
 * from providers that are constructed without Nest's ConfigService.
 */
export function isStagingSafeMode(): boolean {
  return process.env.STAGING_SAFE_MODE === 'true';
}
