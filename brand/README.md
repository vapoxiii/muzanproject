# Identité GRIND — kit du logo

Le logo se compose du **cœur** (symbole principal, avec son électrocardiogramme) et du **texte GRIND**.
Le cœur est l'image de référence fournie : il n'est ni redessiné, ni déformé, ni recoloré. Seuls les
pixels quasi invisibles laissés par le détourage, hors du dessin, ont été retirés.

## Fichiers

| Fichier | Usage |
| --- | --- |
| `grind-logo.png`, `grind-logo.svg` | Logo principal (cœur à gauche, texte à droite), sur fond clair |
| `grind-logo-clair.png`, `grind-logo-clair.svg` | Logo principal en blanc et lavande, sur fond sombre |
| `grind-logo-empile.png`, `grind-logo-empile-clair.png` | Cœur au-dessus du texte (écran de lancement, réseaux sociaux) |
| `grind-coeur.png` (haute définition), `grind-coeur-512.png` | Logo compact : le cœur seul, fond transparent |
| `grind-texte.svg`, `grind-texte-clair.svg` | Le texte GRIND seul, en tracés vectoriels |
| `grind-icone-1024.png`, `grind-icone-arrondie-1024.png` | Icône de l'app (stores, présentations) |
| `source/logo-reference.png` | L'image de référence d'origine |
| `generer-declinaisons.py` | Script qui produit toutes les déclinaisons et les icônes de l'app |

Dans l'app : `src/assets/brand/` (cœur en WebP, texte en SVG) et `public/icons/` (icônes iOS, Android,
« maskable », favicon). Le composant est `src/ui/brand.js`.

Le cœur n'existe qu'en image : ses rubans ont des dégradés et des reliefs qu'une vectorisation
aplatirait. Les fichiers SVG du logo principal contiennent donc le texte en vecteur et le cœur en image
haute définition.

## Règles

- **Proportions** : le texte fait 40 % de la hauteur du cœur ; l'espace entre les deux, 16 %.
- **Zone de protection** : laisser vide, tout autour du logo, au moins un quart de la hauteur du cœur.
- **Tailles minimales** : cœur seul 16 px de haut ; logo principal 80 px de large.
- **Fonds** : version violette sur fond clair (ivoire, lavande, blanc) ; version blanc et lavande sur
  fond sombre (prune, violet profond). Jamais sur une photo chargée.
- **À ne pas faire** : étirer, incliner davantage, changer les couleurs, ajouter une ombre portée dure,
  détacher l'électrocardiogramme du cœur, mettre le texte dans une autre police.

## Couleurs et typographie

- Texte GRIND sur fond clair : dégradé `#4A1A92` → `#6A2BC2` → `#8E4BDE`.
- Texte GRIND sur fond sombre : dégradé `#FFFFFF` → `#DCC9FF`.
- Fond de l'icône : violet profond `#2E135A` au centre, prune `#0D051B` sur les bords.
- Police du texte : Saira ExtraBold italique (licence SIL Open Font), convertie en tracés.

## Régénérer

```
python3 -I brand/generer-declinaisons.py <dossier de travail> brand src/assets/brand public/icons
```

Le dossier de travail contient `ref.png` (l'image de référence) et `fonts/saira-latin-800-italic.ttf`
(paquet npm `@fontsource/saira`, fichier `saira-latin-800-italic.woff` converti en TTF avec fontTools).
