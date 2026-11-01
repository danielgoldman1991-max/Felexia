# Refonte de la vitrine Felexia — 01/11/2026

Branche : `codex/marketing-3d-20261101`. Référence avant travaux : `a8b70a5`.
Sauvegarde : `codex/backup-before-marketing-20261101` et bundle vérifié
`../../../../backups/felexia-before-marketing-20261101.bundle` depuis ce dossier.

## Résultat

- Accueil et `/pricing` harmonisés : composition plus aérée, bleu Felexia, typographie affirmée, navigation et pied de page partagés.
- Scène produit réalisée en HTML/CSS/SVG : perspective réactive au pointeur, cube à six faces et cartes flottantes. Aucune dépendance d’animation ajoutée.
- Arrêt des animations hors écran, bouton pause/reprise, prise en charge de `prefers-reduced-motion`. Apparitions progressives via IntersectionObserver ; contenu visible sans JavaScript.
- Quatre usages illustrés, section Maroc, FAQ native, offre Essentiel unique, contact par email et liens légaux.
- Prix et durée d’essai issus des configurations existantes : 290 MAD/mois, 2 900 MAD/an, 1 mois d’essai. Les données illustrées sont explicitement fictives.

## Vérifications

- `npm run typecheck` : réussi pendant l’intégration ; compilation TypeScript également réussie dans le build final.
- ESLint ciblé sur les dix fichiers TSX modifiés/créés : réussi.
- `npm run build` final : réussi ; pages publiques statiques conservées. Journal : `build.log`.
- `npm run test:light-launch` : réussi, 23 parcours conservés, 21 écrans sur demande, 6 menus.
- `git diff --check` : réussi.
- Build optimisé servi localement sur 3106 : six routes anonymes contrôlées, toutes HTTP 200 (`http.json`). Aucun formulaire soumis.
- Un seul H1 sur l’accueil et `/pricing`. Texte principal déjà présent dans le HTML statique avant JavaScript.
- Navigateur réel : 320, 390, 768 et 1 280 px, aucun débordement horizontal ; mesures enregistrées dans `browser.json`.
- Menu mobile : ouverture, fermeture, Échap et navigation vers une section vérifiés. FAQ dépliable vérifiée.
- Pause/reprise 3D au clic et au clavier ; état CSS `animation-play-state: paused` constaté. Scène hors écran : `data-active=false` constaté.
- Bascule mensuelle/annuelle vérifiée dans le build optimisé. Ancres de l’accueil et liens entre `/pricing` et l’accueil vérifiés.
- Console du build optimisé : aucune erreur ni alerte observée.
- Réduction des mouvements et visibilité sans JavaScript vérifiées par revue du code/CSS et du HTML statique ; aucune émulation navigateur du réglage système effectuée.

Captures : `desktop-1280.jpg`, `mobile-390.jpg`, `pricing-1280.jpg`.

## Livraison

Travaux locaux uniquement. Aucune publication, migration SQL, donnée métier, configuration de paiement ou transmission externe. Les pages de connexion et les actions métier gardent leurs destinations existantes. Reconstituer un build avec l’environnement cible lors d’une publication autorisée ; ne pas envoyer le build de recette local.
