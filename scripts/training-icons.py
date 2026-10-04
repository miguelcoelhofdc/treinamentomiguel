"""Render the project's original journey icon at the iOS and PWA sizes."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'public'
scale = 4
image = Image.new('RGB', (512 * scale, 512 * scale), '#68D52A')
draw = ImageDraw.Draw(image)
points = [(160, 374), (300, 285), (211, 194), (300, 114)]
coords = [(x * scale, y * scale) for x, y in points]
draw.line(coords, fill='white', width=28 * scale, joint='curve')
for x, y in points[:-1]:
    draw.ellipse(((x - 27) * scale, (y - 27) * scale, (x + 27) * scale, (y + 27) * scale), fill='white')
draw.ellipse((258 * scale, 72 * scale, 342 * scale, 156 * scale), fill='#214B31')
draw.line([(281 * scale, 114 * scale), (295 * scale, 128 * scale), (321 * scale, 100 * scale)], fill='white', width=10 * scale, joint='curve')
for size, name in [(180, 'apple-touch-icon.png'), (192, 'pwa-192.png'), (512, 'pwa-512.png')]:
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / name)
