# Pat Hellio's Exciting 80s Adventures

Petit jeu rétro HTML5 — hommage au journaliste de jeux vidéo Patrick Hellio. Vanilla JS + Canvas, zero dépendance, zero build.

## Jouer

Ouvrir `index.html` dans un navigateur. C'est tout.

Pour servir localement (recommandé, évite des limitations de polices Google) :

```bash
python3 -m http.server 8080
# puis http://localhost:8080
```

## Contrôles

- **← →** ou **A/D** — marcher
- **Espace** ou **↑** — sauter (scène plateforme)
- **Clic souris** — interagir (point and click) ou marcher vers un point
- **E** — interagir avec l'objet le plus proche
- **I** — ouvrir / fermer l'inventaire
- **Échap** — pause
- **Espace / Entrée** — valider un dialogue

## Le jeu

Pat doit récupérer la VHS du siècle en traversant trois époques :

1. **L'appart (1985)** — point and click. Trouve ton Walkman, ta cassette de notes et tes clés.
2. **La rue (1988)** — plateformes. Saute sur les télés, ramasse les cartouches.
3. **Le studio TV (1995)** — dialogue final avec l'animateur. Trois fins possibles selon ta réponse.

## Déploiement Vercel

Site statique. Vercel détecte tout seul.

```bash
# Via CLI
npm i -g vercel
vercel deploy --prod

# Ou : importer le repo sur vercel.com → Deploy
```

Aucune variable d'environnement requise.

## Stack

- Vanilla JS + HTML5 Canvas (`<canvas>` 480x270, scale-up CSS)
- Polices Google : Press Start 2P, VT323
- Audio : Web Audio API (oscillateurs carrés pour les bleeps)
- Tout le pixel art est dessiné en code (`ctx.fillRect`) — pas d'asset externe
