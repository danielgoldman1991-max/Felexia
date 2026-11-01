# Correction du zoom statique entre navigateurs

Signalement utilisateur après publication : image restant statique dans les autres navigateurs. Correction de la version publique `7a66547`, préparée sur `codex/fix-zoom-compatibility-20261101`, sauvegarde locale `codex/backup-before-zoom-compatibility-20261101`.

## Défauts identifiés et reproduction

Le code désactivait complètement le zoom avec `max-height:600px`, aussi bien en JavaScript qu’en CSS. Une hauteur de fenêtre réduite ou un zoom navigateur pouvait donc rendre l’image statique sur un ordinateur. Reproduction sur le domaine public : viewport1492×475, scroll880px, progrès0, `transform:none`, laptop masqué et fenêtre en positionrelative.

Une seconde dépendance concernait le média CSS `scripting:enabled`. Sans prise en charge de ce média, la hauteur restait à une seule fenêtre et le contrôleur refusait logiquement d’animer. Le marqueur d’hydratation fournit désormais les hauteurs380/340svh directement, indépendamment de ce média, tout en conservant la réserve avant hydratation sur les moteurs compatibles.

## Correction

- Le zoom reste disponible dans les fenêtres de moins de600px. Le titre est compacté ; les actions restent accessibles par défilement de leur bloc si la fenêtre est très basse.
- Lecture du défilement depuis `document.scrollingElement`, avec secours `window.scrollY`.
- La préférence système de mouvement réduit reste respectée par défaut. Dans ce cas, un bouton « Activer le zoom au défilement » permet au visiteur de choisir explicitement cet effet sans changer ses réglages système ; il peut annuler son choix. Le changement recalcule immédiatement la géométrie.
- Aucune dépendance, donnée métier, API, SQL ou variable d’environnement modifiée.
- Test du contrôleur ajouté au workflow GitHub existant pour éviter une nouvelle régression.

## Vérifications avant publication

- Typage, ESLint ciblé et build optimisé réussis.
-100 assertions comportementales sur le vrai contrôleur transpilé : fenêtre590px, scrollingElement, RAF, mouvement réduit, activation/annulation, pause/reprise, redimensionnement, retour arrière et nettoyage. La géométrie DOM est simulée ; ce test ne certifie pas le rendu CSS ou un moteur de navigateur.
- Navigateur réel : correctif dans une fenêtre1163×536, progrès1 et transformée active, laptop affiché ; comparaison avec l’ancienne version publique sous475px.
- Fenêtre très basse1000×318 : bloc de texte défilable, CTA dans la fenêtre ; contrôles dans `browser.json`.
- Relecture indépendante des priorités CSS, de l’hydratation et de l’activation volontaire. Mouvement réduit natif et anciens moteurs sans le média scripting non émulés dans le navigateur disponible ; contrôleur et règles CSS vérifiés séparément.

Sources de référence : [média scripting](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/scripting), [mouvement réduit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

La désactivation sous600px est reproduite et corrigée. Le réglage exact des autres navigateurs de l’utilisateur n’a pas été observé ; aucune validation de tous les navigateurs n’est revendiquée.
