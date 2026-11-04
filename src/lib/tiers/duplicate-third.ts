export type ThirdIdentity = { id: string; name: string; ice: string | null };

export function duplicateThirdWarning(
  candidates: ThirdIdentity[],
  input: { name: string; ice: string | null },
  ignoreId?: string | null,
) {
  const others = candidates.filter((row) => row.id !== ignoreId);
  const ice = input.ice?.trim() ?? "";
  const name = input.name.trim().toLocaleLowerCase("fr-MA");
  const sameIce = ice ? others.find((row) => (row.ice ?? "").trim() === ice) : undefined;
  if (sameIce) {
    return `Un tiers existe déjà avec le même ICE : ${sameIce.name}. Aucune fiche n’est fusionnée. Confirmez pour créer quand même.`;
  }
  const sameName = others.find((row) => row.name.trim().toLocaleLowerCase("fr-MA") === name);
  if (sameName) {
    return `Un tiers existe déjà avec le même nom : ${sameName.name}. Aucune fiche n’est fusionnée. Confirmez pour créer quand même.`;
  }
  return null;
}
