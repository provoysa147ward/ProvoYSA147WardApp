/**
 * Event categories and their pastel chip styling.
 *
 * The colour values themselves live in `app/globals.css` as `--color-cat-*`
 * custom properties; this module names the categories and maps each one to the
 * Tailwind utilities generated from those properties. The class strings must
 * stay literal — Tailwind scans source text, so a dynamically assembled class
 * name (`bg-cat-${category}-bg`) would never be emitted.
 */

export const EVENT_CATEGORIES = [
  "sports",
  "spiritual",
  "social",
  "service",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const DEFAULT_CATEGORY: EventCategory = "other";

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  sports: "Sports",
  spiritual: "Spiritual",
  social: "Social",
  service: "Service",
  other: "Other",
};

/** Background, text, and border utilities for a category chip. */
export const CATEGORY_CHIP_CLASSES: Record<EventCategory, string> = {
  sports: "bg-cat-sports-bg text-cat-sports-fg border-cat-sports-border",
  spiritual:
    "bg-cat-spiritual-bg text-cat-spiritual-fg border-cat-spiritual-border",
  social: "bg-cat-social-bg text-cat-social-fg border-cat-social-border",
  service: "bg-cat-service-bg text-cat-service-fg border-cat-service-border",
  other: "bg-cat-other-bg text-cat-other-fg border-cat-other-border",
};

/**
 * Google Calendar's eleven event colours, folded onto the ward's five chips by
 * hue, so a chip roughly matches whatever colour a leader picked in Google.
 * The mapping is documented for leaders in `docs/HANDOFF.md`; an uncoloured
 * event (Google omits `colorId` when the event uses the calendar's default
 * colour) lands on the neutral chip.
 */
const GOOGLE_COLOR_CATEGORIES: Record<string, EventCategory> = {
  "1": "spiritual", // Lavender
  "2": "sports", // Sage
  "3": "spiritual", // Grape
  "4": "social", // Flamingo
  "5": "social", // Banana
  "6": "social", // Tangerine
  "7": "service", // Peacock
  "8": "other", // Graphite
  "9": "service", // Blueberry
  "10": "sports", // Basil
  "11": "social", // Tomato
};

export function categoryFromGoogleColor(
  colorId: string | null | undefined,
): EventCategory {
  if (!colorId) return DEFAULT_CATEGORY;
  return GOOGLE_COLOR_CATEGORIES[colorId] ?? DEFAULT_CATEGORY;
}

export function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === "string" &&
    (EVENT_CATEGORIES as readonly string[]).includes(value)
  );
}

/** The display label for a category, falling back to the default for bad data. */
export function categoryLabel(value: unknown): string {
  return CATEGORY_LABELS[isEventCategory(value) ? value : DEFAULT_CATEGORY];
}
