import assert from "node:assert/strict";
import { getInvitationRoleId, matchesInvitationOrganization } from "../src/lib/auth/invitation-roles";
import { getRoleDescription, getRoleLabel, isAdminRole, isOperatorRole, isReadOnlyRole } from "../src/lib/auth/roles";

const admin = { id: "admin-id", name: "admin" };
const viewer = { id: "viewer-id", name: "viewer" };
const operator = { id: "operator-id", name: "operator" };
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
// Operator is an explicit daily-work choice, never an administrator or default.
assert.equal(getInvitationRoleId([admin, operator, viewer], operator.id), operator.id);
assert.equal(getInvitationRoleId([admin, operator, viewer], null), viewer.id);
assert.equal(getRoleLabel("operator"), "Opérateur");
assert.match(getRoleDescription("operator"), /Sans accès aux utilisateurs/);
assert.equal(isOperatorRole("operator"), true);
assert.equal(isAdminRole("operator"), false);
assert.equal(isReadOnlyRole("operator"), false);
// Legacy client context may only confirm the server-derived organization.
const organization = "10000000-0000-4000-8000-000000000001";
assert.equal(matchesInvitationOrganization(organization), true);
assert.equal(matchesInvitationOrganization(organization, null), true);
assert.equal(matchesInvitationOrganization(organization, organization), true);
assert.equal(matchesInvitationOrganization(organization, ` ${organization} `), true);
assert.equal(matchesInvitationOrganization(organization, "20000000-0000-4000-8000-000000000002"), false);
assert.equal(matchesInvitationOrganization(organization, "not-an-organization"), false);
console.log("Invitation roles: safe defaults, explicit operator, stale selections and tenant-bound legacy payloads passed.");
