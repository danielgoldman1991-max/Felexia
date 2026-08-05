export const BRAND = {
  name: "FelexiaERP",
  shortName: "Felexia",
  tagline: "Mini ERP moderne pour PME marocaines",
  logoHorizontal: "/brand/felexiaerp-logo-horizontal.png",
  logoMark: "/brand/felexiaerp-mark.png",
  favicon: "/brand/felexiaerp-mark.png",
  icon32: "/brand/felexiaerp-mark-32.png",
  icon48: "/brand/felexiaerp-mark-48.png",
  appleTouchIcon: "/brand/felexiaerp-apple-180.png",
} as const;

export const APP_BRAND = {
  name: BRAND.name,
  shortName: BRAND.shortName,
  tagline: BRAND.tagline,
  fullName: BRAND.name,
  icon: BRAND.logoMark,
  logo: BRAND.logoHorizontal,
  logoAlt: BRAND.name,
  favicon: BRAND.favicon,
} as const;
