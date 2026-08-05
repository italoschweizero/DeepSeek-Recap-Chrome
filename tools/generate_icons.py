#!/usr/bin/env python3
"""
Genera le icone dell'estensione DeepSeek Recap (PNG, senza dipendenze esterne).

Uso:  python3 tools/generate_icons.py
Output: icons/icon16.png, icon32.png, icon48.png, icon128.png
"""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "icons")
SIZES = [16, 32, 48, 128]

# Gradiente di sfondo (blu scuro) e colore del fulmine.
TOP = (109, 137, 255)
BOTTOM = (16, 35, 92)
BOLT = (255, 255, 255)


def write_png(path, w, h, pixels):
    raw = b""
    for row in pixels:
        raw += b"\x00"
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    dx = max(x0 + r - x, x - (x1 - r), 0)
    dy = max(y0 + r - y, y - (y1 - r), 0)
    return dx * dx + dy * dy <= r * r


def fill_polygon(pixels, w, h, pts, color):
    n = len(pts)
    min_y, max_y = int(min(p[1] for p in pts)), int(max(p[1] for p in pts))
    for y in range(max(0, min_y), min(h - 1, max_y) + 1):
        xs = []
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            if (y1 <= y < y2) or (y2 <= y < y1):
                t = (y - y1) / (y2 - y1)
                xs.append(x1 + t * (x2 - x1))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            xa, xb = int(xs[k]), int(xs[k + 1])
            for x in range(max(0, xa), min(w - 1, xb) + 1):
                pixels[y][x] = color


def bolt_points(size):
    # Forma di fulmine normalizzata in [0,1], scalata al canvas.
    pts = [
        (0.55, 0.08), (0.27, 0.56), (0.46, 0.56),
        (0.38, 0.92), (0.72, 0.42), (0.52, 0.42),
    ]
    return [(x * size, y * size) for x, y in pts]


def make_icon(size):
    w = h = size
    margin = size * 0.06
    radius = size * 0.22

    pixels = [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]

    # Sfondo: rettangolo arrotondato con gradiente verticale.
    for y in range(h):
        t = y / max(1, h - 1)
        color = lerp(TOP, BOTTOM, t)
        for x in range(w):
            if in_rounded_rect(x, y, margin, margin, w - 1 - margin, h - 1 - margin, radius):
                pixels[y][x] = color + (255,)

    # Fulmine bianco.
    fill_polygon(pixels, w, h, bolt_points(size), BOLT + (255,))
    return pixels


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, size, size, make_icon(size))
        print(f"Creata {path}")


if __name__ == "__main__":
    main()
