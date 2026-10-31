# Interface Felexia Pro — 31 octobre 2026

## Périmètre

Harmonisation de l’interface essentielle : navigation, recherche et création rapide, clients/fournisseurs, factures de vente et d’achat, règlements, trésorerie, journaux et tableau de bord. Palette sobre, contraste des boutons, hiérarchie des actions, formulaires et tableaux plus compacts. Textes français et états vides contextualisés.

Aucune modification des tables, des migrations, des calculs métier, des actions serveur ou des permissions. Les modules sur demande restent masqués selon le profil de lancement existant.

## Corrections vérifiées

- Le reset CSS non stratifié écrasait les couleurs des liens et la typographie des contrôles. Il est maintenant dans la couche `base`.
- Les variantes des boutons partagent des styles explicites, également sur les liens `asChild` : texte blanc sur le bleu principal, filtres secondaires blancs.
- Les défauts `h-10`/`px-4` entraient en conflit avec les boutons d’icône `h-9`/`px-0` puisque `cn` n’effectue pas de fusion Tailwind. Les défauts sont maintenant dans la couche `components` : icônes observées à 16 px dans des actions de 36 px.
- Les anciennes règles de compatibilité n’aplatissent plus tous les fonds colorés et toutes les ombres en mode clair.
- Les liens et la navigation du mode sombre utilisent un bleu clair distinct du fond des boutons, pour préserver la lisibilité.
- Tableaux de factures et de journaux ramenés à sept colonnes par regroupement des informations, sans retirer les liens ni les actions.
- Une seule zone de défilement dans le menu de création rapide, avec hauteur adaptée au viewport.

## Validation

Build de production Next.js et typage réussis. Lint `src` réussi. Régressions QA réussies. Politique light : 23 parcours conservés, 21 modules/écrans sur demande, six menus. Politique Opérateur : 15 parcours métier, dix consultations et 29 refus vérifiés.

Contrôle navigateur sur la compilation de production locale avec l’entreprise QA fictive existante : listes clients/fournisseurs, formulaire client, factures vente/achat, saisie d’une ligne, règlements clients/fournisseurs, comptes, journaux, tableau de bord. Contrôles ordinateur et mobile, thèmes clair et sombre, état vide filtré, menu mobile et création rapide. Les tableaux larges restent défilables horizontalement sur mobile ; la page ne déborde pas.

Calcul local d’une ligne non enregistrée : 2 × 100 HT, TVA 20 % = 200 HT + 40 TVA = 240 TTC. Aucun nouveau document métier créé pendant cette vérification visuelle.

Couleurs calculées observées : CTA clair #2454D8 / texte #FFFFFF ; CTA sombre #3965DF / texte #FFFFFF ; navigation sombre #B3C9FF sur #152B4D. Impression achat contrôlée en thème sombre : feuille blanche #FFFFFF, texte #0F172A, sans shell applicatif. Accueil public contrôlé : CTA dédiés #1456B8 / texte blanc.

## Sauvegarde et limites

Base antérieure `ca66c3d`, branche `codex/backup-ui-before-premium-20261031`, archive autonome vérifiée `../backups/felexia-pro-before-premium-20261031.bundle`. Restaurer cette révision permet de revenir à l’interface précédente sans migration.

Ces contrôles visuels ne constituent pas un audit exhaustif d’accessibilité. Les parcours SMTP et migrations déjà vérifiés lors des tâches précédentes n’ont pas été rejoués pour cette refonte d’interface.
