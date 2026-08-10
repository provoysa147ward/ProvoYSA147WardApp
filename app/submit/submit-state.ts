/**
 * The submission form's action state.
 *
 * This lives outside `actions.ts` on purpose: a `"use server"` module may only
 * export async functions, so a constant exported from there arrives as
 * `undefined` at runtime.
 */

export interface SubmitState {
  status: "idle" | "success" | "error";
  /** Field-keyed messages for inline display. */
  errors: Record<string, string>;
  /** A problem that isn't tied to one field. */
  formError?: string;
}

export const INITIAL_SUBMIT_STATE: SubmitState = {
  status: "idle",
  errors: {},
};
