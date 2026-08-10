/**
 * A field no real person should ever fill in.
 *
 * Bots fill every input they find; people never see this one. Getting that
 * right for *everyone* takes more than `display:none`:
 *
 *  - `aria-hidden` keeps it out of the accessibility tree, so a screen-reader
 *    user is never asked to fill in a field that would silently discard their
 *    submission.
 *  - `tabIndex={-1}` keeps it off the keyboard tab order.
 *  - `autoComplete="off"` stops a password manager from helpfully populating it.
 *
 * Without those three, the honeypot would penalise exactly the people least
 * able to work out why their event never appeared.
 */
export function HoneypotField({ name = "website" }: { name?: string }) {
  return (
    <div aria-hidden="true" className="hidden">
      <label htmlFor={name}>Website (leave this blank)</label>
      <input
        type="text"
        id={name}
        name={name}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}
