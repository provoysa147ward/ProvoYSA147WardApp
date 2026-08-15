import { describe, expect, it } from "vitest";

import {
  CATEGORY_CHIP_CLASSES,
  CATEGORY_LABELS,
  categoryFromGoogleColor,
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

describe("categoryFromGoogleColor", () => {
  it("folds each Google colour onto a chip by hue", () => {
    expect(categoryFromGoogleColor("2")).toBe("sports"); // Sage
    expect(categoryFromGoogleColor("10")).toBe("sports"); // Basil
    expect(categoryFromGoogleColor("1")).toBe("spiritual"); // Lavender
    expect(categoryFromGoogleColor("3")).toBe("spiritual"); // Grape
    expect(categoryFromGoogleColor("4")).toBe("social"); // Flamingo
    expect(categoryFromGoogleColor("5")).toBe("social"); // Banana
    expect(categoryFromGoogleColor("6")).toBe("social"); // Tangerine
    expect(categoryFromGoogleColor("11")).toBe("social"); // Tomato
    expect(categoryFromGoogleColor("7")).toBe("service"); // Peacock
    expect(categoryFromGoogleColor("9")).toBe("service"); // Blueberry
    expect(categoryFromGoogleColor("8")).toBe("other"); // Graphite
  });

  it("covers every colour Google can send", () => {
    for (let colorId = 1; colorId <= 11; colorId += 1) {
      expect(EVENT_CATEGORIES).toContain(
        categoryFromGoogleColor(String(colorId)),
      );
    }
  });

  it("falls back to the neutral chip for an uncoloured or unknown event", () => {
    expect(categoryFromGoogleColor(undefined)).toBe(DEFAULT_CATEGORY);
    expect(categoryFromGoogleColor(null)).toBe(DEFAULT_CATEGORY);
    expect(categoryFromGoogleColor("")).toBe(DEFAULT_CATEGORY);
    expect(categoryFromGoogleColor("42")).toBe(DEFAULT_CATEGORY);
  });
});
