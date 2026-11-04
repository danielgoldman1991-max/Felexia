export type HrCatalogKind = "department" | "position" | "leave" | "schedule";

const labels: Record<HrCatalogKind, string> = {
  department: "Ce département",
  position: "Ce poste",
  leave: "Ce type de congé",
  schedule: "Cet horaire",
};

export const HR_DELETE_CONFIRM: Record<HrCatalogKind, string> = {
  department: "Supprimer définitivement ce département ? Cette action est irréversible et n'est possible que s'il n'est utilisé nulle part.",
  position: "Supprimer définitivement ce poste ? Cette action est irréversible et n'est possible que s'il n'est utilisé nulle part.",
  leave: "Supprimer définitivement ce type de congé ? Cette action est irréversible et n'est possible que s'il n'est utilisé nulle part.",
  schedule: "Supprimer définitivement cet horaire ? Cette action est irréversible et n'est possible que s'il n'est utilisé nulle part.",
};

export function hrCatalogDeleteDecision(kind: HrCatalogKind, used: number) {
  if (used > 0) {
    return { ok: false as const, error: `${labels[kind]} est encore utilisé. Archivez-le au lieu de le supprimer.` };
  }
  return { ok: true as const };
}

/** A delete that matches no row must not be reported as a success. */
export function hrCatalogDeleteOutcome(removed: number) {
  if (removed > 0) return { success: true as const };
  return {
    success: false as const,
    error: "La suppression n'a rien retiré. Vos droits ne permettent pas encore de supprimer cet élément, ou il a déjà disparu.",
  };
}
