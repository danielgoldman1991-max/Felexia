import { requireActiveWorkspace, type ActiveWorkspace } from "@/lib/auth";
import { isAdminRole, isOperatorRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";
import { createClient } from "@/lib/supabase/server";

export class EInvoiceError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = "EInvoiceError"; }
}

export function isEinvoiceRolloutEnabled(organizationId: string, env: Record<string, string | undefined> = process.env) {
  return env.FELEXIA_EINVOICING_ENABLED === "true" || (env.FELEXIA_EINVOICING_ORGANIZATION_IDS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean).includes(organizationId.toLowerCase());
}

export function canOperateEinvoices(workspace: ActiveWorkspace) {
  return isAdminRole(workspace.role) || isOperatorRole(workspace.role);
}

export type EinvoiceSettingsRow = {
  organization_id: string; enabled: boolean; connector_mode: "disabled" | "simulation";
  configuration: Record<string, unknown>; revision: number; updated_at?: string;
};

export async function getEinvoiceContext() {
  const workspace = await requireActiveWorkspace();
  const client = await createClient();
  const canAdmin = isAdminRole(workspace.role);
  const rolloutEnabled = isEinvoiceRolloutEnabled(workspace.organization.id);
  const { data, error } = await client.from("einvoice_settings").select("*").eq("organization_id", workspace.organization.id).maybeSingle();
  const schemaMissing = error && ["PGRST205", "42P01", "42883", "PGRST202"].includes(error.code);
  if (error && !schemaMissing) console.error("[einvoice] configuration unavailable", { code: error.code });
  const migrationReady = !error;
  const settings = data as EinvoiceSettingsRow | null;
  const enabled = rolloutEnabled && settings?.enabled === true && migrationReady;
  const writableSubscription = canWriteWorkspaceSubscription(workspace.subscription);
  const canWrite = enabled && writableSubscription && canOperateEinvoices(workspace);
  const unavailableReason = !migrationReady ? "Le module nécessite une configuration par l’exploitant. La facturation habituelle reste disponible."
    : !rolloutEnabled ? "La préparation électronique n’est pas encore activée pour cette entreprise. Les archives existantes restent consultables."
      : !settings?.enabled ? "Votre administrateur peut activer la préparation électronique dans la configuration du module."
        : !writableSubscription ? "Votre accès permet la consultation et le téléchargement. Activez votre abonnement pour préparer de nouveaux documents."
          : undefined;
  return { workspace, client, settings, rolloutEnabled, writableSubscription, enabled, migrationReady, canWrite, canAdmin, unavailableReason };
}

export type EinvoiceContext = Awaited<ReturnType<typeof getEinvoiceContext>>;

export function assertEinvoiceWrite(context: EinvoiceContext, admin = false) {
  if (admin && !context.canAdmin) throw new EInvoiceError("FORBIDDEN", "Cette action est réservée à l’administrateur.", 403);
  if (!context.canWrite) throw new EInvoiceError("WRITE_UNAVAILABLE", context.unavailableReason ?? "Votre profil ne permet pas cette opération.", 403);
}

export function assertEinvoiceConfiguration(context: EinvoiceContext) {
  if (!context.canAdmin) throw new EInvoiceError("FORBIDDEN", "Cette action est réservée à l’administrateur.", 403);
  if (!context.migrationReady) throw new EInvoiceError("SETUP_REQUIRED", "La configuration du module n’est pas disponible.", 503);
  if (!context.rolloutEnabled || !context.writableSubscription) throw new EInvoiceError("WRITE_UNAVAILABLE", context.unavailableReason ?? "L’activation n’est pas disponible.", 403);
}

export function uuid(value: unknown, label = "Référence") {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new EInvoiceError("INVALID_REFERENCE", `${label} invalide.`);
  return value;
}

export function sourceKind(value: unknown): "invoice" | "credit_note" {
  if (value !== "invoice" && value !== "credit_note") throw new EInvoiceError("INVALID_SOURCE", "Type de document invalide.");
  return value;
}

export function sourceRoute(kind: "invoice" | "credit_note", sourceId: string) {
  return `/facturation/electronique/${kind === "invoice" ? "factures" : "avoirs"}/${uuid(sourceId)}`;
}

export function safeEinvoiceError(error: unknown) {
  if (error instanceof EInvoiceError) return error.message;
  console.error("[einvoice] operation failed", { kind: error instanceof Error ? error.name : "unknown" });
  return "L’opération n’a pas pu être terminée. Vérifiez les informations puis réessayez ; aucun résultat DGI n’est présumé.";
}
