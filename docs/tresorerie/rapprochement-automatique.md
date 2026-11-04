# Rapprochement bancaire automatique

Le rapprochement est réservé à l'offre PRO. Le menu Essentiel ne change pas.

## Importer un relevé

Depuis Trésorerie → Relevés bancaires, importez un fichier OFX/QFX, CSV ou Excel (.xlsx). Les en-têtes habituels d'Attijariwafa bank, Bank of Africa, Banque Populaire, CIH, Société Générale / Saham Bank, Crédit du Maroc et CFG Bank sont reconnus (date, libellé, débit, crédit, virgule décimale). Si le fichier n'est pas reconnu, indiquez les colonnes : ce choix est mémorisé pour le compte.

Un même fichier n'est pas réimporté. Si un relevé plus long contient des lignes déjà présentes, seules les lignes nouvelles sont ajoutées.

L'import ne crée pas de règlement. Le rapprochement se fait ensuite.

## Valider

L'écran compare le dernier solde lu sur le relevé et le solde du compte. Chaque ligne reçoit un score :

- au-dessus du seuil haut (92 par défaut), elle peut être rapprochée en lot si l'entreprise laisse cette option active ;
- entre les deux seuils, elle est proposée et se valide en un clic ;
- en dessous, elle reste à traiter.

Le moteur reconnaît un montant exact, une date proche, un numéro de facture ou de chèque, un nom de client ou de fournisseur, un virement qui couvre plusieurs factures et un règlement partiel. Un mouvement de trésorerie déjà saisi est relié de préférence à un nouveau règlement.

Les commissions, la TVA sur frais et les agios sont proposés. Ils ne sont comptabilisés sans clic que si une règle de libellé le demande. Les frais vont au compte 6147 (ou au compte de frais bancaires de l'entreprise), les agios au 6311, la banque au 5141. La TVA n'est isolée que si le libellé la donne, ou à 10 % lorsqu'il indique un montant TTC taxable.

Un règlement créé depuis une facture met à jour son reste à payer et réutilise l'écriture CGNC s'il en existe déjà une.

## Annuler

« Annuler le rapprochement » rouvre la ligne. Si le rapprochement avait créé le règlement ou le frais, ce règlement est annulé et l'écriture est extournée. Un mouvement qui existait déjà n'est pas supprimé.

## Règles

Trésorerie → Règles de rapprochement. Exemple : libellé contenant « commission », catégorie Commission. Cochez l'application automatique seulement si vous voulez que le lot élevé la passe sans clic.

## Ce qui reste manuel

Aucune banque n'est connectée en direct. Le format Excel ancien .xls n'est pas lu : enregistrez-le en .xlsx ou CSV. L'écart affiché utilise le dernier solde présent dans le fichier ; s'il n'y est pas, la case reste vide.
