"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Assistant = dynamic(() => import("./SupportAssistant").then(module => module.SupportAssistant), { ssr: false });
const PUBLIC_SUPPORT_PAGES = new Set(["/", "/pricing", "/mentions-legales", "/confidentialite", "/conditions"]);

/** Load the chat only on visitor pages; no company/session data is passed to it. */
export function PublicSupportAssistant() {
  const pathname = usePathname();
  return PUBLIC_SUPPORT_PAGES.has(pathname) ? <Assistant /> : null;
}
