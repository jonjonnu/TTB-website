"use client";

import { useFormStatus } from "react-dom";
import { startTransition, useActionState, useEffect, useRef, type ComponentProps, type FormEvent } from "react";
import { Button } from "@/components/ui";

export type ActionState = { error?: string; ok?: string } | undefined;

/**
 * Like useActionState, but submits via onSubmit so React doesn't clear the form
 * when the server returns an error (the user keeps what they typed).
 */
export function useFormAction(action: (state: ActionState, form: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement | null>(null);
  // Clear the form only after a success.
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    form.current = e.currentTarget;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }
  return { state, onSubmit, pending };
}

export function SubmitButton({
  children,
  pendingText = "กำลังดำเนินการ…",
  pending: pendingProp,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-lg bg-bad-50 px-3 py-2 text-sm text-bad">
        {state.error}
      </p>
    );
  if (state.ok) return <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">{state.ok}</p>;
  return null;
}
