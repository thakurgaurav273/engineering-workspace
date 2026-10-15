/**
 * Platform branding for server-rendered output (transactional emails, API docs), set per
 * deployment via APP_NAME / APP_TAGLINE / APP_LOGO_URL - the API-side twins of the web app's
 * NEXT_PUBLIC_APP_*. Per-organization identity (name, logo) lives on the Organization row.
 *
 * Read on every call rather than at module load: ConfigModule only populates process.env from
 * .env once AppModule is evaluated, after every imported module's top level has already run.
 */
export function getBrand(): { name: string; tagline: string; logoUrl: string } {
  return {
    name: process.env.APP_NAME || 'Workspace',
    tagline: process.env.APP_TAGLINE || '',
    logoUrl: absoluteLogoUrl(process.env.APP_LOGO_URL),
  };
}

// Email clients need an absolute URL. A path (e.g. "/logo.png", which the web app serves from
// public/) is resolved against FRONTEND_URL; anything unresolvable means no logo.
function absoluteLogoUrl(logo: string | undefined): string {
  if (!logo) return '';
  try {
    return new URL(logo, process.env.FRONTEND_URL).toString();
  } catch {
    return '';
  }
}
