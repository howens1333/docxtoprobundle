import json
from pathlib import Path
import sys
import tempfile
import unittest

MODULES = tempfile.TemporaryDirectory()
source = (Path(__file__).resolve().parents[1] / 'index.html').read_text()
modules, _ = json.JSONDecoder().raw_decode(source.split('const PY_SOURCES = ', 1)[1])
for name, text in modules.items():
    Path(MODULES.name, name).write_text(text)
sys.path.insert(0, MODULES.name)
import slide_router as router
import docx


class PastedOutlineTests(unittest.TestCase):
    def test_cumulative_build_and_next_marker(self):
        slides = router.parse_text('**SLIDE BUILD:**\nFirst line\nSecond line\nThird line\n\n**SLIDE**: Next point')
        self.assertEqual([s.body for s in slides], ['First line', 'First line\nSecond line', 'First line\nSecond line\nThird line', 'Next point'])

    def test_trailing_references_and_verse_numbers(self):
        slides = router.parse_text('**SLIDE:&#xA0;**16 Verse text. (Romans 6:16).\n**SLIDE:8** More verse text. (Ephesians 2:8-10)\n**SLIDE:** “Good works.” (Ephesians 2:10, NRSV).')
        self.assertEqual([s.kind for s in slides], ['scripture'] * 3)
        self.assertEqual([s.reference for s in slides], ['Romans 6:16', 'Ephesians 2:8-10', 'Ephesians 2:10, NRSV'])
        self.assertEqual(slides[0].body, '16 Verse text.')
        self.assertEqual(slides[1].body, '8 More verse text.')

    def test_quotes_remain_points(self):
        slide = router.parse_text('SLIDE: “A quotation about rescue.” - Speaker')[0]
        self.assertEqual(slide.kind, 'point')
        self.assertIn('- Speaker', slide.body)

    def test_reference_first_format_still_works(self):
        slide = router.parse_text('Slide 1 - Romans 6:16 (NIV)\nVerse text.')[0]
        self.assertEqual((slide.kind, slide.reference, slide.body), ('scripture', 'Romans 6:16 (NIV)', 'Verse text.'))

    def test_docx_and_paste_match(self):
        text = 'SLIDE BUILD:\nOne\nTwo\nSLIDE: Text (Romans 6:16).'
        with tempfile.TemporaryDirectory() as directory:
            document = docx.Document()
            for line in text.splitlines():
                document.add_paragraph(line)
            file = Path(directory, 'outline.docx')
            document.save(file)
            self.assertEqual(router.parse_text(text), router.parse_slides(str(file)))

    def test_empty_outline_reports_error(self):
        with self.assertRaisesRegex(ValueError, 'found no'):
            router.parse_text('   ')

if __name__ == '__main__':
    unittest.main()
