import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

const money = (value: number) => value.toLocaleString("fr-FR");

/** Public offer facts already printed on /pricing, /essentiel and /pro. */
export function publicOfferCopy() {
  const essential = getPlanDefinition("essentiel");
  const pro = getPlanDefinition("premium");
  const monthly = money(essential.monthlyPrice);
  const yearly = money(essential.yearlyPrice);
  const documents = essential.limits.commercialDocumentsPerMonth?.toLocaleString("fr-FR") ?? "";
  return {
    trial: DEFAULT_TRIAL_DURATION_LABEL,
    monthly,
    yearly,
    users: essential.limits.users,
    documents,
    storageGb: essential.limits.storageMb / 1024,
    proUsers: pro.limits.users,
    proStorageGb: pro.limits.storageMb / 1024,
    essentielPrice: `${monthly} HT MAD par mois, ou ${yearly} HT MAD par an`,
    offerPitch: `ESSENTIEL à ${monthly} MAD HT/mois ou ${yearly} MAD HT/an. Essai gratuit de ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire.`,
  };
}
