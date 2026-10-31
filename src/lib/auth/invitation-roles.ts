/** A null selection follows the current viewer role, including after a
 * server refresh creates it for a legacy company. Never defaults to admin. */
export function getInvitationRoleId(
  roles: readonly { id: string; name: string }[],
  selectedRoleId: string | null,
): string | null {
  if (selectedRoleId && roles.some((role) => role.id === selectedRoleId)) return selectedRoleId;
  return roles.find((role) => role.name === "viewer")?.id ?? null;
}
