# Published illustration assets

These files are extracted byte-for-byte from the site's existing embedded
illustrations. No art has been recompressed, generated, or resized.

`art/` filenames contain the first 20 hexadecimal characters of each image's
SHA-256. A changed image gets a different URL; unchanged images can be reused
by the browser cache even when the main page changes. `manifest.json` records
the full digest, type, and byte size. Duplicate embedded images share one file.

`sol-intro.webp` reuses the existing `EMPTY_ILL["nothing-due"]` tidy desk
illustration (800 × 600). `sol-results.webp` reuses the existing
`CELEB_ILL["review-complete"]` sprout and blank cards illustration (768 × 768).
Their English and Chinese descriptions must describe those images, not the
missing historical banners. They are decorative learning illustrations and do
not convey a score, pass/fail status, or answer.

After assembling maintained sources:

```sh
python3 scripts/externalize-assets.py --write
python3 scripts/externalize-assets.py --check
python3 -m unittest discover -s scripts/tests -p 'test_assets.py'
```

The extractor reads the current file at invocation time. `--extract-only`
writes the image files and reports potential size savings without changing
the HTML. Optional repeated `--script path/to/source.js` arguments process
additional maintained JavaScript sources. Images nested in executable base64
script URLs are handled as well. Re-running extraction without new inline art
does not change the page or its asset URLs.

Publish this entire `assets/` directory alongside `index.html`. The existing
local preview server serves it without configuration changes. Image-loading
and answer-reveal timing remain controlled by the existing renderers.
