"""Inline maintained enhancement sources into the standalone site, idempotently."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
page = ROOT / "index.html"
html = page.read_text()

def put(name, value, anchor, before=True, javascript=False):
    global html
    start = f"/* VA:{name}:START */" if javascript else f"<!-- VA:{name}:START -->"
    end = f"/* VA:{name}:END */" if javascript else f"<!-- VA:{name}:END -->"
    block = f"{start}\n{value}\n{end}"
    pattern = re.escape(start) + r"[\s\S]*?" + re.escape(end)
    if re.search(pattern, html):
        html = re.sub(pattern, lambda m: block, html)
    else:
        pos = html.rfind(anchor) if anchor == '</body>' else html.find(anchor)
        assert pos >= 0, (name, anchor)
        if not before:
            pos += len(anchor)
        html = html[:pos] + block + "\n" + html[pos:]

config = ROOT / "enhancements" / "account-config.js"
put("choice-order", '<script>\n' + (ROOT / "enhancements/choice-order.js").read_text() + '\n</script>', '</head>')
if config.exists():
    put("account-config", '<script>\n' + config.read_text() + '\n</script>', '</head>')
for name in ["design", "accounts"]:
    path = ROOT / "enhancements" / f"{name}.css"
    if path.exists():
        put(name + "-css", '<style>\n' + path.read_text() + '\n</style>', '</head>')
for name in ["maintenance", "flash-stats", "accounts"]:
    path = ROOT / "enhancements" / f"{name}.js"
    if path.exists():
        put(name + "-js", '<script>\n' + path.read_text() + '\n</script>', '</body>')
path = ROOT / "content" / "corrections.inline.js"
if path.exists():
    put("corrections", path.read_text(), '/* VA:content:START */' if '/* VA:content:START */' in html else 'var VIDEOS =', javascript=True)
path = ROOT / "content" / "enrichment.inline.js"
if path.exists():
    put("content", path.read_text(), 'var VIDEOS =', javascript=True)
    reasons = ROOT / "content" / "wrong-reasons.inline.js"
    declaration = re.search(r'^var VA_WRONG = [^\n]+', html, re.M)
    assert declaration, 'Wrong-answer rationale bank was not found'
    put("wrong-reasons", reasons.read_text(), declaration.group(), before=False, javascript=True)
    html = html.replace('<b>511</b>', '<b id="vaQuestionTotal">559</b>')
page.write_text(html)
print(f"Assembled {page.name}: {page.stat().st_size:,} bytes")
