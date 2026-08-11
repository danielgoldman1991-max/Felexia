type Props = {
  title: string;
  lines: string[];
};

export function PrintPartyCard({ title, lines }: Props) {
  return (
    <section className="print-party">
      <h2 className="print-party-title">{title}</h2>
      <div className="print-party-lines">
        {lines.length > 0 ? lines.map((line) => <p key={line}>{line}</p>) : <p>-</p>}
      </div>
    </section>
  );
}
