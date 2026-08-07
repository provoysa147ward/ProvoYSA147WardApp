"use client";

import { useId, useState } from "react";

import { Field, inputClasses } from "@/components/forms/Field";
import { CATEGORY_LABELS, EVENT_CATEGORIES } from "@/lib/categories";
import type { AdminEvent } from "@/lib/adminQueries";

/**
 * The event fields, shared by the queue's edit-before-approve form, the direct
 * create form, and the edit form — so the three can't drift apart.
 *
 * Unlike the public form, dates in the past are allowed: correcting an entry
 * for something that already happened is ordinary admin work.
 */
export function EventFields({
  event,
  errors,
  showSubmitter = true,
}: {
  event?: AdminEvent;
  errors: Record<string, string>;
  showSubmitter?: boolean;
}) {
  const prefix = useId();
  const [repeats, setRepeats] = useState(event?.repeatsWeekly ?? false);
  const fieldId = (name: string) => `${prefix}-${name}`;

  return (
    <div className="flex flex-col gap-4">
      <Field id={fieldId("title")} label="Title" error={errors.title} required>
        {(props) => (
          <input
            {...props}
            name="title"
            type="text"
            maxLength={120}
            defaultValue={event?.title ?? ""}
            className={inputClasses}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={fieldId("category")}
          label="Category"
          error={errors.category}
          required
        >
          {(props) => (
            <select
              {...props}
              name="category"
              defaultValue={event?.category ?? ""}
              className={inputClasses}
            >
              <option value="" disabled>
                Pick one
              </option>
              {EVENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          id={fieldId("eventDate")}
          label="Date"
          error={errors.eventDate}
          required
        >
          {(props) => (
            <input
              {...props}
              name="eventDate"
              type="date"
              defaultValue={event?.eventDate ?? ""}
              className={inputClasses}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={fieldId("startTime")}
          label="Start time"
          error={errors.startTime}
          required
        >
          {(props) => (
            <input
              {...props}
              name="startTime"
              type="time"
              defaultValue={event?.startTime?.slice(0, 5) ?? ""}
              className={inputClasses}
            />
          )}
        </Field>

        <Field
          id={fieldId("endTime")}
          label="End time"
          error={errors.endTime}
          hint="Earlier than the start means it runs past midnight."
        >
          {(props) => (
            <input
              {...props}
              name="endTime"
              type="time"
              defaultValue={event?.endTime?.slice(0, 5) ?? ""}
              className={inputClasses}
            />
          )}
        </Field>
      </div>

      <Field
        id={fieldId("location")}
        label="Location"
        error={errors.location}
        required
      >
        {(props) => (
          <input
            {...props}
            name="location"
            type="text"
            maxLength={200}
            defaultValue={event?.location ?? ""}
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("description")}
        label="Description"
        error={errors.description}
      >
        {(props) => (
          <textarea
            {...props}
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={event?.description ?? ""}
            className={`${inputClasses} min-h-20 py-2`}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Repeat</legend>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="repeatsWeekly"
            checked={repeats}
            onChange={(changed) => setRepeats(changed.target.checked)}
            className="h-5 w-5"
          />
          Every week, on the same weekday
        </label>

        {repeats ? (
          <>
            <Field
              id={fieldId("repeatUntil")}
              label="Repeat until"
              error={errors.repeatUntil}
              required
              hint="Up to a year from the first date."
            >
              {(props) => (
                <input
                  {...props}
                  name="repeatUntil"
                  type="date"
                  defaultValue={event?.repeatUntil ?? ""}
                  className={inputClasses}
                />
              )}
            </Field>

            <p className="text-xs text-ink-muted">
              To skip a week, end this series before the gap and add a second
              one that picks up after it.
            </p>
          </>
        ) : null}
      </fieldset>

      {showSubmitter ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={fieldId("submitterName")}
            label="Submitted by"
            error={errors.submitterName}
          >
            {(props) => (
              <input
                {...props}
                name="submitterName"
                type="text"
                maxLength={100}
                defaultValue={event?.submitterName ?? ""}
                className={inputClasses}
              />
            )}
          </Field>

          <Field
            id={fieldId("submitterContact")}
            label="Contact"
            error={errors.submitterContact}
            hint="Never shown publicly."
          >
            {(props) => (
              <input
                {...props}
                name="submitterContact"
                type="text"
                maxLength={200}
                defaultValue={event?.submitterContact ?? ""}
                className={inputClasses}
              />
            )}
          </Field>
        </div>
      ) : null}
    </div>
  );
}
