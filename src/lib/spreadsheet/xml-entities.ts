/** Numeric and named XML/HTML entities, including openpyxl-style &#233; and &eacute;. */
export function decodeXmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
    eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
    agrave: "à", aacute: "á", acirc: "â", auml: "ä",
    icirc: "î", iuml: "ï", iacute: "í",
    ocirc: "ô", ouml: "ö", oacute: "ó",
    ugrave: "ù", ucirc: "û", uuml: "ü", uacute: "ú",
    ccedil: "ç", yacute: "ý",
    Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Acirc: "Â", Ccedil: "Ç",
  };
  const code = (point: number) => {
    if (!Number.isInteger(point) || point <= 0 || point > 0x10ffff) return "";
    return String.fromCodePoint(point);
  };
  return value
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) => code(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]{1,7});/g, (_, dec: string) => code(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (token, name: string) => named[name] ?? named[name.toLowerCase()] ?? token);
}
