// Turns the API's validation messages (class-validator's wording, e.g. "summary must be longer
// than or equal to 10 characters") into sentences a person can act on ("Summary must be at least
// 10 characters."). Pure, so the API client can use it without pulling in UI code.

/** `lines.0.unitPrice` -> "Line 1 unit price"; `dueDate` -> "Due date". */
export function fieldLabel(path: string): string {
  const parts: string[] = [];
  for (const segment of path.split(".")) {
    if (/^\d+$/.test(segment) && parts.length) {
      const prev = parts.pop()!;
      const singular = prev.endsWith("ies")
        ? `${prev.slice(0, -3)}y`
        : prev.endsWith("xes")
          ? prev.slice(0, -2)
          : prev.endsWith("s") && !prev.endsWith("ss")
            ? prev.slice(0, -1)
            : prev;
      parts.push(`${singular} ${Number(segment) + 1}`);
    } else {
      parts.push(
        segment
          .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
          .replace(/[_-]+/g, " ")
          .toLowerCase(),
      );
    }
  }
  const label = parts.join(" ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Capitalised, ending in a full stop (unless it already ends in punctuation). */
export function asSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

const RULES: [RegExp, (field: string, m: RegExpMatchArray) => string][] = [
  [
    /^(\S+) must be longer than or equal to (\d+) characters?$/,
    (f, m) => `${f} must be at least ${m[2]} characters`,
  ],
  [
    /^(\S+) must be shorter than or equal to (\d+) characters?$/,
    (f, m) => `${f} must be at most ${m[2]} characters`,
  ],
  [/^(\S+) should not be empty$/, (f) => `${f} is required`],
  [/^(\S+) must not be less than (-?[\d.]+)$/, (f, m) => `${f} must be at least ${m[2]}`],
  [/^(\S+) must not be greater than (-?[\d.]+)$/, (f, m) => `${f} must be at most ${m[2]}`],
  [/^(\S+) must be a valid ISO 8601 date string$/, (f) => `${f} must be a valid date`],
  [/^(\S+) must be an email$/, (f) => `${f} must be a valid email address`],
  [/^(\S+) must be a URL address$/, (f) => `${f} must be a valid link (https://…)`],
  [/^(\S+) must be one of the following values: (.+)$/, (f, m) => `${f} must be one of: ${m[2]}`],
  [
    /^(\S+) must contain at least (\d+) elements?$/,
    (f, m) => `${f} needs at least ${m[2]} ${m[2] === "1" ? "item" : "items"}`,
  ],
  [
    /^(\S+) must be (?:a number|an integer number) conforming to the specified constraints$/,
    (f) => `${f} must be a number`,
  ],
  [/^property (\S+) should not exist$/, (f) => `${f} isn't something this form accepts`],
];

/** One validation message in plain English, as a sentence. */
export function humanizeValidation(message: string): string {
  for (const [pattern, render] of RULES) {
    const m = message.match(pattern);
    if (m) return asSentence(render(fieldLabel(m[1]), m));
  }
  // Unknown wording: still lead with a readable field name ("dueDate must…" -> "Due date must…").
  const m = message.match(/^([a-z][\w.]*)\s(.+)$/);
  return asSentence(m ? `${fieldLabel(m[1])} ${m[2]}` : message);
}

/** Plain-English reasons from an API error's `errors.validation` list (deduplicated). */
export function validationReasons(details: Record<string, unknown> | undefined): string[] {
  const list = details?.validation;
  if (!Array.isArray(list)) return [];
  return [
    ...new Set(list.filter((x): x is string => typeof x === "string").map(humanizeValidation)),
  ];
}
