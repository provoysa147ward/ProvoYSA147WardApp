"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteQuickLink,
  saveQuickLink,
  saveSiteSettings,
} from "@/app/admin/(protected)/content/actions";
import {
  INITIAL_ADMIN_ACTION_STATE,
  type AdminActionState,
} from "@/app/admin/(protected)/action-state";
import { Field, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { QuickLink, SiteSettings } from "@/lib/queries";

export function ContentManager({
  settings,
  quickLinks,
}: {
  settings: SiteSettings;
  quickLinks: QuickLink[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <SiteSettingsForm settings={settings} />
      <QuickLinksSection links={quickLinks} />
    </div>
  );
}

function Banner({ state }: { state: AdminActionState }) {
  if (state.formError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
      >
        {state.formError}
      </p>
    );
  }
  if (state.status === "success" && state.message) {
    return (
      <p
        role="status"
        className="rounded-xl border border-cat-sports-border bg-cat-sports-bg px-4 py-2 text-sm font-semibold text-cat-sports-fg"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    saveSiteSettings,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;

  return (
    <form action={action} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">The home page</h2>
      <Banner state={state} />

      <Field
        id={fieldId("announcement")}
        label="Announcement banner"
        error={state.errors.announcement}
        hint="Leave blank to hide the banner entirely."
      >
        {(props) => (
          <textarea
            {...props}
            name="announcement"
            rows={2}
            maxLength={500}
            defaultValue={settings.announcement}
            className={`${inputClasses} min-h-16 py-2`}
          />
        )}
      </Field>

      <Field
        id={fieldId("announcementExpires")}
        label="Hide the banner after"
        error={state.errors.announcementExpires}
        hint="Optional. The banner disappears on its own after this date."
      >
        {(props) => (
          <input
            {...props}
            name="announcementExpires"
            type="date"
            defaultValue={settings.announcementExpires ?? ""}
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("welcomeBlurb")}
        label="Welcome blurb"
        error={state.errors.welcomeBlurb}
      >
        {(props) => (
          <textarea
            {...props}
            name="welcomeBlurb"
            rows={3}
            maxLength={2000}
            defaultValue={settings.welcomeBlurb}
            className={`${inputClasses} min-h-20 py-2`}
          />
        )}
      </Field>

      <Field
        id={fieldId("sundayMeetingInfo")}
        label="Sunday meeting info"
        error={state.errors.sundayMeetingInfo}
        hint="e.g. Sundays at 9:00 AM · 1234 N Canyon Rd"
      >
        {(props) => (
          <input
            {...props}
            name="sundayMeetingInfo"
            type="text"
            maxLength={200}
            defaultValue={settings.sundayMeetingInfo}
            className={inputClasses}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">
          Who to ask for help
        </legend>
        <p className="-mt-2 text-xs text-ink-muted">
          Shown here in the admin area only, so whoever inherits this site knows
          who to contact. It never appears publicly.
        </p>

        <Field
          id={fieldId("contactName")}
          label="Name"
          error={state.errors.contactName}
        >
          {(props) => (
            <input
              {...props}
              name="contactName"
              type="text"
              maxLength={100}
              defaultValue={settings.contactName}
              className={inputClasses}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={fieldId("contactEmail")}
            label="Email"
            error={state.errors.contactEmail}
          >
            {(props) => (
              <input
                {...props}
                name="contactEmail"
                type="email"
                maxLength={200}
                defaultValue={settings.contactEmail}
                className={inputClasses}
              />
            )}
          </Field>

          <Field
            id={fieldId("contactPhone")}
            label="Phone"
            error={state.errors.contactPhone}
          >
            {(props) => (
              <input
                {...props}
                name="contactPhone"
                type="tel"
                maxLength={50}
                defaultValue={settings.contactPhone}
                className={inputClasses}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <SaveButton label="Save the home page" />
    </form>
  );
}

function QuickLinksSection({ links }: { links: QuickLink[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Quick links</h2>
        <Button variant="secondary" onClick={() => setAdding((was) => !was)}>
          {adding ? "Cancel" : "New link"}
        </Button>
      </div>

      {adding ? <QuickLinkForm /> : null}

      {links.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No links yet. The quick-links row is hidden until there is at least
          one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((link) => (
            <li key={link.id}>
              <QuickLinkForm link={link} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickLinkForm({ link }: { link?: QuickLink }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    saveQuickLink,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const [deleteState, deleteAction] = useActionState<AdminActionState, FormData>(
    deleteQuickLink,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <form action={action} className="flex flex-col gap-4">
        {link ? <input type="hidden" name="id" value={link.id} /> : null}
        <Banner state={state} />
        {deleteState.formError ? <Banner state={deleteState} /> : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id={fieldId("label")}
            label="Label"
            error={state.errors.label}
            required
          >
            {(props) => (
              <input
                {...props}
                name="label"
                type="text"
                maxLength={60}
                defaultValue={link?.label ?? ""}
                className={inputClasses}
              />
            )}
          </Field>

          <Field
            id={fieldId("url")}
            label="Link"
            error={state.errors.url}
            required
            hint="Must start with https://"
          >
            {(props) => (
              <input
                {...props}
                name="url"
                type="url"
                defaultValue={link?.url ?? ""}
                placeholder="https://"
                className={inputClasses}
              />
            )}
          </Field>

          <Field
            id={fieldId("sortOrder")}
            label="Order"
            error={state.errors.sortOrder}
          >
            {(props) => (
              <input
                {...props}
                name="sortOrder"
                type="number"
                min={0}
                max={9999}
                defaultValue={0}
                className={inputClasses}
              />
            )}
          </Field>
        </div>

        <SaveButton label={link ? "Save link" : "Add link"} />
      </form>

      {link ? (
        <ConfirmDialog
          trigger="Delete"
          title={`Delete "${link.label}"?`}
          confirmLabel="Delete it"
          body="This removes the link from the home page."
          action={deleteAction}
        >
          <input type="hidden" name="id" value={link.id} />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? "Saving…" : label}
    </Button>
  );
}
