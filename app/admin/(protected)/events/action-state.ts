/**
 * Action state for the admin event forms. Kept out of `actions.ts` because a
 * `"use server"` module may only export async functions.
 */

export interface EventActionState {
  status: "idle" | "success" | "error";
  errors: Record<string, string>;
  formError?: string;
  message?: string;
}

export const INITIAL_EVENT_ACTION_STATE: EventActionState = {
  status: "idle",
  errors: {},
};
