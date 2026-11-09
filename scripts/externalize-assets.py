"""Move embedded image bytes into cacheable, content-addressed local files.

Run after the maintained sources have been assembled:
  python3 scripts/externalize-assets.py --write
  python3 scripts/externalize-assets.py --check

--extract-only writes assets and prints the size comparison without changing
the HTML or JavaScript. Additional maintained JS files can be given with
--script. No image is recompressed, resized, or otherwise changed.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
IMAGE = re.compile(r"data:image/(webp|png|jpeg|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)")
SCRIPT = re.compile(r'(<script\b[^>]*\bsrc=[\"\'])data:application/javascript;base64,([A-Za-z0-9+/=]+)([\"\'][^>]*>)')
REFERENCE = re.compile(r"assets/art/([a-f0-9]{20})\.(webp|png|jpg|gif|svg)")
EXTENSION = {"svg+xml": "svg", "jpeg": "jpg"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def externalize(text: str, root: Path, records: dict) -> tuple[str, int]:
    """Read the current source, including images nested in executable data URIs."""
    count = 0

    def image(match):
        nonlocal count
        mime, encoded = match.groups()
        data = base64.b64decode(encoded, validate=True)
        sha = digest(data)
        path = f"assets/art/{sha[:20]}.{EXTENSION.get(mime, mime)}"
        target = root / path
        if target.exists():
            if target.read_bytes() != data:
                raise ValueError(f"Content-addressed asset collision: {path}")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        records[path] = {"path": path, "mime": "image/" + mime,
                         "bytes": len(data), "sha256": sha}
        count += 1
        return path

    def script(match):
        nonlocal count
        decoded = base64.b64decode(match[2], validate=True).decode("utf-8")
        updated, nested = externalize(decoded, root, records)
        count += nested
        if updated == decoded:
            return match[0]
        return match[1] + "data:application/javascript;base64," + base64.b64encode(updated.encode()).decode() + match[3]

    text = SCRIPT.sub(script, text)
    return IMAGE.sub(image, text), count


def referenced_assets(text: str) -> set[str]:
    paths = {match[0] for match in REFERENCE.finditer(text)}
    for match in SCRIPT.finditer(text):
        paths.update(referenced_assets(base64.b64decode(match[2], validate=True).decode("utf-8")))
    return paths


def check_sources(sources: dict[Path, str], root: Path) -> int:
    checked = set()
    for source, text in sources.items():
        if IMAGE.search(text):
            raise ValueError(f"Embedded image remains in {source}")
        for match in SCRIPT.finditer(text):
            if IMAGE.search(base64.b64decode(match[2], validate=True).decode("utf-8")):
                raise ValueError(f"Nested embedded image remains in {source}")
        for path in referenced_assets(text):
            data = (root / path).read_bytes()
            if digest(data)[:20] != Path(path).stem:
                raise ValueError(f"Asset hash does not match filename: {path}")
            checked.add(path)
    for name in ("sol-intro.webp", "sol-results.webp"):
        data = (root / "assets" / name).read_bytes()
        if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            raise ValueError(f"Missing or invalid exam illustration: {name}")
    return len(checked)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--extract-only", action="store_true")
    mode.add_argument("--check", action="store_true")
    parser.add_argument("--html", type=Path, default=ROOT / "index.html")
    parser.add_argument("--script", type=Path, action="append", default=[])
    args = parser.parse_args()
    sources = {path: path.read_text() for path in [args.html, *args.script]}
    if args.check:
        count = check_sources(sources, ROOT)
        print(f"Verified {count} content-addressed images and both SOL illustrations.")
        return
    manifest = ROOT / "assets" / "manifest.json"
    existing = json.loads(manifest.read_text()) if manifest.exists() else {"images": []}
    records = {entry["path"]: entry for entry in existing["images"]}
    for path, text in sources.items():
        updated, count = externalize(text, ROOT, records)
        before, after = text.encode(), updated.encode()
        if args.write and before != after:
            path.write_bytes(after)
        print(json.dumps({"source": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
                          "imageOccurrencesExtracted": count,
                          "beforeBytes": len(before), "afterBytes": len(after),
                          "beforeGzipBytes": len(gzip.compress(before, mtime=0)),
                          "afterGzipBytes": len(gzip.compress(after, mtime=0)),
                          "sourceWritten": bool(args.write and before != after)}))
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps({"version": 1, "images": sorted(records.values(), key=lambda r: r["path"])}, indent=2) + "\n")


if __name__ == "__main__":
    main()
