import { downloadSecret } from "@/lib/guides/download-token";
import { handleGuideDownload } from "@/lib/guides/download-http";
import { readGuidePdf } from "@/lib/guides/files";
import { grantIsActive } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleGuideDownload(request, {
    secret: downloadSecret(),
    grantActive: grantIsActive,
    readFile: readGuidePdf,
  });
}
