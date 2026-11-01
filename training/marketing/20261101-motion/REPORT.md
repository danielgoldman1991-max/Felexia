# Vitrine — ouverture, scroll et couleurs — 01/11/2026

Branche `codex/marketing-motion-20261101`, base `ba2d0e2`.
Sauvegarde : `codex/backup-before-motion-20261101` et bundle vérifié
`../backups/felexia-before-marketing-motion-20261101.bundle` depuis la racine du dépôt.

## Direction

Références publiques consultées visuellement : [Linear](https://linear.app/),
[Qonto](https://qonto.com/en), [Mercury](https://mercury.com/).
Principes retenus : contrastes plus marqués, grande typographie, profondeur des aperçus
et narration concrète du produit. La réalisation et les illustrations Felexia restent propres au projet.

- Palette bleu nuit `#081b33`, cobalt `#315efb`, menthe `#9de8cf`, ivoire `#f7f8fa`.
- Ouverture progressive du texte, des actions et du produit. Le H1 reste immédiatement visible ; aucun écran de chargement.
- Légère parallaxe du produit et des aplats lumineux sur ordinateur, barre de progression du défilement.
- Parcours Facturer → Encaisser → Piloter : aperçu sticky qui change avec le chapitre, navigation clavier/clic, transitions 3D, confirmation et tracé de courbe.
- Sur mobile, fenêtre basse, mouvement réduit ou sans JavaScript, les trois chapitres et leurs visuels suivent le flux normal.
- Tarifs : sélection qui coulisse, accents cobalt/menthe. Dernier CTA : sculpture orbitale en relief.

## Réalisation

Aucune nouvelle dépendance. Un seul listener scroll passif, mises à jour par requestAnimationFrame,
aucun état React à chaque frame. La parallaxe est désactivée sur mobile et en mouvement réduit.
Les couches d’entrée, scroll, inclinaison au pointeur et échelle responsive sont distinctes.
Le bouton pause 3D arrête aussi la parallaxe et l’entrée de la scène.

La sélection des chapitres conserve les dernières entrées IntersectionObserver et compare les
centres visibles, afin d’éviter une alternance incorrecte aux frontières entre chapitres.

## Vérifications

- Typage et ESLint ciblé : réussis.
- Build optimisé final : réussi (`build.log`).
- Diff sans erreurs d’espaces.
- Six routes publiques du build optimisé : HTTP 200 (`http.json`). Aucun formulaire soumis.
- Navigateur réel : largeurs 320, 390, 768 et 1280 px, aucun débordement horizontal.
- À 1280 × 800, stage sticky vérifié ; à 1280 × 650 et sur mobile, trois visuels en flux normal.
- Scroll descendant et montant : chapitres 1 → 2 → 1 constatés, stage à position constante ; navigation par bouton vers Encaisser/Piloter vérifiée.
- Barre de progression croissante au scroll descendant, décroissante au retour.
- Pause : état React, attribut racine et `animation-play-state: paused` constatés ; progression de parallaxe ramenée à zéro.
- Prix : 290 MAD/mois et 2 900 MAD/an, sélecteur cobalt et texte blanc vérifiés.
- Menu mobile : ouverture et fermeture par Échap vérifiées.
- Un seul H1, trois chapitres et trois visuels de repli présents dans le HTML pré-rendu.
- Aucun message d’erreur ou avertissement local observé. Les messages des sites de référence sont exclus de ce contrôle.
- Mouvement réduit et absence de JavaScript : mécanismes relus dans les sources et HTML statique contrôlé ; pas d’émulation du réglage système dans le navigateur.

Captures du build optimisé : `desktop-1280.jpg`, `mobile-390.jpg`, `journey-1280.jpg`.
Mesures dans `browser.json`.

## Livraison

Version locale uniquement. Aucun déploiement, SQL ou changement de données métier.
Prix, essai, authentification et destinations commerciales conservés.
Reconstruire avec l’environnement cible pour une publication autorisée ; ne pas envoyer le build local.
