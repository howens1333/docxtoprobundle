# Sermon Converter for Mac

The Mac app includes Electron, Pyodide, lxml, python-docx and typing_extensions. Conversion runs entirely on the Mac with external network requests blocked. No Python installation, local server, Apple developer account or subscription is required to use it.

## Download and open

Download the Apple Silicon or Intel artifact from the latest successful **Build Mac App** run under this repository's Actions tab. Unzip the artifact, then unzip the included Sermon-Converter ZIP. Move **Sermon Converter.app** to Applications.

The builds have a local ad-hoc signature, not an Apple Developer ID signature or notarization. macOS may block the first launch. After trying to open the app, use **System Settings → Privacy & Security → Open Anyway** if macOS offers it for this app. Do not disable Gatekeeper globally.

Choose the current series template once in the app. It is stored separately from the website's browser data and remains available across app restarts. Replace it when the series changes. Choose the Word outline and any optional media, convert, then save the bundle using the native Save dialog.

The app does not read ProPresenter's cloud or automatically update itself. Installing a new build with the same app identity preserves its existing app data. The `.probundle` still needs a live ProPresenter import test before service use.

## Build from source

Use Node.js 24 and npm. Downloading dependencies during the build needs internet; the resulting app does not.

```
npm ci --ignore-scripts
npm run desktop:prepare
npm run desktop:verify
npm run desktop:build -- arm64
npm run desktop:build -- x64
```

`desktop:verify` blocks network access and performs a synthetic Word-to-bundle conversion with the bundled Python runtime. A macOS build also launches the packaged app with external networking blocked and repeats that conversion in Electron before producing a downloadable ZIP. Each architecture is built and tested on a matching GitHub macOS runner. `codesign` adds and verifies an ad-hoc signature without a certificate. The GitHub workflow publishes build artifacts for 30 days; the app's source and build recipe remain in the repository.

The web version is unchanged. Desktop preparation transforms a copy of `index.html` and downloads pinned runtime resources, verifying package checksums. Generated runtime assets, `node_modules`, and app distributions are excluded from source control. Python wheel licenses remain inside their bundled wheel files; Pyodide and Electron license files are included in the distribution.
