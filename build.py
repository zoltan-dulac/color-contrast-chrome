#!/usr/bin/env python3
"""Build Chrome and Firefox from the shared extension source. No dependencies."""
import json
from pathlib import Path
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
ASSETS = ['_locales', 'i18n_styles', 'images']
EXCLUDE = {'background.js', 'background.html'}

def build(browser):
    if browser not in ('chrome', 'firefox'):
        raise ValueError(browser)
    manifest_path = ROOT / 'manifests' / f'{browser}.json'
    manifest = json.loads(manifest_path.read_text())
    out = ROOT / 'dist' / browser
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for item in ROOT.iterdir():
        if item.is_file() and item.suffix in ('.js', '.html', '.css') and item.name not in EXCLUDE:
            shutil.copy2(item, out / item.name)
    for folder in ASSETS:
        shutil.copytree(ROOT / folder, out / folder)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    archive = ROOT / 'dist' / f'color-contrast-{browser}.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(out.rglob('*')):
            if file.is_file():
                z.write(file,file.relative_to(out))
    print(f'{browser}: {out} | {archive}')

if __name__ == '__main__':
    for browser in sys.argv[1:] or ['chrome','firefox']:
        build(browser)
