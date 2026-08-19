type Props = {
  label?: string;
};

export function PrintSignature({ label = "Signature et cachet du client" }: Props) {
  return (
    <section className="print-signature">
      <div className="print-signature-box">{label}</div>
    </section>
  );
}
