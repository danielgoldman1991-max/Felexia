/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["libxml2-wasm", "pdfkit"],
  outputFileTracingIncludes: {
    "/opengraph-image": ["./public/brand/felexiaerp-logo-horizontal.png"],
    "/facturation/electronique/**/*": ["./src/lib/e-invoicing/schemas/**/*", "./src/lib/e-invoicing/assets/**/*", "./node_modules/libxml2-wasm/lib/**/*"],
    "/api/cron/e-invoicing": ["./src/lib/e-invoicing/schemas/**/*", "./src/lib/e-invoicing/assets/**/*", "./node_modules/libxml2-wasm/lib/**/*"],
  },
  async headers() {
    return [{
      // Keep authentication/private responses out of search, without redirects,
      // cookie changes or a rule touching public assets/Google's ownership file.
      source: "/:privateRoot(abonnement|achats|agenda|api|articles|auth|avoirs|banques|bienvenue|caisses|clients|commandes|commerce|comptabilite|dashboard|decaissements|devis|documents|encaissements|facturation|factures|fournisseurs|invitation|livraisons|login|mot-de-passe-oublie|onboarding|outils|paiements|parametres|rapports|reinitialiser-mot-de-passe|relances|rh|stock|tiers|tresorerie|vente|ventes)/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" }],
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/organization-logos/**",
      },
    ],
  },
};

export default nextConfig;
