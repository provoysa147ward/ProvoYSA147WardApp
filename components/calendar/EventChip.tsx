import {
  CATEGORY_CHIP_CLASSES,
  categoryLabel,
  type EventCategory,
} from "@/lib/categories";

/**
 * The pastel category chip.
 *
 * Colour is never the only signal: `CategoryChip` prints the category name, and
 * the compact grid variant carries it in a screen-reader-only span, so the
 * calendar is still readable in greyscale or with colour vision deficiency.
 */

export function CategoryChip({
  category,
  className = "",
}: {
  category: EventCategory;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_CHIP_CLASSES[category]} ${className}`}
    >
      {categoryLabel(category)}
    </span>
  );
}

/**
 * One event inside a month-grid day cell. Titles ellipsize rather than wrap.
 *
 * `relative` is load-bearing: the screen-reader spans below are absolutely
 * positioned (that is what `sr-only` does), so without a positioned ancestor
 * they resolve against the page. Inside a truncated chip that lands them past
 * the right edge, which widens the document — a horizontal scrollbar on a
 * phone, where the grid is now reachable.
 */
export function EventChip({
  category,
  title,
  timeLabel,
}: {
  category: EventCategory;
  title: string;
  timeLabel: string;
}) {
  return (
    <span
      className={`relative block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-xs font-semibold ${CATEGORY_CHIP_CLASSES[category]}`}
    >
      <span className="sr-only">{categoryLabel(category)}: </span>
      {title}
      <span className="sr-only">, {timeLabel}</span>
    </span>
  );
}
