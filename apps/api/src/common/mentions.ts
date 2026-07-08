/**
 * Mentions are stored inside the comment/update body as markdown links of the form
 * `@[Display Name](mention:USER_ID)` (produced by the frontend TipTap mention extension).
 * Parsing the stored body — rather than trusting a client-supplied id list — makes the body
 * the single source of truth for who was actually mentioned, and lets edit-diffing work.
 */
const MENTION_TOKEN = /\(mention:([a-zA-Z0-9_-]+)\)/g;

export function extractMentionIds(body?: string | null): string[] {
  if (!body) return [];
  const ids = new Set<string>();
  for (const match of body.matchAll(MENTION_TOKEN)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}
