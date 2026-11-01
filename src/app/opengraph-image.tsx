import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "FelexiaERP — ESSENTIEL au quotidien, PRO sur devis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/felexiaerp-logo-horizontal.png"));
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "54px 68px", background: "linear-gradient(135deg, #edf3ff 0%, #ffffff 58%, #dff7ed 100%)", color: "#15243f", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {/* ImageResponse embeds the local brand image; no remote image request. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString("base64")}`} alt="" width={420} height={140} />
      </div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 68, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-2px", maxWidth: 1060 }}>Prenez de la hauteur. Pilotez en toute liberté.</div>
      <div style={{ display: "flex", marginTop: 30, fontSize: 29, color: "#455674" }}>ESSENTIEL au quotidien. PRO pour une vue d’ensemble.</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 32, borderTop: "1px solid #cbd7e5", fontSize: 22, color: "#455674" }}>
        <span>Gestion d’entreprise et ERP au Maroc</span>
        <span>www.felexia.pro</span>
      </div>
    </div>,
    size,
  );
}
