# Déclinaisons du logo GRIND à partir de l'image de référence (le cœur n'est ni redessiné ni recoloré :
# seuls les pixels quasi invisibles laissés par le détourage, hors du dessin, sont mis à zéro).
#   python3 -I brand.py <dossier de travail> <dossier du kit> <dossier assets app> <dossier icônes>
import sys, os, io, base64
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

WORK, KIT, APP, ICONS = sys.argv[1:5]
for d in (KIT, APP, ICONS): os.makedirs(d, exist_ok=True)

# ---------- 1. le cœur : nettoyage du bruit de détourage, recadrage ----------
ref = Image.open(os.path.join(WORK, 'ref.png')).convert('RGBA')
a = np.array(ref)
al = a[..., 3].astype(int)
lab, n = ndimage.label(al > 20)
sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
parts = np.isin(lab, [i + 1 for i in range(n) if sizes[i] > 100])     # les 5 rubans du dessin
keep = ndimage.binary_dilation(parts, iterations=8)                     # + leur bord antialiasé
a[~keep, 3] = 0
heart = Image.fromarray(a, 'RGBA')
heart = heart.crop(heart.getbbox())
print('cœur recadré', heart.size)
PAD = 0.04                                                               # marge de sécurité contre les rognures
hw, hh = heart.size
m = round(max(hw, hh) * PAD)
master = Image.new('RGBA', (hw + 2 * m, hh + 2 * m), (0, 0, 0, 0)); master.alpha_composite(heart, (m, m))
master.save(os.path.join(KIT, 'grind-coeur.png'), optimize=True)
def fit_w(im, w): return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
fit_w(master, 512).save(os.path.join(KIT, 'grind-coeur-512.png'), optimize=True)
fit_w(master, 480).save(os.path.join(APP, 'grind-coeur.webp'), 'WEBP', quality=92, method=6)
print('webp app', os.path.getsize(os.path.join(APP, 'grind-coeur.webp')), 'octets')

# ---------- 2. le texte GRIND : Saira ExtraBold italique, en tracés (aucune police à charger) ----------
font = TTFont(os.path.join(WORK, 'fonts', 'saira-latin-800-italic.ttf'))
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
TRACK = 0.045 * upm
x = 0; paths = []; xmin = ymin = 1e9; xmax = ymax = -1e9
for ch in 'GRIND':
    g = cmap[ord(ch)]
    sp = SVGPathPen(gs); gs[g].draw(TransformPen(sp, (1, 0, 0, -1, x, 0)))
    paths.append(sp.getCommands())
    bp = BoundsPen(gs); gs[g].draw(TransformPen(bp, (1, 0, 0, -1, x, 0)))
    if bp.bounds:
        b = bp.bounds; xmin, ymin, xmax, ymax = min(xmin, b[0]), min(ymin, b[1]), max(xmax, b[2]), max(ymax, b[3])
    x += gs[g].width + TRACK
W, H = xmax - xmin, ymax - ymin
print('texte', round(W), 'x', round(H), 'unités')
def wordmark(stops, gid):
    st = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{xmin:.0f} {ymin:.0f} {W:.0f} {H:.0f}" role="img" aria-label="GRIND">'
            f'<defs><linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{xmin:.0f}" y1="0" x2="{xmax:.0f}" y2="0">{st}</linearGradient></defs>'
            f'<path fill="url(#{gid})" d="{" ".join(paths)}"/></svg>')
VIOLET = [(0, '#4A1A92'), (0.55, '#6A2BC2'), (1, '#8E4BDE')]
CLAIR = [(0, '#FFFFFF'), (1, '#DCC9FF')]
for name, stops, gid in [('grind-texte.svg', VIOLET, 'gv'), ('grind-texte-clair.svg', CLAIR, 'gc')]:
    svg = wordmark(stops, gid)
    for d in (KIT, APP): open(os.path.join(d, name), 'w').write(svg)
print('svg texte', len(wordmark(VIOLET, 'gv')), 'octets')

# rendu PNG du texte (pour composer les logos en image) via Chromium n'est pas nécessaire : on rasterise les tracés
def text_raster(height, stops):
    from PIL import ImageDraw
    s = height / H; w = int(np.ceil(W * s)); h = height
    S = 4                                                                 # suréchantillonnage
    mask = Image.new('L', (w * S, h * S), 0); dr = ImageDraw.Draw(mask)
    from fontTools.pens.basePen import BasePen
    class Poly(BasePen):
        def __init__(self, gs):
            super().__init__(gs); self.polys = []; self.cur = []
        def _moveTo(self, p): self.cur = [p]
        def _lineTo(self, p): self.cur.append(p)
        def _curveToOne(self, p1, p2, p3):
            p0 = self.cur[-1]
            for t in np.linspace(0, 1, 12)[1:]:
                self.cur.append(tuple((1-t)**3*np.array(p0)+3*(1-t)**2*t*np.array(p1)+3*(1-t)*t**2*np.array(p2)+t**3*np.array(p3)))
        def _qCurveToOne(self, p1, p2):
            p0 = self.cur[-1]
            for t in np.linspace(0, 1, 10)[1:]:
                self.cur.append(tuple((1-t)**2*np.array(p0)+2*(1-t)*t*np.array(p1)+t**2*np.array(p2)))
        def _closePath(self): self.polys.append(self.cur); self.cur = []
        _endPath = _closePath
    xx = 0; polys = []
    for ch in 'GRIND':
        g = cmap[ord(ch)]; pp = Poly(gs)
        gs[g].draw(TransformPen(pp, (1, 0, 0, -1, xx, 0))); polys += pp.polys; xx += gs[g].width + TRACK
    # remplissage pair-impair : on XOR chaque contour
    acc = np.zeros((h * S, w * S), bool)
    for poly in polys:
        lay = Image.new('1', (w * S, h * S), 0); d2 = ImageDraw.Draw(lay)
        d2.polygon([((px - xmin) * s * S, (py - ymin) * s * S) for px, py in poly], fill=1)
        acc ^= np.array(lay)
    mask = Image.fromarray((acc * 255).astype('uint8')).resize((w, h), Image.LANCZOS)
    t = np.linspace(0, 1, w)[None, :]
    def col(c): return np.array([int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)], float)
    rgb = np.zeros((h, w, 3))
    offs = [o for o, _ in stops]; cols = [col(c) for _, c in stops]
    for k in range(3):
        rgb[..., k] = np.interp(t, offs, [c[k] for c in cols])
    im = Image.fromarray(rgb.astype('uint8'), 'RGB').convert('RGBA'); im.putalpha(mask)
    return im

# ---------- 3. logo principal (cœur à gauche, texte à droite) et logo empilé ----------
CAP = 0.40      # hauteur du texte / hauteur du cœur
GAP = 0.16      # espace cœur-texte / hauteur du cœur
def lockup(heart_h, stops):
    hr = heart.resize((round(heart.width * heart_h / heart.height), heart_h), Image.LANCZOS)
    tx = text_raster(round(heart_h * CAP), stops)
    gap = round(heart_h * GAP)
    w = hr.width + gap + tx.width; h = heart_h
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); im.alpha_composite(hr, (0, 0))
    im.alpha_composite(tx, (hr.width + gap, round((h - tx.height) / 2 + heart_h * 0.03)))
    return im
def stacked(heart_h, stops):
    hr = heart.resize((round(heart.width * heart_h / heart.height), heart_h), Image.LANCZOS)
    tx = text_raster(round(heart_h * 0.30), stops)
    gap = round(heart_h * 0.14)
    w = max(hr.width, tx.width); h = heart_h + gap + tx.height
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); im.alpha_composite(hr, ((w - hr.width) // 2, 0))
    im.alpha_composite(tx, ((w - tx.width) // 2, heart_h + gap))
    return im
def with_margin(im, k=0.25):     # zone de protection : un quart de la hauteur du cœur tout autour
    m = round(im.height * k); out = Image.new('RGBA', (im.width + 2 * m, im.height + 2 * m), (0, 0, 0, 0)); out.alpha_composite(im, (m, m)); return out
lockup(600, VIOLET).save(os.path.join(KIT, 'grind-logo.png'), optimize=True)
lockup(600, CLAIR).save(os.path.join(KIT, 'grind-logo-clair.png'), optimize=True)
stacked(700, VIOLET).save(os.path.join(KIT, 'grind-logo-empile.png'), optimize=True)
stacked(700, CLAIR).save(os.path.join(KIT, 'grind-logo-empile-clair.png'), optimize=True)

# SVG du logo principal : texte vectoriel, cœur intégré en image (il n'existe qu'en image, avec ses dégradés)
def lockup_svg(stops, gid):
    hb = io.BytesIO(); fit_w(heart, 512).save(hb, 'PNG', optimize=True)
    href = 'data:image/png;base64,' + base64.b64encode(hb.getvalue()).decode()
    HH = 1000.0; hw2 = heart.width * HH / heart.height
    s = HH * CAP / H; gap = HH * GAP; tx0 = hw2 + gap; ty0 = (HH - H * s) / 2 + HH * 0.03
    st = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    total = tx0 + W * s
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {total:.0f} {HH:.0f}" role="img" aria-label="GRIND">'
            f'<defs><linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{xmin:.0f}" y1="0" x2="{xmax:.0f}" y2="0">{st}</linearGradient></defs>'
            f'<image width="{hw2:.1f}" height="{HH:.0f}" href="{href}" xlink:href="{href}"/>'
            f'<g transform="translate({tx0:.1f} {ty0:.1f}) scale({s:.5f}) translate({-xmin:.0f} {-ymin:.0f})"><path fill="url(#{gid})" d="{" ".join(paths)}"/></g></svg>')
open(os.path.join(KIT, 'grind-logo.svg'), 'w').write(lockup_svg(VIOLET, 'gv'))
open(os.path.join(KIT, 'grind-logo-clair.svg'), 'w').write(lockup_svg(CLAIR, 'gc'))

# ---------- 4. icônes de l'app : cœur seul sur fond prune profond, léger relief ----------
def icon(size, scale=0.70, rounded=False):
    S = size
    yy, xx = np.mgrid[0:S, 0:S].astype(float) / S
    # fond : violet profond au centre, prune très sombre vers les bords
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.44) ** 2) / 0.72
    r = np.clip(r, 0, 1)
    c0 = np.array([46, 19, 90.]); c1 = np.array([13, 5, 27.])
    bg = c0[None, None, :] * (1 - r[..., None] ** 1.4) + c1[None, None, :] * (r[..., None] ** 1.4)
    im = Image.fromarray(bg.astype('uint8'), 'RGB').convert('RGBA')
    hw_ = round(S * scale); hr = fit_w(heart, hw_)
    x0 = (S - hr.width) // 2; y0 = round((S - hr.height) / 2 + S * 0.01)
    # relief : ombre douce sous le cœur, halo lavande léger derrière
    alpha = hr.split()[3]
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow = Image.new('RGBA', hr.size, (8, 2, 20, 0)); shadow.putalpha(alpha.point(lambda v: int(v * 0.55)))
    sh.alpha_composite(shadow, (x0, y0 + round(S * 0.018)))
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.022))
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gl = Image.new('RGBA', hr.size, (190, 150, 255, 0)); gl.putalpha(alpha.point(lambda v: int(v * 0.46)))
    glow.alpha_composite(gl, (x0, y0)); glow = glow.filter(ImageFilter.GaussianBlur(S * 0.045))
    im.alpha_composite(glow); im.alpha_composite(sh); im.alpha_composite(hr, (x0, y0))
    if rounded:
        mk = Image.new('L', (S * 4, S * 4), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mk).rounded_rectangle((0, 0, S * 4 - 1, S * 4 - 1), radius=round(S * 4 * 0.225), fill=255)
        im.putalpha(mk.resize((S, S), Image.LANCZOS))
    return im
master_icon = icon(1024)
master_icon.convert('RGB').save(os.path.join(KIT, 'grind-icone-1024.png'), optimize=True)
icon(1024, rounded=True).save(os.path.join(KIT, 'grind-icone-arrondie-1024.png'), optimize=True)
fit_w(master_icon, 512).convert('RGB').save(os.path.join(ICONS, 'icon-512.png'), optimize=True)
fit_w(master_icon, 192).convert('RGB').save(os.path.join(ICONS, 'icon-192.png'), optimize=True)
fit_w(master_icon, 180).convert('RGB').save(os.path.join(ICONS, 'apple-touch-icon.png'), optimize=True)
icon(1024, scale=0.56).resize((512, 512), Image.LANCZOS).convert('RGB').save(os.path.join(ICONS, 'icon-maskable-512.png'), optimize=True)
fav = icon(256, scale=0.88, rounded=True)
fav.resize((32, 32), Image.LANCZOS).save(os.path.join(ICONS, 'favicon-32.png'), optimize=True)
fav.resize((48, 48), Image.LANCZOS).save(os.path.join(ICONS, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
for f in sorted(os.listdir(ICONS)): print('icône', f, os.path.getsize(os.path.join(ICONS, f)))
