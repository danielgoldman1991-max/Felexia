/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["libxml2-wasm", "pdfkit"],
  outputFileTracingIncludes: {
    "/facturation/electronique/**/*": ["./src/lib/e-invoicing/schemas/**/*", "./src/lib/e-invoicing/assets/**/*", "./node_modules/libxml2-wasm/lib/**/*"],
    "/api/cron/e-invoicing": ["./src/lib/e-invoicing/schemas/**/*", "./src/lib/e-invoicing/assets/**/*", "./node_modules/libxml2-wasm/lib/**/*"],
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
