/**
 * Shared action state for the admin content forms. Lives outside any
 * `"use server"` module, which may only export async functions.
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
