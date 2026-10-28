"""Run with: python -m unittest discover -s tests (requires python-docx)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'index.html'
TMP = tempfile.TemporaryDirectory()
text = SOURCE.read_text()
modules, _ = json.JSONDecoder().raw_decode(text.split('const PY_SOURCES = ', 1)[1])
for name, source in modules.items():
    Path(TMP.name, name).write_text(source)
sys.path.insert(0, TMP.name)
import protobuf_tree as pt
import probundle_io as pio
import docx_to_probundle as d2p
import media_builder as mb

class ConverterTests(unittest.TestCase):
    def test_repeated_uuid_references_stay_equal(self):
        old = b'11111111-1111-1111-1111-111111111111'
        fields = [pt.Field(1, 2, old), pt.Field(2, 2, old)]
        d2p.regenerate_uuids(fields)
        self.assertEqual(fields[0].raw, fields[1].raw)
        self.assertNotEqual(fields[0].raw, old)

    def test_new_presentation_identity_and_internal_filename(self):
        def make_root():
            return [pt.Field(2, 2, b'', [pt.Field(1, 2, b'11111111-1111-1111-1111-111111111111')]),
                    pt.Field(3, 2, b'Sermon')]
        root = make_root()
        bundle = pio.ProBundle({'Sermon.pro': b'original'})
        d2p.assign_presentation_identity(root, bundle, 'Sermon - 2026-11-01')
        self.assertEqual(pt.find_path(root, 3).text(), 'Sermon - 2026-11-01')
        self.assertEqual(bundle.pro_name(), 'Sermon - 2026-11-01.pro')
        second = make_root()
        d2p.assign_presentation_identity(second, pio.ProBundle({'Sermon.pro': b''}), 'Sermon - 2026-11-01')
        self.assertNotEqual(pt.find_path(root, 2, 1).raw, pt.find_path(second, 2, 1).raw)

    def test_external_onedrive_media_is_relocated_consistently(self):
        cue = pt.Field(13, 2, b'', [pt.Field(1, 2, b'file:///Users/test/Library/CloudStorage/OneDrive/Old%20Image.jpg'),
                                 pt.Field(2, 2, b'Library/CloudStorage/OneDrive/Old Image.jpg'),
                                 pt.Field(3, 2, b'Old Image.jpg')])
        self.assertEqual(mb.find_background_filenames(cue.children), {b'Old Image.jpg'})
        mb.swap_background_image(cue, 'NEW.jpg', '/Users/test/Media/Assets/NEW.jpg')
        self.assertEqual([f.raw for f in cue.children], [b'file:///Users/test/Media/Assets/NEW.jpg',
                         b'Media/Assets/NEW.jpg', b'NEW.jpg'])

if __name__ == '__main__':
    unittest.main()
