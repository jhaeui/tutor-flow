"use client";

import type { FormEvent, ReactNode } from "react";

type CloseOnSubmitFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: ReactNode;
};

export default function CloseOnSubmitForm({
  action,
  className,
  children,
}: CloseOnSubmitFormProps) {
  function closeParentDetails(event: FormEvent<HTMLFormElement>) {
    const details = event.currentTarget.closest("details");
    if (details) details.removeAttribute("open");
  }

  return (
    <form action={action} className={className} onSubmit={closeParentDetails}>
      {children}
    </form>
  );
}
