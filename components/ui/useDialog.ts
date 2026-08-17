"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drives a native `<dialog>` from React state.
 *
 * `showModal()` and `close()` are imperative and cannot be expressed as props,
 * so every modal on the site needs this same ref-and-effect pair. It lives here
 * once rather than being copied into each of them.
 *
 * Spread `dialogProps` onto the `<dialog>`: the `onClose` in it is what keeps
 * React's state honest when the browser closes the dialog on its own — Escape,
 * or a form submitting with `method="dialog"`.
 */
export function useDialog() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    dialogProps: { ref, onClose: () => setOpen(false) },
  };
}
