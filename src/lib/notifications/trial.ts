import { createClient } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationSubscription, type OrganizationSubscription } from "@/lib/subscriptions/plan-access";
import { isPlanQuoteOnly } from "@/lib/subscriptions/commercial-offers";
import { getProQuoteHref } from "@/lib/subscriptions/quote-contact";

export type TrialNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  action_label: string | null;
  action_url: string | null;
  severity: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * Build the trial reminder payload based on status and days remaining.
 * Returns null if no notification should be generated.
 */
export function buildTrialNotification(
  status: string,
  trialEnd: string | null,
  daysLeft: number,
  now = new Date(),
  planCode?: string | null,
): { type: string; title: string; message: string; action_label: string; action_url: string; severity: string; metadata: Record<string, unknown> } | null {
  const today = now.toISOString().slice(0, 10);

  if (status === "active") {
    return null;
  }

  if (isPlanQuoteOnly(planCode)) {
    const metadata = { kind: "trial_reminder", days_left: 0, date: today, offer_mode: "quote", plan_code: "premium" };
    if (status === "trialing" || status === "trial") {
      if (!trialEnd || !Number.isFinite(Date.parse(trialEnd)) || !Number.isFinite(daysLeft)) return null;
      const days = Math.max(0, daysLeft);
      return {
        type: days <= 0 ? "trial_expired" : days <= 3 ? "trial_ending_soon" : days <= 7 ? "trial_ending" : "trial_active",
        title: days <= 0 ? "Accès PRO terminé" : days <= 7 ? "Accès PRO — échéance proche" : "Accès PRO",
        message: days <= 0
          ? "Votre accès de test PRO est terminé. Vos données restent consultables et exportables. Demandez un devis pour poursuivre avec PRO."
          : `Votre accès de test PRO est actif pour encore ${days} jour${days > 1 ? "s" : ""}. PRO est disponible sur devis : contactez l’équipe Felexia pour préparer la suite.`,
        action_label: "Demander un devis", action_url: getProQuoteHref(),
        severity: days <= 0 ? "error" : days <= 3 ? "urgent" : days <= 7 ? "warning" : "info",
        metadata: { ...metadata, days_left: days },
      };
    }
    if (["canceled", "past_due", "unpaid"].includes(status)) return {
      type: "subscription_inactive", title: "Accès PRO",
      message: "Votre accès PRO nécessite une action. Vos données restent consultables et exportables. Contactez l’équipe Felexia pour faire le point sur votre contrat PRO.",
      action_label: "Demander un devis", action_url: getProQuoteHref(), severity: "urgent", metadata,
    };
    return null;
  }

  if (status === "trialing" || status === "trial") {
    if (!trialEnd || !Number.isFinite(Date.parse(trialEnd)) || !Number.isFinite(daysLeft)) return null;
    if (daysLeft <= 0) {
      return {
        type: "trial_expired",
        title: "Essai terminé",
        message: "Votre essai gratuit est terminé. Vos données restent consultables et exportables. Activez votre abonnement pour enregistrer de nouvelles opérations.",
        action_label: "Activer mon abonnement",
        action_url: "/parametres/abonnement",
        severity: "error",
        metadata: { kind: "trial_reminder", days_left: 0, date: today },
      };
    }
    if (daysLeft <= 3) {
      return {
        type: "trial_ending_soon",
        title: "Essai - Attention",
        message: `Attention : votre essai gratuit se termine dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Activez votre abonnement pour continuer à créer et modifier vos opérations.`,
        action_label: "Payer maintenant",
        action_url: "/parametres/abonnement",
        severity: "urgent",
        metadata: { kind: "trial_reminder", days_left: daysLeft, date: today },
      };
    }
    if (daysLeft <= 7) {
      return {
        type: "trial_ending",
        title: "Essai",
        message: `Votre essai gratuit se termine dans ${daysLeft} jours. Activez votre abonnement pour continuer à enregistrer vos opérations sans interruption.`,
        action_label: "Payer maintenant",
        action_url: "/parametres/abonnement",
        severity: "warning",
        metadata: { kind: "trial_reminder", days_left: daysLeft, date: today },
      };
    }
    return {
      type: "trial_active",
      title: "Essai gratuit",
      message: `Votre essai gratuit Felexia est actif. Il vous reste ${daysLeft} jours avant la fin de votre période d'essai.`,
      action_label: "Voir mon abonnement",
      action_url: "/parametres/abonnement",
      severity: "info",
      metadata: { kind: "trial_reminder", days_left: daysLeft, date: today },
    };
  }

  if (["canceled", "past_due", "unpaid"].includes(status)) {
    return {
      type: "subscription_inactive",
      title: "Abonnement",
      message: "Votre abonnement nécessite une action pour reprendre la saisie de vos opérations. Vos données restent consultables et exportables.",
      action_label: "Voir mon abonnement",
      action_url: "/parametres/abonnement",
      severity: "urgent",
      metadata: { kind: "trial_reminder", days_left: 0, date: today },
    };
  }

  return null;
}

/**
 * Resolve reminders only from the same canonical subscription as the workspace.
 */
export function buildCurrentTrialNotification(sub: OrganizationSubscription | null, now = new Date()) {
  if (!sub) return null;
  const end = sub.trialEndsAt;
  const daysLeft = end ? Math.max(0, Math.ceil((Date.parse(end) - now.getTime()) / 86400000)) : NaN;
  return buildTrialNotification(sub.status, end, daysLeft, now, sub.planCode);
}

const TRIAL_TYPES = new Set(["trial_expired", "trial_ending_soon", "trial_ending", "trial_active", "subscription_inactive"]);

/** Hide obsolete reminders without deleting historical notifications. */
export function isCurrentTrialNotification(notification: Pick<TrialNotification, "type" | "metadata">, sub: OrganizationSubscription | null, now = new Date()) {
  if (notification.metadata?.kind !== "trial_reminder" && !TRIAL_TYPES.has(notification.type)) return true;
  const expected = buildCurrentTrialNotification(sub, now);
  return Boolean(expected && notification.type === expected.type
    && notification.metadata?.date === expected.metadata.date
    && notification.metadata.days_left === expected.metadata.days_left
    && notification.metadata.offer_mode === expected.metadata.offer_mode
    && notification.metadata.subscription_id === sub?.id
    && notification.metadata.subscription_status === sub?.status
    && notification.metadata.trial_end === sub?.trialEndsAt);
}

function reminderId(organizationId: string, sub: OrganizationSubscription, notification: NonNullable<ReturnType<typeof buildCurrentTrialNotification>>) {
  const bytes = createHash("sha256").update(JSON.stringify([
    "felexia-trial-reminder-v1", organizationId, sub.id, sub.status, sub.trialEndsAt,
    notification.type, notification.metadata.date, notification.metadata.days_left,
    ...(isPlanQuoteOnly(sub.planCode) ? ["quote"] : []),
  ])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The primary key also deduplicates concurrent insertions of the same state. */
export async function generateTrialNotificationForOrg(
  organizationId: string,
  options: { client?: SupabaseClient; now?: Date } = {},
): Promise<"created" | "skipped"> {
  const supabase = options.client ?? await createClient();
  const now = options.now ?? new Date();
  const sub = await getOrganizationSubscription(organizationId, { client: supabase, throwOnError: true });
  const notification = buildCurrentTrialNotification(sub, now);
  if (!notification) return "skipped";
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart.getTime() + 86400000);
  const { data: existing, error: readError } = await supabase
    .from("app_notifications")
    .select("id,type,metadata")
    .eq("organization_id", organizationId)
    .eq("type", notification.type)
    .gte("created_at", dayStart.toISOString())
    .lt("created_at", nextDay.toISOString())
    .limit(1);

  if (readError) throw new Error("TRIAL_NOTIFICATION_READ_FAILED");
  if (existing?.some(row => isCurrentTrialNotification(row, sub, now))) return "skipped";
  // An activation while this batch was running must not use its earlier state.
  const current = await getOrganizationSubscription(organizationId, { client: supabase, throwOnError: true });
  const currentNotification = buildCurrentTrialNotification(current, now);
  if (!current || !currentNotification || current.id !== sub?.id || current.trialEndsAt !== sub?.trialEndsAt
    || current.status !== sub?.status || JSON.stringify(currentNotification) !== JSON.stringify(notification)) return "skipped";
  const { error: insertError } = await supabase.from("app_notifications").insert({
    id: reminderId(organizationId, current, currentNotification),
    organization_id: organizationId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    action_label: notification.action_label,
    action_url: notification.action_url,
    severity: notification.severity,
    metadata: { ...notification.metadata, subscription_id: current.id, subscription_status: current.status, trial_end: current.trialEndsAt },
  });
  if (insertError?.code === "23505") return "skipped";
  if (insertError) throw new Error("TRIAL_NOTIFICATION_WRITE_FAILED");
  return "created";
}
