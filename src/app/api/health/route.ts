export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      app: "FelexiaERP",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
