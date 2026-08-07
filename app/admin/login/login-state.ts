/**
 * Login form action state. Kept out of `actions.ts` because a `"use server"`
 * module may only export async functions.
 */
export interface LoginState {
  status: "idle" | "sent" | "error";
  error?: string;
}

export const INITIAL_LOGIN_STATE: LoginState = { status: "idle" };
