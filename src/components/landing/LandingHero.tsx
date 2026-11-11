import Link from "next/link";
import { LandingInvoiceCard } from "./LandingInvoiceCard";
import "./landing-horizon.css";

export function LandingHero() {
  return (
    <section className="horizon-hero" aria-labelledby="hero-title">
      <div className="horizon-window">
        <div className="horizon-copy">
          <div className="horizon-stage">
            <div>
              <p className="horizon-eyebrow">Logiciel de gestion & ERP · PME au Maroc</p>
              <h1 id="hero-title"><span>Votre entreprise.</span>{" "}<span>Une vision plus claire.</span></h1>
              <p className="horizon-tagline">Facturez. Suivez vos coûts. Pilotez en toute liberté.</p>
              <div className="horizon-actions">
                <Link className="marketing-button marketing-button-primary" href="/login?mode=register">Essayer gratuitement</Link>
                <Link className="marketing-button horizon-action-secondary" href="/#pricing">Voir les offres</Link>
              </div>
            </div>
            <LandingInvoiceCard />
          </div>
        </div>
      </div>
    </section>
  );
}
