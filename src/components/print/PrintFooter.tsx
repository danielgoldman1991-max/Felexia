type Props = {
  footerText?: string | null;
  contact?: string;
  /** Nom affiché à côté du contact (défaut : entité). */
  name?: string | null;
};

export function PrintFooter({ footerText, contact, name }: Props) {
  return (
    <footer className="print-footer">
      {footerText ? (
        <p>
          <strong>{footerText}</strong>
        </p>
      ) : null}
      {contact ? (
        <p>
          {name ? <strong>{name}</strong> : null} {name ? " - " : ""}
          {contact}
        </p>
      ) : null}
    </footer>
  );
}
