"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { archiveHrEmployeeAction, type EmployeeArchiveState } from "@/lib/hr/employee-archive-actions";

const initial: EmployeeArchiveState = { success: false };

export function ArchiveEmployeeButton({ employeeId }: { employeeId: string }) {
  const [state, action, pending] = useActionState(archiveHrEmployeeAction, initial);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Archiver ce salarié ? Il disparaît des listes actives. Ses bulletins, contrats et congés restent en place.")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={employeeId} />
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>{pending ? "Archivage…" : "Archiver"}</Button>
      {state.error ? <p className="mt-2 text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}
