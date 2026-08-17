/**
 * Shared action state for every admin form. Lives outside any `"use server"`
 * module, which may only export async functions, and outside the `(protected)`
 * route group, because the group editor on the public `/groups` page needs it
 * too.
 */

export interface AdminActionState {
  status: "idle" | "success" | "error";
  errors: Record<string, string>;
  formError?: string;
  message?: string;
}

export const INITIAL_ADMIN_ACTION_STATE: AdminActionState = {
  status: "idle",
  errors: {},
};
