#!/usr/bin/env python3
"""Build Chrome, Firefox and standalone screenshot analysis JS from one source.

Usage: python3 build.py [chrome] [firefox] [library]
No third-party Python dependencies.
"""
import json
from pathlib import Path
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
ASSETS = ('_locales', 'i18n_styles', 'images')
EXCLUDE = {'background.js', 'background.html', 'background-image-analysis.js'}
WORKER = ROOT / 'shared' / 'contrast-worker.js'
RENDERER = ROOT / 'shared' / 'contrast-renderer.js'


def archive(folder, name):
    dest = DIST / name
    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
        for file in sorted(folder.rglob('*')):
            if file.is_file():
                z.write(file, file.relative_to(folder))
    print(f'ZIP: {dest}')


def build_extension(browser):
    manifest = json.loads((ROOT / 'manifests' / f'{browser}.json').read_text())
    out = DIST / browser
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for file in ROOT.iterdir():
        if file.is_file() and file.suffix in ('.js', '.html', '.css') and file.name not in EXCLUDE:
            shutil.copy2(file, out / file.name)
    for folder in ASSETS:
        shutil.copytree(ROOT / folder, out / folder)
    # Keep the historical worker name used by image_analysis.js while using one
    # canonical source file also used by the website library.
    shutil.copy2(WORKER, out / 'background-image-analysis.js')
    shutil.copy2(RENDERER, out / 'contrast-renderer.js')
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    archive(out, f'color-contrast-{browser}.zip')
    print(f'{browser}: {out}')


def build_library():
    out = DIST / 'library'
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    # Bundle the pure renderer and the browser API into one page-side script;
    # the analysis worker must remain a separate JS resource.
    combined = (RENDERER.read_text() + '\n\n' +
                (ROOT / 'library' / 'contrast-analyzer.js').read_text())
    (out / 'contrast-analyzer.js').write_text(combined)
    shutil.copy2(WORKER, out / 'contrast-worker.js')
    for name in ('demo.html', 'demo.css', 'demo.js'):
        shutil.copy2(ROOT / 'library' / name, out / name)
    shutil.copy2(ROOT / 'license.txt', out / 'license.txt')
    archive(out, 'color-contrast-library.zip')
    print(f'library: {out}')


def main():
    targets = sys.argv[1:] or ['chrome', 'firefox', 'library']
    for target in targets:
        if target in ('chrome', 'firefox'):
            build_extension(target)
        elif target == 'library':
            build_library()
        else:
            raise SystemExit(f'Unknown target: {target} (choose chrome, firefox, library)')

if __name__ == '__main__':
    main()
