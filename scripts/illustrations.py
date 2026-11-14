# Illustrations des exercices : découpe les planches reçues (illustrations/recues/salveNN-imageK.png,
# grilles de 3 × 2 cases) en une image par exercice, dans l'ordre de illustrations/lots.json.
# Une case refaite seule (illustrations/retouches.json, « refaite ») remplace celle de la planche ;
# une case « à refaire » est laissée de côté. Sortie : public/exos/<id>-<empreinte>.webp (480 × 480)
# et src/training/illus-index.json (exercice → fichier).
#   python3 scripts/illustrations.py
import hashlib, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, 'illustrations/recues')
OUT = os.path.join(ROOT, 'public/exos')
SIZE, QUALITY = 480, 80
BG = (16, 15, 21)          # fond des planches (#100F15)

def runs(vals, th=10, maxw=14):
    out, s = [], None
    for i, a in enumerate(vals):
        if a < th and s is None: s = i
        if a >= th and s is not None:
            if i - s <= maxw: out.append((s, i - 1))
            s = None
    return out

def cells(path):
    """Les 6 cases d'une planche, ligne du haut puis ligne du bas, sans les traits de séparation."""
    im = Image.open(path).convert('RGB'); w, h = im.size
    g = im.convert('L'); px = g.load()
    cols = [sum(px[x, y] for y in range(0, h, 2)) / (h / 2) for x in range(w)]
    rows = [sum(px[x, y] for x in range(0, w, 2)) / (w / 2) for y in range(h)]
    cs = [r for r in runs(cols) if 100 < r[0] < w - 100]
    rs = [r for r in runs(rows) if 100 < r[0] < h - 100]
    if len(cs) != 2 or len(rs) != 1:
        # séparateurs introuvables : grille régulière
        cs = [(w // 3 - 2, w // 3 + 1), (2 * w // 3 - 2, 2 * w // 3 + 1)]; rs = [(h // 2 - 2, h // 2 + 1)]
    xs = [0] + [(a + b) // 2 for a, b in cs] + [w]
    ys = [0] + [(a + b) // 2 for a, b in rs] + [h]
    out = []
    for r in range(2):
        for c in range(3):
            out.append(im.crop((xs[c] + 6, ys[r] + 6, xs[c + 1] - 6, ys[r + 1] - 6)))
    return out

def square(cell):
    """Carré centré (côté = le plus petit des deux), au format final."""
    w, h = cell.size; s = min(w, h)
    sq = cell.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return sq.resize((SIZE, SIZE), Image.LANCZOS)

def single(path):
    """Case refaite seule (image carrée, personnage plus grand) : ramenée à l'échelle des planches."""
    im = Image.open(path).convert('RGB')
    s = min(im.size); im = im.crop(((im.size[0] - s) // 2, (im.size[1] - s) // 2, (im.size[0] - s) // 2 + s, (im.size[1] - s) // 2 + s))
    inner = round(SIZE * 0.9)
    # fond : médiane des pixels du bord (un coin peut tomber sur le matériel)
    w, h = im.size; border = [im.getpixel((x, y)) for x in range(0, w, 7) for y in (2, h - 3)] + [im.getpixel((x, y)) for y in range(0, h, 7) for x in (2, w - 3)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    can = Image.new('RGB', (SIZE, SIZE), bg)
    can.paste(im.resize((inner, inner), Image.LANCZOS), ((SIZE - inner) // 2, (SIZE - inner) // 2))
    return can

def main():
    lots = json.load(open(os.path.join(ROOT, 'illustrations/lots.json')))['lots']
    ret = {(c['salve'], c['n']): c for c in json.load(open(os.path.join(ROOT, 'illustrations/retouches.json')))['cases']}
    os.makedirs(OUT, exist_ok=True)
    index, skipped = {}, []
    for lot in lots:
        k, ids = lot['lot'], lot['ids']
        for part in lot['parts']:
            path = os.path.join(REC, 'salve%02d-image%d.png' % (k, part['image']))
            if not os.path.exists(path): continue
            for j, cell in enumerate(cells(path)):
                n = part['from'] + j
                if n > part['to']: break
                xid, r = ids[n - 1], ret.get((k, n))
                if r and r.get('etat') == 'refaite' and r.get('fichier'): img = single(os.path.join(REC, r['fichier']))
                elif r and r.get('etat') != 'refaite': skipped.append(xid); continue
                else: img = square(cell)
                buf = io.BytesIO(); img.save(buf, 'WEBP', quality=QUALITY, method=6)
                data = buf.getvalue(); name = '%s-%s.webp' % (xid, hashlib.sha256(data).hexdigest()[:8])
                with open(os.path.join(OUT, name), 'wb') as f: f.write(data)
                index[xid] = name
    for f in os.listdir(OUT):                      # anciennes versions : retirées
        if f.endswith('.webp') and f not in index.values(): os.remove(os.path.join(OUT, f))
    with open(os.path.join(ROOT, 'src/training/illus-index.json'), 'w') as f:
        json.dump(dict(sorted(index.items())), f, indent=1, ensure_ascii=False); f.write('\n')
    size = sum(os.path.getsize(os.path.join(OUT, v)) for v in index.values())
    print(len(index), 'illustrations,', round(size / 1024), 'Ko ; en attente :', ', '.join(skipped) or 'aucune')

if __name__ == '__main__':
    main()
