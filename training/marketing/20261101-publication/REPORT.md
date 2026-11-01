# Publication de la vitrine Felexia — 1 novembre 2026

Publication explicitement autorisée par l’utilisateur : « parfait publie le ».

## Version en ligne

- Site : https://www.felexia.pro/ ; domaines `www.felexia.pro` et `felexia.pro` assignés.
- Projet : `felexia` / `prj_3VWRIDk122M2EssODvf3tZWXGRnQ`.
- Déploiement : `dpl_9RgUq48bcDXEJy2o5DkcVuk377kc`, **Production / READY**, source Git.
- Code : `7a66547a0154ffdc7af12944e50622e9f14b4c32` sur `main` et `codex/marketing-laptop-zoom-20261101`.
- URL du build : https://felexia-pjl3d8vve-danielgoldman1991-maxs-projects.vercel.app.
- Reconstruction distante Vercel avec l’environnement Production ; durée de construction 46,519 secondes. Aucun build ni environnement local envoyé.

## Portée et sauvegarde

Diff depuis la production précédente `b02c42b` : pages accueil/tarifs, composants et styles de vitrine, image publique et documentation/preuves. Aucun changement API, services métier, SQL, dépendances, configuration Next/Vercel ou variables. Aucune activation d’entreprise, connexion authentifiée, écriture métier, transmission fiscale ou paiement.

Branche de sauvegarde de production `codex/backup-production-before-marketing-20261101` à `b02c42b`. Bundle local complet vérifié avant le dernier lot : `../backups/felexia-before-laptop-zoom-20261101.bundle` ; ce bundle contient aussi l’ancienne production. Ancien déploiement disponible pour retour arrière : `dpl_wA2oqwzYL8cfcTAWraUns1iF8bL1`. La mise à jour de `main` est un fast-forward, précédé du contrôle de son SHA distant ; aucune réécriture forcée.

## Contrôles réussis

- CI branche : [41289013770](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41289013770), toutes les étapes réussies.
- CI main : [41289263788](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41289263788), toutes les étapes réussies.
- Ces contrôles couvrent lint, régressions, Essentiel, facturation électronique/PDF, droits et invitations, numérotation, PostgreSQL/transactions, décimaux, checkout/export, build et tracing avec les environnements isolés de CI. Ils n’effectuent pas de cycle de paiement réel.
- Contrôle public anonyme : `/`, `/pricing`, trois pages légales et `/api/health` HTTP200 ; santé `ok`.
- Image publique HTTP200, 2 506 435 octets, SHA256 identique au local : `94ebfaa6582175726be0df4b551eb5e9b628eed6753ec4bce894152c342b3f6f`.
- Nouvelle vitrine identifiée dans le HTML public ; anciennes mentions visibles retirées contrôlées sur accueil/tarifs. Voir `public-smoke.json` pour la méthode et ses limites.
- Navigateur réel sur le domaine : visuel chargé, ouverture, zoom atteignant son palier à environ 85 %, interface Felexia nette, CTA effacés inertes, puis libération naturelle vers le contenu ; aucun débordement horizontal dans les états observés. Mesures finales dans `browser.json` et captures `opening.jpg`, `laptop-screen.jpg`, `release-to-content.jpg`.
- Le navigateur de contrôle a changé de dimensions pendant l’ajustement de sa fenêtre ; les mesures sont celles enregistrées, sans revendiquer une nouvelle matrice mobile de production. Les contrôles locaux 320/390/768/1280 et paysage sont documentés dans le rapport du lot précédent, pour le même code.

L’API connectée refuse l’accès aux journaux internes de build avec403 d’accès équipe. L’état READY, le SHA, les alias, les deux CI et les réponses publiques sont vérifiés ; aucun audit exhaustif des journaux internes n’est revendiqué. Aucun accès supplémentaire ni changement de protection n’a été demandé.

Le site public est laissé ouvert dans le navigateur à son accueil. Aucun nouveau changement applicatif n’est inclus dans cette trace de publication.
