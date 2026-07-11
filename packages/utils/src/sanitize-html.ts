// Dependency-free sanitizer for the rich-text HTML stored on proposal sections.
// The editor only emits basic formatting, but pasted content could carry scripts or
// event handlers, so we cleanse before rendering via dangerouslySetInnerHTML.
//
// Allowlist the small set of tags the editor produces; drop everything else and all
// attributes except safe anchor attrs. SSR-safe: without a DOM we strip tags to text.

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "P",
  "BR",
  "UL",
  "OL",
  "LI",
  "SPAN",
  "DIV",
  "A",
  "H1",
  "H2",
  "H3",
  "BLOCKQUOTE",
  "CODE",
  "PRE",
]);
const ALLOWED_ATTR: Record<string, Set<string>> = {
  A: new Set(["href", "target", "rel"]),
};
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  // SSR / no-DOM: degrade to plain text (never inject unparsed markup).
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return dirty.replace(/<[^>]*>/g, "");
  }

  const doc = new DOMParser().parseFromString(dirty, "text/html");

  const clean = (node: Element) => {
    // Snapshot children - we mutate the tree while iterating.
    for (const el of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(el.tagName)) {
        // Unwrap unknown tags (drop <script>/<style>/<iframe> entirely, keep others' text).
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "IFRAME") {
          el.remove();
        } else {
          el.replaceWith(...Array.from(el.childNodes));
        }
        continue;
      }
      const allowed = ALLOWED_ATTR[el.tagName];
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const ok = allowed?.has(name) && (name !== "href" || SAFE_URL.test(attr.value.trim()));
        if (!ok) el.removeAttribute(attr.name);
      }
      clean(el);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}
