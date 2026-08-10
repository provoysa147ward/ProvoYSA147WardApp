import { describe, expect, it } from "vitest";

import {
  CATEGORY_CHIP_CLASSES,
  CATEGORY_LABELS,
  categoryLabel,
  DEFAULT_CATEGORY,
  EVENT_CATEGORIES,
  isEventCategory,
} from "@/lib/categories";

describe("category tables", () => {
  it("covers every category with a label and chip classes", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual(
      [...EVENT_CATEGORIES].sort(),
    );
    expect(Object.keys(CATEGORY_CHIP_CLASSES).sort()).toEqual(
      [...EVENT_CATEGORIES].sort(),
    );
  });

  it("names the palette utilities literally so Tailwind can find them", () => {
    for (const category of EVENT_CATEGORIES) {
      expect(CATEGORY_CHIP_CLASSES[category]).toBe(
        `bg-cat-${category}-bg text-cat-${category}-fg border-cat-${category}-border`,
      );
    }
  });
});

describe("isEventCategory", () => {
  it("accepts every known category", () => {
    for (const category of EVENT_CATEGORIES) {
      expect(isEventCategory(category)).toBe(true);
    }
  });

  it.each([["Sports"], ["dance"], [""], [null], [undefined], [7]])(
    "rejects %o",
    (input) => {
      expect(isEventCategory(input)).toBe(false);
    },
  );
});

describe("categoryLabel", () => {
  it("returns the label for a known category", () => {
    expect(categoryLabel("spiritual")).toBe("Spiritual");
  });

  it("falls back to the default label for unknown data", () => {
    expect(categoryLabel("dance")).toBe(CATEGORY_LABELS[DEFAULT_CATEGORY]);
  });
});
