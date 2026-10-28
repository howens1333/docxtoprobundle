"""Synthetic end-to-end conversion: contains no user sermon or artwork."""
import uuid
import docx
import lxml.etree
import protobuf_tree as pt
import probundle_io as pio
import slide_router as sr


def text(number, value):
    return pt.Field(number, pt.WIRE_LEN, value.encode() if isinstance(value, str) else value)


def message(number, *children):
    return pt.Field(number, pt.WIRE_LEN, b'', list(children))


def identifier(number=1):
    return message(number, text(1, str(uuid.uuid4()).upper()))


def cue(macro, scripture=False):
    fields = [identifier(), text(2, macro), text(99, rb'{\rtf1\ansi\pard\partightenfactor0 Template body text}')]
    if scripture:
        fields.append(text(99, rb'{\rtf1\ansi\pard\partightenfactor0 Reference}'))
    fields.append(message(10, identifier(), message(40, message(1, identifier(), text(2, macro), message(3, identifier(), text(2, 'MAIN MACROS'))))))
    return message(13, *fields)


cues = [cue('Sermon Hero'), cue('Sermon Scripture', True), cue('Sermon Point')]
group = message(12, message(1, identifier(), text(4, b'')),
                *[message(2, text(1, sr._cue_uuid(c))) for c in cues])
root = [identifier(2), text(3, 'Template'), group, *cues]
pio.write_probundle(pio.ProBundle({'Template.pro': pt.serialize(root)}), '/smoke-template.probundle')
document = docx.Document()
document.add_paragraph('Slide 1 - Romans 12:1 (NIV)')
document.add_paragraph('This is an offline conversion test.')
document.add_paragraph('Slide 2 - Offline point test')
document.save('/smoke-input.docx')
result = sr.convert_template('/smoke-input.docx', '/smoke-template.probundle', '/smoke-output.probundle', new_title='Offline Smoke Test')
assert result['num_slides'] == 3, result
bundle = pio.read_probundle('/smoke-output.probundle')
assert bundle.pro_name() == 'Offline Smoke Test.pro'
assert b'Offline point test' in bundle.pro_bytes()
assert pt.find_path(pt.parse(bundle.pro_bytes()), 2, 1).raw != pt.find_path(root, 2, 1).raw
'3 slides converted offline; DOCX, lxml and bundle validation passed'
