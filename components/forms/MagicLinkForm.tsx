"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import { requestMagicLink } from "@/app/admin/login/actions";
import {
  INITIAL_LOGIN_STATE,
  type LoginState,
} from "@/app/admin/login/login-state";
import { Button } from "@/components/ui/Button";

import { Field, inputClasses } from "./Field";

export function MagicLinkForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    requestMagicLink,
    INITIAL_LOGIN_STATE,
  );
  const id = useId();

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-cat-sports-border bg-cat-sports-bg p-5 text-cat-sports-fg"
      >
        <h2 className="font-bold">Check your email</h2>
        <p className="mt-1 text-sm">
          If that address is on the admin list, a sign-in link is on its way. It
          works once and expires after an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        id={`${id}-email`}
        label="Email address"
        error={state.error}
        required
        hint="The exact address on the ward's admin list."
      >
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={initialEmail}
            placeholder="you@example.com"
            className={inputClasses}
          />
        )}
      </Field>

      <SendButton />
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? "Sending…" : "Email me a sign-in link"}
    </Button>
  );
}
