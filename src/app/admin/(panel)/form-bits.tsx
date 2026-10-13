"use client";

import { type ReactNode } from "react";
import { FormMessage, SubmitButton, useFormAction, type ActionState } from "@/components/forms";

/** Small wrapper so server pages can use actions that return success/error messages. */
export function ActionForm({
  action,
  children,
  submit,
  className,
  variant,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  submit: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { state, onSubmit, pending: submitting } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto">
          <FormMessage state={state} />
        </div>
        <SubmitButton pending={submitting} variant={variant}>{submit}</SubmitButton>
      </div>
    </form>
  );
}
