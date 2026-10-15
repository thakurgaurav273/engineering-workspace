/** localStorage key holding the user's Theme choice ("system" | "light" | "dark"). */
export const THEME_STORAGE_KEY = "grovyn_theme";

/**
 * Inlined into <head> by the root layout so the `dark` class is on <html> before first
 * paint on every route - including login/accept-invite, which never mount useTheme().
 * Must stay in sync with computeIsDark() in theme.ts. Kept free of React imports so the
 * server layout can import it.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||"system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;
