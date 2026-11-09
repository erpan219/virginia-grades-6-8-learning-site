"""Asset integrity tests; do not mutate the published HTML."""
import base64
import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "externalize-assets.py"
SPEC = importlib.util.spec_from_file_location("externalize_assets", SCRIPT)
assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assets)


class AssetExtractionTests(unittest.TestCase):
    def test_duplicate_references_preserve_exact_bytes_and_are_idempotent(self):
        data = b"<svg xmlns='http://www.w3.org/2000/svg'><title>Diagram</title></svg>"
        uri = "data:image/svg+xml;base64," + base64.b64encode(data).decode()
        source = '<img alt="Diagram" src="' + uri + '"><script>var answerArt="' + uri + '";</script>'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            records = {}
            updated, count = assets.externalize(source, root, records)
            self.assertEqual(count, 2)
            self.assertEqual(len(records), 1)
            path = next(iter(records))
            self.assertEqual((root / path).read_bytes(), data)
            self.assertEqual(updated.count(path), 2)
            self.assertIn('alt="Diagram"', updated)
            self.assertEqual(assets.externalize(updated, root, records), (updated, 0))

    def test_images_nested_in_encoded_scripts_are_extracted_without_other_code_changes(self):
        data = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
        uri = "data:image/svg+xml;base64," + base64.b64encode(data).decode()
        script = 'var label="答案";var art="' + uri + '";'
        encoded = base64.b64encode(script.encode()).decode()
        source = '<script src="data:application/javascript;base64,' + encoded + '"></script>'
        with tempfile.TemporaryDirectory() as temporary:
            records = {}
            root = Path(temporary)
            updated, count = assets.externalize(source, root, records)
            self.assertEqual(count, 1)
            path = next(iter(records))
            actual = base64.b64decode(assets.SCRIPT.search(updated)[2]).decode()
            self.assertEqual(actual, script.replace(uri, path))
            self.assertEqual(assets.referenced_assets(updated), {path})
            self.assertEqual(assets.externalize(updated, root, records), (updated, 0))

    def test_corrupt_content_addressed_file_is_rejected(self):
        data = b"<svg/>"
        uri = "data:image/svg+xml;base64," + base64.b64encode(data).decode()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            records = {}
            assets.externalize(uri, root, records)
            (root / next(iter(records))).write_bytes(b"different")
            with self.assertRaisesRegex(ValueError, "collision"):
                assets.externalize(uri, root, records)


if __name__ == "__main__":
    unittest.main()
