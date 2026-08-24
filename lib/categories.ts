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
  "fhe",
  "temple",
  "service",
  "activity",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * Where an event lands when nothing else claims it.
 *
 * There is no "Other" chip any more, so this has to be a real category rather
 * than a shrug — and most of what the ward puts on the calendar is an
 * activity, so an uncoloured event is far more often that than anything else.
 */
export const DEFAULT_CATEGORY: EventCategory = "activity";

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  fhe: "FHE",
  temple: "Temple",
  service: "Service",
  activity: "Activity",
};

/** Background, text, and border utilities for a category chip. */
export const CATEGORY_CHIP_CLASSES: Record<EventCategory, string> = {
  fhe: "bg-cat-fhe-bg text-cat-fhe-fg border-cat-fhe-border",
  temple: "bg-cat-temple-bg text-cat-temple-fg border-cat-temple-border",
  service: "bg-cat-service-bg text-cat-service-fg border-cat-service-border",
  activity:
    "bg-cat-activity-bg text-cat-activity-fg border-cat-activity-border",
};

/**
 * Google Calendar's eleven event colours, folded onto the ward's four chips by
 * hue, so the chip matches the colour a leader picked in Google: purples are
 * FHE, blues the temple, greens service, and every warm colour an activity.
 *
 * The mapping is documented for leaders in `docs/HANDOFF.md`. An uncoloured
 * event (Google omits `colorId` when the event uses the calendar's default
 * colour) lands on `DEFAULT_CATEGORY`, as does Graphite — the grey that means
 * "no particular kind" in Google has nowhere better to go now that the neutral
 * chip is gone.
 */
const GOOGLE_COLOR_CATEGORIES: Record<string, EventCategory> = {
  "1": "fhe", // Lavender
  "2": "service", // Sage
  "3": "fhe", // Grape
  "4": "activity", // Flamingo
  "5": "activity", // Banana
  "6": "activity", // Tangerine
  "7": "temple", // Peacock
  "8": "activity", // Graphite
  "9": "temple", // Blueberry
  "10": "service", // Basil
  "11": "activity", // Tomato
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
