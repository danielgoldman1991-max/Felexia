# Zoom du paysage vers l’interface Felexia

Travail local du 1 novembre 2026, branche `codex/marketing-laptop-zoom-20261101`, base `6b2d2f1`. Sauvegarde préalable `codex/backup-before-laptop-zoom-20261101` et bundle vérifié `../backups/felexia-before-laptop-zoom-20261101.bundle`.

## Résultat

L’ouverture conserve le paysage, le titre et les actions. Le défilement rapproche progressivement la caméra du laptop, aligne une interface Felexia sur son écran, puis maintient le cadrage final pendant les derniers 16 % de la séquence. Ensuite, le bloc sticky se libère naturellement et laisse apparaître la section Facturation électronique puis le reste du site. Remonter inverse le parcours.

Le paysage et l’interface HTML sont projetés séparément avec la même géométrie. L’interface reste nette au terme du zoom, sans agrandir une miniature rasterisée. Le décor s’assombrit pendant la dernière partie de l’approche. Une variante mobile présente une grande fiche facture et ses deux formats PDF/XML. Le visuel existant est conservé et son `sizes` tient compte de la couverture des écrans portrait.

L’interface reste une présentation décorative, masquée aux technologies d’assistance et sans contrôles interactifs. Les CTA du titre deviennent inertes une fois effacés et retrouvent leur accès au clavier en remontant. La navigation réelle et le lien vers la suite restent disponibles.

## Implémentation

- Aucun paquet ajouté. Composant d’interface statique rendu côté serveur.
- Un seul contrôleur de défilement passif, regroupé par `requestAnimationFrame`. Mesures au redimensionnement, transformations et opacité pendant le parcours, cache du progrès hors du hero.
- La hauteur est réservée par CSS avec `scripting: enabled` avant l’hydratation, pour conserver la position lors d’un rechargement. Sans JavaScript ou sans prise en charge de ce média, une ouverture d’une hauteur d’écran reste disponible.
- Mouvement réduit et fenêtres de hauteur maximale 600 px : ouverture statique, sans longue zone épinglée. Nettoyage des écouteurs, observateurs et attributs à la sortie.

## Vérifications

- `npm run typecheck` : réussi.
- ESLint ciblé Hero / Effects / LaptopInterface : réussi.
- `npm run build` : réussi, voir `build.log` (avertissement existant Node `module.register`).
- Six ressources publiques HTTP 200 : accueil, tarifs, trois pages légales et image ; voir `http.json`.
- Navigateur réel : 1280×720, 768×1024, 390×844, 320×740 et 844×390. Aucun débordement horizontal dans les états observés.
- Ouverture, approche, écran final, libération du sticky, remontée et restauration après rechargement contrôlés. À 1280×720, l’écran final mesure environ 906×550 px ; le haut de la section suivante reste hors champ pendant le palier, puis entre avec le défilement normal.
- Navigation directe vers Tarifs et retour en haut contrôlés. Menu mobile → Facture électronique : menu fermé et cible atteinte directement.
- Interface sans élément focalisable, parent `aria-hidden`, titre/CTA inertes après disparition puis restaurés au début.
- Mode paysage bas vérifié visuellement avec actions accessibles. Mouvement réduit et absence de JavaScript vérifiés dans le code ; ces deux préférences n’ont pas été émulées par le navigateur disponible.
- Relecture indépendante des mathématiques, du cycle de vie et de l’accessibilité ; correction des CTA invisibles encore accessibles au clavier.

Captures : `desktop-opening.jpg`, `desktop-approach.jpg`, `desktop-screen.jpg`, `desktop-release.jpg`, `mobile-opening.jpg`, `mobile-screen.jpg`. Mesures dans `browser.json`.

## État livré

Aperçu optimisé actualisé sur `http://127.0.0.1:3108/`, serveur laissé actif pour consultation. Serveur de développement 3110 arrêté. Aucune publication, transmission DGI, activation d’entreprise, modification SQL ou donnée métier. Les tarifs, l’accès à l’application et les sections existantes sont conservés.
