"""Paint fictitious invoices from layout JSON. Not a runtime dependency of the app."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SCALE = 2
PAGE_W = int(595 * SCALE)
PAGE_H = int(842 * SCALE)

EFFECTS = {
    "pied-legal": "rotate",
    "classique": "perspective",
    "encadre": "moire",
    "net-a-payer": "blur",
    "separateurs-point": "contrast",
    "grands-montants": "rotate-blur",
    "quinze-lignes": "rotate-soft",
    "deux-pages": "moire-contrast",
}


def pages_of(ops):
    grouped = {}
    for op in ops:
        page = int(op["y"] // 900)
        grouped.setdefault(page, []).append({**op, "y": op["y"] - page * 900})
    return [grouped[key] for key in sorted(grouped)]


def render_page(ops):
    image = Image.new("RGB", (PAGE_W, PAGE_H), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, 24)
    number_font = ImageFont.truetype(FONT, 32)
    for op in ops:
        chosen = number_font if op["text"].startswith(("FACTURE", "Facture", "Réf")) else font
        draw.text((op["x"] * SCALE, op["y"] * SCALE), op["text"], fill=(20, 24, 28), font=chosen)
    return image


def perspective(image):
    width, height = image.size
    # Mild 4-point warp, about 3 degrees of keystone.
    coefficients = find_coeffs(
        [(0, 0), (width, 0), (width, height), (0, height)],
        [(28, 18), (width - 46, 0), (width - 12, height - 16), (8, height - 36)],
    )
    return image.transform(image.size, Image.Transform.PERSPECTIVE, coefficients, Image.Resampling.BICUBIC, fillcolor=(236, 232, 224))


def find_coeffs(target, source):
    matrix = []
    for (x, y), (u, v) in zip(target, source):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    vector = [value for point in source for value in point]
    return [round(value, 6) for value in solve(matrix, vector)]


def solve(matrix, vector):
    size = len(vector)
    work = [row[:] + [vector[index]] for index, row in enumerate(matrix)]
    for col in range(size):
        pivot = max(range(col, size), key=lambda row: abs(work[row][col]))
        work[col], work[pivot] = work[pivot], work[col]
        factor = work[col][col]
        work[col] = [value / factor for value in work[col]]
        for row in range(size):
            if row == col:
                continue
            scale = work[row][col]
            work[row] = [value - scale * work[col][index] for index, value in enumerate(work[row])]
    return [row[-1] for row in work]


def moire(image):
    overlay = Image.new("RGB", image.size, (180, 180, 180))
    pixels = overlay.load()
    for y in range(image.height):
        band = 150 + int(70 * abs((y % 6) - 3))
        if y % 5 == 0:
            for x in range(image.width):
                pixels[x, y] = (band, band, band)
    return Image.blend(image, overlay, 0.18)


def apply_effect(image, name):
    paper = Image.new("RGB", image.size, (244, 240, 230))
    image = Image.blend(paper, image, 0.92)
    if name == "rotate":
        image = image.rotate(3.5, expand=True, fillcolor=(244, 240, 230), resample=Image.Resampling.BICUBIC)
    elif name == "rotate-soft":
        image = image.rotate(2.2, expand=True, fillcolor=(244, 240, 230), resample=Image.Resampling.BICUBIC)
    elif name == "rotate-blur":
        image = image.rotate(4.8, expand=True, fillcolor=(236, 232, 224), resample=Image.Resampling.BICUBIC)
        image = image.filter(ImageFilter.GaussianBlur(1.1))
    elif name == "perspective":
        image = perspective(image)
    elif name == "blur":
        image = image.filter(ImageFilter.GaussianBlur(1.3))
    elif name == "moire":
        image = moire(image.rotate(3, expand=True, fillcolor=(230, 230, 230), resample=Image.Resampling.BICUBIC))
    elif name == "contrast":
        image = ImageEnhance.Contrast(image).enhance(0.62)
        image = ImageEnhance.Brightness(image).enhance(0.9)
    elif name == "moire-contrast":
        image = ImageEnhance.Contrast(moire(image)).enhance(0.75)
        image = image.rotate(2.5, expand=True, fillcolor=(232, 230, 226), resample=Image.Resampling.BICUBIC)
    return image


def prepare(source, mode):
    image = orient(source.convert("RGB"))
    if image.width < 1800:
        scale = 1800 / image.width
        image = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
    gray = ImageOps.grayscale(image)
    gray = ImageOps.autocontrast(gray)
    if mode == "threshold":
        gray = gray.point(lambda value: 0 if value < 160 else 255)
    elif mode == "adaptive":
        gray = adaptive(gray)
    image = deskew(gray.convert("RGB"))
    return image


def adaptive(image):
    width, height = image.size
    source = image.load()
    output = Image.new("L", image.size, 255)
    target = output.load()
    radius = 14
    for y in range(0, height, 2):
        for x in range(0, width, 2):
            total = 0
            count = 0
            for yy in range(max(0, y - radius), min(height, y + radius), 4):
                for xx in range(max(0, x - radius), min(width, x + radius), 4):
                    total += source[xx, yy]
                    count += 1
            value = 0 if source[x, y] < total / count - 10 else 255
            target[x, y] = value
            if x + 1 < width:
                target[x + 1, y] = value
            if y + 1 < height:
                target[x, y + 1] = value
            if x + 1 < width and y + 1 < height:
                target[x + 1, y + 1] = value
    return output


def projection(image, angle):
    sample = image.convert("L").resize((160, 220))
    turned = sample.rotate(angle, expand=False, fillcolor=255, resample=Image.Resampling.BILINEAR)
    pixels = list(turned.getdata())
    width, height = turned.size
    rows = [sum(255 - pixels[y * width + x] for x in range(width)) for y in range(height)]
    mean = sum(rows) / len(rows)
    return sum((value - mean) ** 2 for value in rows)


def orient(image):
    best = max((0, 90, 180, 270), key=lambda angle: projection(image, angle))
    if best == 0:
        return image
    return image.rotate(best, expand=True, fillcolor="white")


def deskew(image):
    best = max(range(-5, 6), key=lambda angle: projection(image, angle))
    if best == 0:
        return image
    return image.rotate(best, expand=True, fillcolor="white", resample=Image.Resampling.BICUBIC)


def main():
    manifest = json.loads(Path(sys.argv[1]).read_text())
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    for invoice in manifest:
        effect = EFFECTS.get(invoice["id"])
        if not effect:
            continue
        rendered = [render_page(page) for page in pages_of(invoice["ops"])]
        for index, page in enumerate(rendered, start=1):
            suffix = f"-p{index}" if len(rendered) > 1 else ""
            page.save(output / f"{invoice['id']}{suffix}-clean.png", optimize=True)
            scan = ImageOps.grayscale(page).convert("RGB")
            scan.save(output / f"{invoice['id']}{suffix}-scan.png", optimize=True)
            photo = apply_effect(page, effect)
            photo.save(output / f"{invoice['id']}{suffix}-photo.jpg", quality=55, optimize=True)
            prepare(page, "contrast").save(output / f"{invoice['id']}{suffix}-prep-contrast.png", optimize=True)
            prepare(photo, "contrast").save(output / f"{invoice['id']}{suffix}-photo-prep-contrast.png", optimize=True)
            prepare(photo, "threshold").save(output / f"{invoice['id']}{suffix}-photo-prep-threshold.png", optimize=True)


if __name__ == "__main__":
    main()
