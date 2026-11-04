import { redirect } from "next/navigation";

export default function LegacyNewEntryRedirect() {
  redirect("/comptabilite/ecritures/nouveau");
}
