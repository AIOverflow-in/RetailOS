"""Export each .ab artboard in sellos-fb-ads.html to a 1080x1350 PNG via headless Chrome.

Re-run after any copy or design change:  python3 docs/marketing/export-ads.py
"""
import io, os, re, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "sellos-fb-ads.html")
OUT = os.path.join(HERE, "ads")
TMP = tempfile.mkdtemp(prefix="sellos-ads-")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

src = io.open(SRC, encoding="utf-8").read()
style = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
fonts = re.search(r'<link href="https://fonts\.googleapis\.com[^"]*" rel="stylesheet">', src).group(0)


def block(text, start):
    """Return the substring of one balanced <div>...</div> beginning at `start`."""
    depth, i = 0, start
    for m in re.finditer(r"<div\b|</div>", text[start:]):
        depth += 1 if m.group(0) == "<div" else -1
        i = start + m.end()
        if depth == 0:
            return text[start:i]
    raise ValueError("unbalanced div")


os.makedirs(OUT, exist_ok=True)
boards = [m.start() for m in re.finditer(r'<div class="ab(?: [^"]*)?">', src)]
assert boards, "no artboards found"

# Concepts get added and renamed; drop last run's output so renames leave no orphans.
for f in os.listdir(OUT):
    if f.endswith(".png"):
        os.remove(os.path.join(OUT, f))

for n, pos in enumerate(boards, 1):
    ab = block(src, pos)
    cap = re.search(r'<span class="ab-cap">(.*?)</span>', src[pos + len(ab):], re.S).group(1)
    concept, lang = [t.strip() for t in cap.split("—")[0].split("·")][:2]
    hook = re.sub(r"[^a-z0-9]+", "-", cap.split("—")[1].split("·")[0].strip().lower()).strip("-")
    name = f"{n:02d}-{concept}{lang}-{hook}".lower()

    html = (
        f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">{fonts}'
        f"<style>{style}</style>"
        "<style>html,body{margin:0;padding:0;background:#fff}"
        ":root{--ab-scale:1}</style></head><body>" + ab + "</body></html>"
    )
    page = os.path.join(TMP, name + ".html")
    io.open(page, "w", encoding="utf-8").write(html)

    png = os.path.join(OUT, name + ".png")
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--window-size=1080,1350",
        "--virtual-time-budget=15000", f"--screenshot={png}", "file://" + page,
    ], check=True, capture_output=True)
    print(f"{name}.png  <-  {cap}")
