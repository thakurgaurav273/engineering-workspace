// Platform branding, configured per deployment. NEXT_PUBLIC_* are inlined at build time, so
// each must be referenced literally. This is what users see before sign-in and wherever no
// organization is in scope - once signed in, the active organization's own name and logo
// (Settings -> Organization) take over in the shell.
export const brand = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Workspace",
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "",
  // Absolute URL or a path under public/. Empty = a monogram of `name`.
  logoUrl: process.env.NEXT_PUBLIC_APP_LOGO_URL || "",
};
