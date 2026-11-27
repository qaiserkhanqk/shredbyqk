#!/usr/bin/env python3
"""Download openly licensed desi food photos from Wikimedia Commons for the photo test.
Usage: python3 tools/fetch-test-photos.py [out_dir]   (default: test-photos/, which git ignores)
Writes out_dir/manifest.json: file, expected dish id, Commons category, title, licence, source page.
Commons asks automated clients to identify themselves and go slowly; this waits ~1 s between files."""
import json, time, urllib.request, urllib.parse, os, sys, re
UA = 'ShredFoodTest/1.0 (food photo recognition test; contact via repository)'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'test-photos'
os.makedirs(OUT, exist_ok=True)
# Commons category → the catalogue dish id it should be recognised as
CATS = {
 'Biryani': 'chicken_biryani', 'Nihari': 'nihari', 'Haleem': 'haleem', 'Karahi': 'chicken_karahi',
 'Naan': 'naan', 'Paratha': 'paratha', 'Chapati': 'roti', 'Puri (food)': 'puri', 'Samosas': 'samosa',
 'Pakora': 'pakora', 'Chapli kebab': 'chapli_kebab', 'Seekh kebab': 'seekh_kebab', 'Gulab jamun': 'gulab_jamun',
 'Jalebi': 'jalebi', 'Lassi': 'sweet_lassi', 'Masala chai': 'chai', 'Chana masala': 'cholay', 'Aloo gobi': 'aloo_gobi',
 'Palak paneer': 'palak_paneer', 'Kheer': 'kheer', 'Dal': 'daal_masoor', 'Butter chicken': 'butter_chicken',
 'Tandoori chicken': 'chicken_tikka', 'Gol gappa': 'gol_gappay', 'Raita': 'raita', 'Rasmalai': 'ras_malai', 'Shami kebab': 'shami_kebab',
}
def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return r.read()
        except Exception as e:
            if '429' in str(e): time.sleep(5 * (i + 1)); continue
            raise
    raise RuntimeError('rate limited')
manifest = []
for cat, dish in CATS.items():
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'categorymembers', 'gcmtitle': 'Category:' + cat, 'gcmtype': 'file', 'gcmlimit': 25,
        'prop': 'imageinfo', 'iiprop': 'url|mime|extmetadata', 'iiurlwidth': 768})
    try: data = json.loads(get('https://commons.wikimedia.org/w/api.php?' + q))
    except Exception as e: print('skip', cat, e); continue
    pages = sorted((data.get('query') or {}).get('pages', {}).values(), key=lambda p: p['title'])
    n = 0
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        if ii.get('mime') not in ('image/jpeg', 'image/png') or not ii.get('thumburl'): continue
        meta = ii.get('extmetadata', {})
        lic = meta.get('LicenseShortName', {}).get('value', '?')
        fn = f"{dish}__{n}.jpg"
        try: open(os.path.join(OUT, fn), 'wb').write(get(ii['thumburl']))
        except Exception as e: print('img fail', e); continue
        manifest.append({'file': fn, 'expect': dish, 'category': cat, 'title': p['title'], 'license': lic, 'source': ii.get('descriptionurl')})
        n += 1; time.sleep(1)
        if n >= 3: break
    print(cat, n, flush=True); time.sleep(1)
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('total', len(manifest))
