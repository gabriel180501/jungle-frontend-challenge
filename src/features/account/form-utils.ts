export function focusError(
  form: HTMLFormElement | null,
  errors: Record<string, string>,
) {
  (
    form?.elements.namedItem(Object.keys(errors)[0]) as HTMLElement | null
  )?.focus();
}
