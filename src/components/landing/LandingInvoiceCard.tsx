import "./landing-invoice-card.css";

const lines = [
  { label: "Prestation de démonstration", amount: "1 000,00" },
];

export function LandingInvoiceCard() {
  return (
    <article className="invoice-card" aria-label="Facture illustrative. Données fictives.">
      <header className="invoice-card-head">
        <div>
          <strong>Atelier Démo SARL</strong>
          <span>Casablanca · données fictives</span>
        </div>
        <ul>
          <li>ICE 000000000000000</li>
          <li>IF 00000000</li>
          <li>RC 00000</li>
        </ul>
      </header>
      <p className="invoice-card-ref"><span>Facture</span> FAC-DEMO-0001</p>
      <table>
        <tbody>
          {lines.map((line) => (
            <tr key={line.label}>
              <td>{line.label}</td>
              <td>{line.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        <div><dt>HT</dt><dd>1 000,00 <span>MAD</span></dd></div>
        <div><dt>TVA 20 %</dt><dd>200,00 <span>MAD</span></dd></div>
        <div><dt>TTC</dt><dd>1 200,00 <span>MAD</span></dd></div>
      </dl>
      <p className="invoice-stamp">Émise · Archivée</p>
      <p className="invoice-fictitious">Aperçu illustratif · données fictives. Aucune facture réelle.</p>
    </article>
  );
}
