# Writes the logo SVGs into icons/ (the app icon, the maskable icon and the mark alone). Usage: python3 tools/build-icons.py
import os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons') + os.sep
DEFS = '''<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B8C7B"/><stop offset=".55" stop-color="#2A6A5E"/><stop offset="1" stop-color="#163C35"/></linearGradient><linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3C48E"/><stop offset="1" stop-color="#D99A5B"/></linearGradient></defs>'''
# The mark: one stroke (the S of motion) and a rising sun. Optically centred: the sun pulls weight right, so the S sits a little left.
def mark(ink='#F2F4EF', scale=1.1, dx=-12):
    return (f'<g transform="translate({256 + dx} 256) scale({scale}) translate(-256 -256)">'
            f'<path d="M303 146 A70 70 0 1 0 256 256 A70 70 0 1 1 209 366" fill="none" stroke="{ink}" stroke-width="50" stroke-linecap="round"/>'
            '<circle cx="364" cy="128" r="27" fill="url(#sun)"/></g>')
head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
files = {
    # Rounded tile: favicon, browser tabs, shortcuts.
    'icon.svg': f'{head}{DEFS}<rect width="512" height="512" rx="112" fill="url(#bg)"/>{mark()}</svg>',
    # Full-bleed: Android adaptive / maskable (the OS cuts its own shape; the mark stays inside the 80% safe zone).
    'icon-maskable.svg': f'{head}{DEFS}<rect width="512" height="512" fill="url(#bg)"/>{mark(scale=0.94, dx=-10)}</svg>',
    # The mark alone in eucalyptus, for light backgrounds (header, documents).
    'mark.svg': f'{head}{DEFS}{mark(ink="#2F7568", scale=1.3, dx=-14)}</svg>',
    # The mark alone in ivory, for dark backgrounds.
    'mark-light.svg': f'{head}{DEFS}{mark(scale=1.3, dx=-14)}</svg>',
}
for name, svg in files.items():
    open(root + name, 'w').write(svg + '\n')
print('icons written; now run: node tools/render-icons.cjs')
