# Sermon Slide Converter

Open index.html in a browser with internet access (Pyodide and python-docx load on first conversion).

1. Export the current series' sermon presentation from ProPresenter as a .probundle.
2. Choose it under Current series template, or drag it in with the source files. The template saves automatically in this browser and loads on future visits. Use Replace series template when the series changes.
3. Set the presentation date. Leave the optional title blank for Sermon - YYYY-MM-DD.
4. Add the Word outline, optional images, and an optional bumper video.
5. Convert, download, and import the bundle into ProPresenter. Confirm that it remains in the library after navigating away.

Choose the template once per browser/device. Templates are stored as blobs in IndexedDB rather than localStorage, so large media bundles can be saved. Clearing site data or using a different browser requires selecting the template again. The status reports save failures; the selected file remains usable for that visit even if storage is unavailable. Removing the template in settings also deletes its saved copy.

The template needs example slides with the Sermon Hero, Sermon Scripture, and Sermon Point macros. Uploaded image slides require an example with the Image macro. An uploaded video requires a video example. Each conversion gets a fresh presentation UUID, even when the date/title is reused.

Backgrounds, text layout, and macro references come from the selected export. The converter preserves the last one or two closing media slides in displayed order. It does not connect to live ProPresenter cloud themes or retrieve Bible text. Refresh the template when series artwork or styling changes. Macro references require the corresponding macros in the destination workspace.

The optional video reuses its template's playback configuration; check duration, trim and playback settings when substituting a different video.

## Checks

Install python-docx, then run:

```sh
python -m unittest discover -s tests
node --test tests/test_template_storage.cjs
```

Unit tests cover presentation identity, consistent UUID remapping, and external media relocation. Local validation additionally used a current ProPresenter export and Word outline to check cue ordering, macro identity, gold asset bytes, distinct closing graphics, embedded video, and ZIP/protobuf integrity. An actual ProPresenter import/persistence test remains necessary.
