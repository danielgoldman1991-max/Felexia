import json
import re
import sys
from pathlib import Path
import pdfplumber

folder = Path(sys.argv[1])
fixtures = [
    ('facture-courte-mad', 3, False, 'MAD'),
    ('facture-longue-eur', 75, False, 'EUR'),
    ('journal-long-paysage', 120, True, 'MAD'),
]
report = []
errors = []
for name, row_count, landscape, currency in fixtures:
    with pdfplumber.open(folder / f'{name}.pdf') as pdf:
        pages = []
        all_text = []
        for index, page in enumerate(pdf.pages):
            text = page.extract_text() or ''
            all_text.append(text)
            outside = [c for c in page.chars if c.get('text', '').strip() and (c['x0'] < 20 or c['x1'] > page.width - 20 or c['top'] < 20 or c['bottom'] > page.height - 12)]
            dimensions_ok = abs(page.width - (841.89 if landscape else 595.28)) < 1 and abs(page.height - (595.28 if landscape else 841.89)) < 1
            if not dimensions_ok:
                errors.append(f'{name}: unexpected A4 dimensions page {index+1}')
            if outside:
                errors.append(f'{name}: {len(outside)} characters outside safe page bounds on page {index+1}')
            pages.append({'page': index+1, 'width': round(page.width, 2), 'height': round(page.height, 2), 'characters': len(page.chars), 'outsideSafeBounds': len(outside), 'pageCounter': f'Page {index+1} / {len(pdf.pages)}' in text, 'tableHeader': ('Désignation' in text) if not landscape else ('N° écriture' in text)})
        joined = '\n'.join(all_text)
        missing = []
        duplicated = []
        for line in range(1, row_count+1):
            marker = f'ECR-QA-{line:03d}' if landscape else f'LIGNE-QA-{line:03d}'
            count = joined.count(marker)
            if count == 0: missing.append(marker)
            if count > 1: duplicated.append(marker)
        if missing: errors.append(f'{name}: missing rows {missing}')
        if duplicated: errors.append(f'{name}: duplicated rows {duplicated}')
        if any(not p['pageCounter'] for p in pages): errors.append(f'{name}: missing page counter')
        if name == 'facture-courte-mad' and len(pages) != 1: errors.append(f'{name}: a short invoice should fit on one A4 page, got {len(pages)}')
        if name == 'facture-longue-eur':
            if 'MAD' in joined: errors.append(f'{name}: wrong MAD currency')
            if not ('€' in joined or 'EUR' in joined): errors.append(f'{name}: EUR currency not visible')
            if 'NOTES-QA-FIN' not in joined: errors.append(f'{name}: notes incomplete')
        if 'NE-PAS-IMPRIMER-NOTE-INTERNE-QA' in joined: errors.append(f'{name}: private note leaked')
        if not landscape and 'Total TTC' not in joined: errors.append(f'{name}: total missing')
        if landscape and 'FIN-JOURNAL-QA' not in joined: errors.append(f'{name}: footer missing')
        text_path = folder / f'{name}.txt'
        text_path.write_text('\n\n--- PAGE ---\n\n'.join(all_text), encoding='utf-8')
        report.append({'name': name, 'pages': pages, 'expectedRows': row_count, 'missingRows': missing, 'duplicateRows': duplicated, 'currency': currency})
result = {'engine': 'WeasyPrint 70.0; PDF inspection pdfplumber', 'syntheticOnly': True, 'results': report, 'errors': errors, 'passed': not errors}
(folder / 'pdf-layout-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if not errors else 1)
