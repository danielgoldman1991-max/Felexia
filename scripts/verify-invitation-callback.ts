import assert from "node:assert/strict";
import { cleanInvitationCallbackUrl, invitationFragmentSession } from "../src/lib/auth/invitation-callback";

assert.deepEqual(invitationFragmentSession("#access_token=example-access&refresh_token=example-refresh&type=invite"), {
  access_token: "example-access", refresh_token: "example-refresh",
});
assert.equal(invitationFragmentSession("#access_token=partial"), null);
assert.equal(invitationFragmentSession("#refresh_token=partial"), null);
assert.equal(invitationFragmentSession(""), null);
assert.equal(invitationFragmentSession("#error=access_denied&access_token=ignored&refresh_token=ignored"), null);
assert.deepEqual(invitationFragmentSession("#access_token=encoded%2Bvalue&refresh_token=encoded%2Fvalue"), {
  access_token: "encoded+value", refresh_token: "encoded/value",
});

const cleaned = cleanInvitationCallbackUrl("https://felexia.pro/invitation?invitation=company-invite&token_hash=one-time-secret&type=invite&code=one-time-code#error=token-error&access_token=fragment-secret");
assert.equal(cleaned, "/invitation?invitation=company-invite");
assert.equal(cleanInvitationCallbackUrl("https://felexia.pro/invitation?error=access_denied&error_code=expired&error_description=example"), "/invitation");
assert.equal(cleanInvitationCallbackUrl("https://felexia.pro/invitation?invitation=kept"), "/invitation?invitation=kept");
console.log("Invitation callbacks: complete fragments, malformed fragments, provider errors and credential cleanup passed.");
