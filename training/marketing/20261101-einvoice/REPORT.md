# Mise en avant de la facturation électronique — 01/11/2026

Branche `codex/marketing-einvoice-20261101`, base `26ef2a3`.
Sauvegarde : `codex/backup-before-einvoice-marketing-20261101` et bundle vérifié
`../backups/felexia-before-einvoice-marketing-20261101.bundle` depuis la racine du dépôt.

## Présentation

- Nouveau titre d’accueil : « La facturation électronique, simplement. »
- Accès direct depuis le menu, le bouton de découverte et le pied de page.
- Section dédiée juste après le paysage : documents clients validés, génération PDF/XML,
  vérification, émission et archivage ; illustration documentaire propre au site.
- Inclusion « Facturation électronique PDF/XML et archivage » dans Essentiel sur l’accueil
  et `/pricing` ; prix et abonnement inchangés.
- FAQ précisant le parcours, l’activation administrateur et le périmètre DGI/signature.
- Métadonnées de l’accueil et de la page Tarifs mises à jour.

## Exactitude produit

Les contenus décrivent le module livré documenté dans `docs/e-invoicing/README.md`,
`USER-GUIDE.md` et `PRODUCTION-RELEASE.md`. Le contrôle d’accès est relu dans
`src/lib/e-invoicing/access.ts` : abonnement permettant l’écriture, rôle autorisé,
activation de l’entreprise et disponibilité du module restent requis.

La présentation ne revendique ni certification, ni transmission officielle DGI,
ni signature qualifiée. Le module ne réémet pas les factures fournisseurs.
Aucune activation automatique d’entreprise n’est annoncée ou effectuée.

## Vérifications

- Typage, ESLint ciblé et build optimisé réussis (`build.log`).
- Accueil et `/pricing` : HTTP 200, inclusion électronique présente dans le HTML (`http.json`).
- Navigateur : 320, 390, 768, 1100 et 1280 px, aucun débordement horizontal.
- À 1100 px, navigation et actions de l’en-tête séparées sans chevauchement.
- Titre, métadonnées, ancre de découverte, section et inclusion Essentiel confirmés dans le build optimisé.
- Liens vers inscription et `/facturation/electronique` vérifiés dans le DOM.
- Ouverture de la FAQ DGI vérifiée. Les anciennes légendes techniques restent absentes du texte visible.
- Capture du build optimisé `section.jpg`, mesures et console dans `browser.json`.

## Livraison

Version locale uniquement, aperçu optimisé actif sur `http://127.0.0.1:3108/`.
Aucun déploiement, SQL, changement de données métier, paiement ou transmission.
La scène paysagère et son zoom sont conservés.
