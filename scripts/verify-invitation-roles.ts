import assert from "node:assert/strict";
import { getInvitationRoleId } from "../src/lib/auth/invitation-roles";

const admin = { id: "admin-id", name: "admin" };
const viewer = { id: "viewer-id", name: "viewer" };
const oldCompanyRoles = [admin];
const refreshedRoles = [admin, viewer];

// A legacy company first submits null; the server prepares its viewer role.
assert.equal(getInvitationRoleId(oldCompanyRoles, null), null);
// React keeps its local state on router.refresh; the new props must select viewer.
assert.equal(getInvitationRoleId(refreshedRoles, null), viewer.id);
assert.equal(getInvitationRoleId(refreshedRoles, ""), viewer.id);
// An elevated role requires a deliberate selection and is reset after success.
assert.equal(getInvitationRoleId(refreshedRoles, admin.id), admin.id);
assert.equal(getInvitationRoleId(refreshedRoles, null), viewer.id);
// Removed/stale selections must never select the browser's first option (admin).
assert.equal(getInvitationRoleId(refreshedRoles, "removed-role-id"), viewer.id);
assert.equal(getInvitationRoleId(oldCompanyRoles, "removed-role-id"), null);
assert.equal(getInvitationRoleId([], admin.id), null);
console.log("Invitation roles: legacy fallback, refreshed viewer, explicit choice, next invitation and stale selections passed.");
