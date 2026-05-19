export const BUSINESS_MODULE_KEYS = [
  "quotes",
  "invoicing",
  "documents",
  "crm",
  "purchases",
  "stock",
  "treasury",
  "accounting",
] as const;

export type BusinessModuleKey = (typeof BUSINESS_MODULE_KEYS)[number];
