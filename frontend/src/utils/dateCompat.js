// utils/dateCompat.js
// ─────────────────────────────────────────────────────────────────────────────
// Cross-browser date handling — primarily to keep Safari / iOS happy.
//
// Safari's Date parser is far stricter than Chrome's. The big offenders:
//   • "2024-01-01 12:30:00"  (MySQL DATETIME, space separator) -> Invalid Date
//   • "2024-01-01 12:30"     (DATE_FORMAT output)              -> Invalid Date
//   • "2024/01/01"           (slash separator)                 -> Invalid Date
// Chrome happily parses all of these, which is why bugs only surface on a Mac.
//
// `parseDate` normalizes those shapes before constructing a Date. We also expose
// `installSafariDateShim()` which patches the global Date constructor so that the
// hundreds of existing `new Date(apiValue)` call-sites become Safari-safe without
// touching every file. The shim ONLY rewrites strings that match the known
// problem patterns; every other input is handed to the native Date untouched.
// ─────────────────────────────────────────────────────────────────────────────

// "YYYY-MM-DD[ T]HH:MM[:SS][.fff][Z|±HH:MM]" — the MySQL / DATE_FORMAT shape.
const SPACE_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Normalize a date-like string into a form Safari can parse.
 * Returns the input unchanged when it is not a string we need to fix.
 */
export function normalizeDateString(value) {
  if (typeof value !== "string") return value;
  let s = value.trim();
  if (!s) return s;

  // Already a clean ISO string with a "T" — leave it alone.
  const m = SPACE_DATETIME_RE.exec(s);
  if (m) {
    // Replace the first space (date/time separator) with "T". Preserves any
    // trailing timezone, so local-vs-UTC semantics match Chrome's behaviour.
    return s.replace(" ", "T");
  }

  // "2024/01/01" or "2024/01/01 12:30" -> dashes + T
  if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) {
    s = s.replace(/\//g, "-").replace(" ", "T");
    return s;
  }

  return value;
}

/**
 * Safe Date constructor. Same contract as `new Date(value)` but tolerant of the
 * MySQL/Safari pitfalls above. Returns an Invalid Date (never throws) on bad input.
 */
export function parseDate(value) {
  if (value === null || value === undefined || value === "") return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return new Date(normalizeDateString(value));
}

/** True when `value` parses to a real date. */
export function isValidDate(value) {
  const d = parseDate(value);
  return d instanceof Date && !isNaN(d.getTime());
}

let shimInstalled = false;

/**
 * Patch the global `Date` so existing `new Date("YYYY-MM-DD HH:MM:SS")` call-sites
 * work in Safari. Idempotent and safe to call once at app start-up.
 */
export function installSafariDateShim() {
  if (shimInstalled || typeof window === "undefined") return;

  // Quick capability probe: skip patching in browsers that already cope (Chrome,
  // Firefox) so native behaviour is untouched there.
  const needsShim = isNaN(new window.Date("2020-01-01 00:00:00").getTime());
  if (!needsShim) {
    shimInstalled = true;
    return;
  }

  const NativeDate = window.Date;

  function PatchedDate(...args) {
    // Called without `new` -> must return the current time as a string.
    if (!(this instanceof PatchedDate)) return NativeDate();
    if (args.length === 0) return new NativeDate();
    if (args.length === 1) {
      const a = args[0];
      return new NativeDate(typeof a === "string" ? normalizeDateString(a) : a);
    }
    return new NativeDate(...args);
  }

  // Preserve the prototype chain so `instanceof Date` and all methods keep working.
  PatchedDate.prototype = NativeDate.prototype;
  PatchedDate.now = NativeDate.now.bind(NativeDate);
  PatchedDate.UTC = NativeDate.UTC.bind(NativeDate);
  PatchedDate.parse = (s) =>
    NativeDate.parse(typeof s === "string" ? normalizeDateString(s) : s);

  window.Date = PatchedDate;
  shimInstalled = true;
}

export default parseDate;
