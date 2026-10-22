"""Erzeugt die App-Icons (PNG) ohne Fremdbibliotheken.

Aufruf:  py tools/make_icons.py
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
TOP = (108, 140, 255)  # --accent
BOTTOM = (47, 211, 160)  # --accent2
WHITE = (255, 255, 255)


def png(path: Path, size: int, pixels: bytearray) -> None:
    raw = b"".join(b"\x00" + bytes(pixels[y * size * 3:(y + 1) * size * 3]) for y in range(size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(data)


def rrect(x, y, cx, cy, w, h, r):
    """Liegt (x, y) im abgerundeten Rechteck (Mittelpunkt cx, cy)?"""
    dx = max(abs(x - cx) - (w / 2 - r), 0)
    dy = max(abs(y - cy) - (h / 2 - r), 0)
    return dx * dx + dy * dy <= r * r


def dumbbell(u, v, scale):
    """Hantel in Einheitskoordinaten (0..1), scale < 1 verkleinert (Safe Zone bei maskable)."""
    u = (u - 0.5) / scale + 0.5
    v = (v - 0.5) / scale + 0.5
    return (
        rrect(u, v, 0.5, 0.5, 0.44, 0.07, 0.03)  # Stange
        or rrect(u, v, 0.27, 0.5, 0.075, 0.38, 0.035)  # innere Scheiben
        or rrect(u, v, 0.73, 0.5, 0.075, 0.38, 0.035)
        or rrect(u, v, 0.175, 0.5, 0.06, 0.26, 0.03)  # äußere Scheiben
        or rrect(u, v, 0.825, 0.5, 0.06, 0.26, 0.03)
    )


def render(size: int, scale: float) -> bytearray:
    ss = 3  # Supersampling für glatte Kanten
    px = bytearray(size * size * 3)
    for y in range(size):
        t = y / (size - 1)
        bg = [round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)]
        for x in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    if dumbbell((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, scale):
                        hits += 1
            a = hits / (ss * ss)
            o = (y * size + x) * 3
            for i in range(3):
                px[o + i] = round(bg[i] * (1 - a) + WHITE[i] * a)
    return px


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name, size, scale in [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("icon-maskable-512.png", 512, 0.78),
        ("apple-touch-icon.png", 180, 0.92),
    ]:
        png(OUT / name, size, render(size, scale))
        print("geschrieben:", OUT / name)


if __name__ == "__main__":
    main()
