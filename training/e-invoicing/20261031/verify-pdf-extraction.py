"""Independent PDF structure/text/geometry checks; rendering is reviewed separately."""
import collections
import hashlib
import io
import json
import logging
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parents[3]
PROOF = Path(__file__).resolve().parent / "pdf-qa"
generation = json.loads((PROOF / "generation.json").read_text(encoding="utf-8"))
checks = []


def check(name, condition, detail=None):
    checks.append({"name": name, "passed": bool(condition), **({"detail": detail} if detail is not None else {})})
    if not condition:
        raise AssertionError(f"{name}: {detail}")


all_documents = []
log_stream = io.StringIO()
handler = logging.StreamHandler(log_stream)
logging.getLogger("pypdf").addHandler(handler)
for document in generation["documents"]:
    file = ROOT / document["file"]
    raw = file.read_bytes()
    reader = PdfReader(file, strict=True)
    metadata = {key: str(value.get_object()) for key, value in reader.metadata.items()}
    check(document["name"] + ": PDF digest matches generation", hashlib.sha256(raw).hexdigest() == document["pdfSha256"])
    check(document["name"] + ": metadata title", document["name"] == "einvoice-multipage" and "0068" in metadata["/Title"] or document["name"] != "einvoice-multipage" and "0001" in metadata["/Title"])
    check(document["name"] + ": metadata author", metadata["/Author"] == "Atelier Démonstration - مقاولة تجريبية")
    check(document["name"] + ": metadata creator", metadata["/Creator"] == "Felexia Pro")
    check(document["name"] + ": no encryption", not reader.is_encrypted)
    check(document["name"] + ": no signature field", not reader.get_fields())
    pages = []
    text = ""
    logical_spans = []
    fonts = set()
    with pdfplumber.open(file) as plumber:
        for index, page in enumerate(reader.pages):
            page_text = page.extract_text()
            text += page_text + "\n"
            check(f'{document["name"]}: page {index + 1} A4', abs(float(page.mediabox.width) - 595.28) < 0.1 and abs(float(page.mediabox.height) - 841.89) < 0.1)
            check(f'{document["name"]}: page {index + 1} snapshot hash', document["snapshotSha256"] in page_text.replace("\n", ""))
            check(f'{document["name"]}: page {index + 1} explicit unsigned profile', "UBL" in page_text)
            resources = page["/Resources"]["/Font"]
            for ref in resources.values():
                font = ref.get_object()
                if font.get("/Subtype") != "/Type0":
                    continue
                fonts.add(str(font["/BaseFont"]))
                descendant = font["/DescendantFonts"][0].get_object()
                descriptor = descendant["/FontDescriptor"].get_object()
                check(f'{document["name"]}: embedded {font["/BaseFont"]}', "/FontFile2" in descriptor or "/FontFile3" in descriptor)
                cmap = font["/ToUnicode"].get_object().get_data()
                check(f'{document["name"]}: valid nonempty ToUnicode destinations', not re.search(rb"<\s*>", cmap))
            streams = ContentStream(page.get_contents(), reader)
            missing = []
            for operands, operator in streams.operations:
                if operator == b"BDC" and str(operands[0]) == "/Span" and "/ActualText" in operands[1]:
                    logical_spans.append(str(operands[1]["/ActualText"]))
                if operator == b"Tj":
                    strings = operands
                elif operator == b"TJ":
                    strings = operands[0]
                else:
                    continue
                for item in strings:
                    encoded = getattr(item, "original_bytes", item if isinstance(item, bytes) else None)
                    if isinstance(encoded, bytes):
                        missing.extend(offset for offset in range(0, len(encoded), 2) if encoded[offset:offset + 2] == b"\x00\x00")
            check(f'{document["name"]}: page {index + 1} no .notdef glyph', not missing, missing)
            chars = [char for char in plumber.pages[index].chars if char.get("text", "").strip()]
            out_of_bounds = [{"text": char["text"], "box": [char["x0"], char["top"], char["x1"], char["bottom"]]} for char in chars if char["x0"] < 41 or char["x1"] > 554.5 or char["top"] < 18 or char["bottom"] > 809]
            check(f'{document["name"]}: page {index + 1} text inside margins', not out_of_bounds, out_of_bounds[:5])
            body_chars = [char for char in chars if char["top"] > 140 and char["top"] < 750]
            check(f'{document["name"]}: page {index + 1} body clear of footer', not body_chars or max(char["bottom"] for char in body_chars) < 748)
            pages.append({"page": index + 1, "characters": len(chars), "textBounds": [round(min(char["x0"] for char in chars), 2), round(min(char["top"] for char in chars), 2), round(max(char["x1"] for char in chars), 2), round(max(char["bottom"] for char in chars), 2)], "bodyBottom": round(max((char["bottom"] for char in body_chars), default=0), 2)})
    (PROOF / (document["name"] + "-extracted.txt")).write_text(text, encoding="utf-8")
    check(document["name"] + ": internal notes absent", generation["internalNoteSentinel"] not in text)
    logical_text = " ".join(logical_spans)
    check(document["name"] + ": logical Arabic name retained in ActualText", "مقاولة تجريبية" in logical_text)
    check(document["name"] + ": logical mixed-script name retained", "Client de test - عميل تجريبي" in logical_text)
    check(document["name"] + ": ActualText excludes internal notes", generation["internalNoteSentinel"] not in logical_text)
    check(document["name"] + ": exact total present", document["totals"]["totalTtc"] in text)
    check(document["name"] + ": exact HT present", document["totals"]["subtotalHt"] in text)
    check(document["name"] + ": exact tax present", document["totals"]["taxTotal"] in text)
    xml_raw = (PROOF / (document["name"] + ".xml")).read_bytes()
    xml = ET.fromstring(xml_raw)
    ns = {"cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2", "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"}
    check(document["name"] + ": XML digest matches immutable artifact", hashlib.sha256(xml_raw).hexdigest() == document["xmlSha256"])
    for tag, field in [("TaxExclusiveAmount", "subtotalHt"), ("TaxInclusiveAmount", "totalTtc"), ("PayableAmount", "totalTtc")]:
        check(document["name"] + ": exact XML/PDF " + tag, xml.findtext("cac:LegalMonetaryTotal/cbc:" + tag, namespaces=ns) == document["totals"][field])
    check(document["name"] + ": exact XML/PDF VAT", xml.findtext("cac:TaxTotal/cbc:TaxAmount", namespaces=ns) == document["totals"]["taxTotal"])
    check(document["name"] + ": XML row count retained in PDF", len(xml.findall("cac:InvoiceLine", ns)) + len(xml.findall("cac:CreditNoteLine", ns)) == document["rows"])
    check(document["name"] + ": real XSD validation succeeded", document["xsdValid"] is True and document["signed"] is False and document["officialConformityClaim"] is False)
    if document["name"] == "einvoice-multipage":
        check("multipage: compact layout no more than twelve pages", len(reader.pages) <= 12)
        markers = re.findall(r"QA-ROW-\d{3}", text)
        check("multipage: all 68 rows exactly once", collections.Counter(markers) == collections.Counter(f"QA-ROW-{index:03d}" for index in range(1, 69)), markers)
        markers = re.findall(r"QA-NOTE-\d{3}", text)
        check("multipage: all 15 note paragraphs exactly once", collections.Counter(markers) == collections.Counter(f"QA-NOTE-{index:03d}" for index in range(1, 16)), markers)
        check("multipage: last note retained", text.count("QA-NOTES-FIN") == 1)
        check("multipage: repeated table headers", all("Désignation" in reader.pages[index].extract_text() for index in range(len(reader.pages)) if "QA-ROW-" in reader.pages[index].extract_text()))
    else:
        check(document["name"] + ": three-row document fits one page", len(reader.pages) == 1)
        check(document["name"] + ": all three rows exactly once", all(text.count(f"QA-SHORT-{index:02d}") == 1 for index in range(1, 4)))
        check(document["name"] + ": logical Arabic public note retained", "وثيقة تجريبية لا تمثل فاتورة حقيقية." in logical_text)
    if document["name"] == "credit-note-fr":
        check("credit note: original invoice reference retained", text.count("FAC-DEMO-0001") == 1)
        check("credit note: credit title", "AVOIR" in text)
    all_documents.append({"name": document["name"], "pages": pages, "embeddedFonts": sorted(fonts), "metadata": metadata})

check("pypdf strict: no parser warnings", not log_stream.getvalue().strip(), log_stream.getvalue())
check("French and Arabic same immutable snapshot", generation["documents"][0]["snapshotSha256"] == generation["documents"][1]["snapshotSha256"])
check("French and Arabic same immutable XML", generation["documents"][0]["xmlSha256"] == generation["documents"][1]["xmlSha256"])
check("No network attempted", generation["networkAttempts"] == 0)

# Contact sheets are review aids. Original rendered PNGs retain full resolution.
for document in all_documents:
    images = []
    for page in document["pages"]:
        pngs = [file for file in PROOF.glob(f'{document["name"]}-*.png') if re.fullmatch(re.escape(document["name"]) + r"-0*" + str(page["page"]) + r"\.png", file.name)]
        image = Image.open(pngs[0]).convert("RGB")
        image.thumbnail((300, 425))
        images.append(image)
    for batch_start in range(0, len(images), 9):
        batch = images[batch_start:batch_start + 9]
        sheet = Image.new("RGB", (3 * 320, ((len(batch) + 2) // 3) * 455), "#dce3ec")
        draw = ImageDraw.Draw(sheet)
        for offset, image in enumerate(batch):
            x, y = (offset % 3) * 320 + 10, (offset // 3) * 455 + 25
            sheet.paste(image, (x, y))
            draw.text((x, y - 18), f'{document["name"]} / {batch_start + offset + 1}', fill="black")
        sheet.save(PROOF / f'{document["name"]}-contact-{batch_start // 9 + 1}.png')
    # Remove stale renders from earlier pagination passes, scoped to this QA
    # directory and these four explicit fixture prefixes only.
    for file in PROOF.glob(document["name"] + "-*.png"):
        match = re.fullmatch(re.escape(document["name"]) + r"-(contact-)?(\d+)\.png", file.name)
        if not match:
            continue
        limit = (len(document["pages"]) + 8) // 9 if match[1] else len(document["pages"])
        if int(match[2]) > limit:
            assert file.resolve().is_relative_to(PROOF.resolve())
            file.unlink()

report = {"success": True, "checks": checks, "passed": sum(item["passed"] for item in checks), "documents": all_documents, "visualReview": "Must be completed by viewing original Poppler PNGs; text/geometry checks do not establish visual fidelity"}
(PROOF / "extraction.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"success": True, "passed": report["passed"], "pages": {document["name"]: len(document["pages"]) for document in all_documents}}))
