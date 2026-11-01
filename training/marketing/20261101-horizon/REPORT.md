# Ouverture paysagère Felexia — 01/11/2026

Branche `codex/marketing-horizon-20261101`, base `7639fed`.
Sauvegarde : `codex/backup-before-creative-20261101`, bundle vérifié
`../backups/felexia-before-horizon-20261101.bundle` depuis la racine du dépôt.

## Résultat

Ouverture simplifiée selon la référence publique [Mercury](https://mercury.com/) :
paysage plein écran, titre et actions centrés, en-tête transparent avec logo blanc,
zoom de l’image lié au défilement et effacement progressif du texte.

Image créée avec **ImageGen intégré**, en une génération à partir d’une référence visuelle :
`public/images/felexia-horizon-v1.png`, 1672 × 941 px, 2 506 435 octets.
Vallée, rivière, bureau, ordinateur et fauteuil reproduits dans une composition très proche ;
la lumière de l’aube est légèrement plus chaude. Aucun texte ou logo dans l’image.
Prompt exact et provenance dans `IMAGE-PROMPT.md`.
L’image est servie par Next Image avec préchargement, tailles responsives et optimisation.

Les libellés visibles « Aperçu illustratif · données fictives » et « Animation 3D » sont retirés.
Le parcours produit et le CTA final conservent leurs améliorations visuelles ; aucune offre,
fonction métier ou destination commerciale n’est modifiée.

## Vérifications

- Typage, ESLint ciblé et build optimisé : réussis (`build.log`).
- Accueil et `/pricing` du build optimisé : HTTP 200 (`http.json`).
- Un H1 ; image chargée et absence des libellés demandés confirmées dans le navigateur réel.
- Zoom réel mesuré : échelle 1,015 à scroll 0, puis 1,13264 à scroll 450 px ; scène à top 0 pendant le zoom.
- En-tête blanc et texte sombre après sortie du paysage : vérifié.
- Écrans 320 × 480, 740 × 360, 768 × 1024 et 1440 × 900 : aucun débordement horizontal,
  actions contenues dans leur scène. Sur écran court, le bloc suit le flux naturel et le zoom est désactivé.
- Mobile du build optimisé : 390 × 844 sans débordement ; capture `mobile.jpg`.
- Aperçu final du build optimisé : 1280 × 720 ; capture `desktop.jpg`.
- Réduction des mouvements : zoom et effacement désactivés dans le code/CSS.
- Sans JavaScript, l’en-tête superposé défile avec la page et ne reste pas blanc sur les sections claires ;
  fallback vérifié par revue des règles CSS. Aucune émulation navigateur du réglage système effectuée.
- Restauration de visibilité au focus clavier du CTA conservée.

Mesures dans `browser.json`. Les captures de référence servent uniquement au travail local.

## Livraison

Version locale, aucun déploiement ou SQL. Aperçu optimisé disponible sur
`http://127.0.0.1:3108/`, laissé actif à la demande de l’utilisateur pour consultation.
Reconstruire avec l’environnement cible lors d’une publication autorisée.
