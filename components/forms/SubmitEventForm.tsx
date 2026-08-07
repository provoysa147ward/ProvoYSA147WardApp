"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { CATEGORY_LABELS, EVENT_CATEGORIES } from "@/lib/categories";
import { wardToday } from "@/lib/date";
import { submitEvent } from "@/app/submit/actions";
import {
  INITIAL_SUBMIT_STATE,
  type SubmitState,
} from "@/app/submit/submit-state";

import { Field, inputClasses } from "./Field";
import { HoneypotField } from "./HoneypotField";

export function SubmitEventForm() {
  const [state, formAction] = useActionState<SubmitState, FormData>(
    submitEvent,
    INITIAL_SUBMIT_STATE,
  );

  if (state.status === "success") {
    return <Confirmation />;
  }

  return <EventForm state={state} formAction={formAction} />;
}

function Confirmation() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-cat-sports-border bg-cat-sports-bg p-6 text-cat-sports-fg">
      <h2 className="text-xl font-bold">Thanks — we got it!</h2>
      <p>
        An admin will review this. Approved events appear on the calendar,
        usually within a day or two. If they need to check something, they&apos;ll
        use the contact details you gave.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/calendar"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-cream"
        >
          Back to the calendar
        </Link>
        <Link
          href="/submit"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink"
        >
          Suggest another
        </Link>
      </div>
    </div>
  );
}

function EventForm({
  state,
  formAction,
}: {
  state: SubmitState;
  formAction: (formData: FormData) => void;
}) {
  const prefix = useId();
  const [repeats, setRepeats] = useState(false);
  const today = wardToday();

  const fieldId = (name: string) => `${prefix}-${name}`;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <HoneypotField />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"
        >
          {state.formError}
        </p>
      ) : null}

      <Field id={fieldId("title")} label="What is it?" error={state.errors.title} required>
        {(props) => (
          <input
            {...props}
            name="title"
            type="text"
            maxLength={120}
            placeholder="Volleyball at the stake center"
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("category")}
        label="Category"
        error={state.errors.category}
        required
      >
        {(props) => (
          <select {...props} name="category" defaultValue="" className={inputClasses}>
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

      <Field id={fieldId("eventDate")} label="Date" error={state.errors.eventDate} required>
        {(props) => (
          <input
            {...props}
            name="eventDate"
            type="date"
            min={today}
            className={inputClasses}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={fieldId("startTime")}
          label="Start time"
          error={state.errors.startTime}
          required
        >
          {(props) => (
            <input {...props} name="startTime" type="time" className={inputClasses} />
          )}
        </Field>

        <Field
          id={fieldId("endTime")}
          label="End time"
          error={state.errors.endTime}
          hint="Ends after midnight? Just put the end time — we'll work it out."
        >
          {(props) => (
            <input {...props} name="endTime" type="time" className={inputClasses} />
          )}
        </Field>
      </div>

      <Field id={fieldId("location")} label="Where?" error={state.errors.location} required>
        {(props) => (
          <input
            {...props}
            name="location"
            type="text"
            maxLength={200}
            placeholder="Stake center gym"
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("description")}
        label="Anything else people should know?"
        error={state.errors.description}
      >
        {(props) => (
          <textarea
            {...props}
            name="description"
            rows={4}
            maxLength={2000}
            className={`${inputClasses} min-h-24 py-2`}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Does it repeat?</legend>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="repeatsWeekly"
            checked={repeats}
            onChange={(event) => setRepeats(event.target.checked)}
            className="h-5 w-5"
          />
          Every week, on the same weekday
        </label>

        {repeats ? (
          <>
            <Field
              id={fieldId("repeatUntil")}
              label="Repeat until"
              error={state.errors.repeatUntil}
              required
              hint="Up to a year out."
            >
              {(props) => (
                <input
                  {...props}
                  name="repeatUntil"
                  type="date"
                  min={today}
                  className={inputClasses}
                />
              )}
            </Field>

            <p className="text-xs text-ink-muted">
              Need to skip a week? Set this series to end before the gap, then
              suggest a second one that picks up after it.
            </p>
          </>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-sm font-semibold">
          How can an admin reach you?
        </legend>
        <p className="-mt-3 text-xs text-ink-muted">
          Only admins see this — it never appears on the public calendar.
        </p>

        <Field
          id={fieldId("submitterName")}
          label="Your name"
          error={state.errors.submitterName}
          required
        >
          {(props) => (
            <input
              {...props}
              name="submitterName"
              type="text"
              maxLength={100}
              autoComplete="name"
              className={inputClasses}
            />
          )}
        </Field>

        <Field
          id={fieldId("submitterContact")}
          label="Email or phone"
          error={state.errors.submitterContact}
          required
        >
          {(props) => (
            <input
              {...props}
              name="submitterContact"
              type="text"
              maxLength={200}
              className={inputClasses}
            />
          )}
        </Field>
      </fieldset>

      <SubmitButton />
    </form>
  );
}

/**
 * Disabled while the action is in flight, which is the whole double-submit
 * guard: `useFormStatus` reflects the real request state, so it cannot drift
 * out of sync with a manually-managed flag.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send it in"}
      </Button>
      <p aria-live="polite" className="text-sm text-ink-muted">
        {pending ? "Sending…" : ""}
      </p>
    </div>
  );
}
