"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isPublicSitePath } from "@/lib/public-site";

const Assistant = dynamic(() => import("./SupportAssistant").then(module => module.SupportAssistant), { ssr: false });

/** Load the chat only on visitor pages; no company/session data is passed to it. */
export function PublicSupportAssistant() {
  const pathname = usePathname();
  return isPublicSitePath(pathname) ? <Assistant /> : null;
}
