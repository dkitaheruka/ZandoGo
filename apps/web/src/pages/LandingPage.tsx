import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div>
      {/* Hero : asymétrique, ancré sur le motif de trajet plutôt qu'une
          composition centrée générique */}
      <section className="bg-nuit text-brume">
        <div className="mx-auto max-w-6xl px-6 py-24 grid md:grid-cols-[1.3fr_1fr] gap-16 items-end">
          <div>
            <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] max-w-xl">
              Du vendeur à votre porte, sans détour.
            </h1>
            <p className="mt-6 text-brume/70 max-w-md text-lg">
              Une place de marché pensée pour Kinshasa : des vendeurs vérifiés, un suivi de
              livraison suivie en direct, et un paiement qui s'adapte à vous — Mobile Money, carte, ou
              cash à la remise.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                to="/products"
                className="rounded-full bg-safran text-nuit font-medium px-6 py-3 hover:bg-safran/90 transition-colors"
              >
                Parcourir les produits
              </Link>
              <Link to="/register" className="text-brume/80 hover:text-brume underline underline-offset-4">
                Devenir vendeur
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="hidden md:block">
            <div className="route-line mb-3 opacity-60" />
            <div className="route-line mb-3 opacity-40 w-2/3" />
            <div className="route-line opacity-25 w-1/3" />
          </div>
        </div>
      </section>

      {/* Trois piliers du produit, sans étiquettes numérotées puisqu'il ne
          s'agit pas d'une séquence chronologique */}
      <section className="mx-auto max-w-6xl px-6 py-20 grid sm:grid-cols-3 gap-10">
        <Pillar
          title="Vendeurs vérifiés"
          text="Chaque boutique passe par une validation d'identité avant de pouvoir vendre."
          accent="seve"
        />
        <Pillar
          title="Livraison suivie"
          text="Suivez la position du livreur en temps réel, du retrait jusqu'à votre porte."
          accent="wax"
        />
        <Pillar
          title="Paiement flexible"
          text="Orange Money, Airtel Money, M-Pesa, carte bancaire, ou cash à la livraison."
          accent="safran"
        />
      </section>
    </div>
  );
}

function Pillar({ title, text, accent }: { title: string; text: string; accent: 'seve' | 'wax' | 'safran' }) {
  const dot = { seve: 'bg-seve', wax: 'bg-wax', safran: 'bg-safran' }[accent];
  return (
    <div>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
      <h2 className="font-display text-xl font-semibold mt-4">{title}</h2>
      <p className="mt-2 text-encre/70 leading-relaxed">{text}</p>
    </div>
  );
}
