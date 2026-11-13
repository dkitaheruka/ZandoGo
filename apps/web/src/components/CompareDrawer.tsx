import { Link } from 'react-router-dom';
import { X, Scale, ShieldCheck, ArrowRight, Trash2, Star } from 'lucide-react';
import { useStore } from '../lib/store-context';

export function CompareDrawer() {
  const { compareProducts, removeCompare, clearCompare, isCompareOpen, setCompareOpen, formatPrimaryPrice } =
    useStore();

  if (!isCompareOpen || compareProducts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-nuit/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-card max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-encre/10 shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-encre/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-card bg-nuit text-safran flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-nuit">
                Comparateur B2B & Détail ({compareProducts.length}/3)
              </h2>
              <p className="text-xs text-encre/60">
                Comparez les prix unitaires, remises sur volume et disponibilités en RDC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearCompare}
              className="text-xs text-wax hover:underline font-medium inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider</span>
            </button>
            <button
              type="button"
              onClick={() => setCompareOpen(false)}
              className="p-1.5 rounded-lg text-encre/50 hover:text-nuit hover:bg-encre/5"
              aria-label="Fermer le comparateur"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-encre/10">
                <th className="py-3 pr-4 font-display font-semibold text-encre/60 w-40">Critère</th>
                {compareProducts.map((p) => (
                  <th key={p.id} className="py-3 px-3 align-top">
                    <div className="relative rounded-card border border-encre/10 bg-brume/50 p-3">
                      <button
                        type="button"
                        onClick={() => removeCompare(p.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-white text-encre/50 hover:text-wax shadow-xs"
                        title="Retirer de la comparaison"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {p.images?.[0] && (
                        <img
                          src={p.images[0].url}
                          alt={p.title}
                          className="h-24 w-full object-cover rounded-lg mb-2"
                        />
                      )}
                      <Link
                        to={`/products/${p.id}`}
                        onClick={() => setCompareOpen(false)}
                        className="font-bold text-nuit hover:text-seve line-clamp-2"
                      >
                        {p.title}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-encre/10">
              <tr>
                <td className="py-3 pr-4 font-semibold text-encre/70">Prix Unitaire</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="py-3 px-3 font-display text-base font-extrabold text-nuit tabular-nums">
                    {formatPrimaryPrice(p.basePriceUsd)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-encre/70">Meilleur Tarif Gros</td>
                {compareProducts.map((p) => {
                  const best =
                    p.priceTiers && p.priceTiers.length > 1
                      ? p.priceTiers[p.priceTiers.length - 1]
                      : null;
                  return (
                    <td key={p.id} className="py-3 px-3">
                      {best ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-safran/20 border border-safran/40 font-display font-bold text-nuit tabular-nums">
                          {formatPrimaryPrice(best.unitPriceUsd)} (dès {best.minQty} pcs)
                        </span>
                      ) : (
                        <span className="text-encre/50">Tarif fixe / Négociable</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-encre/70">Boutique & Ville</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-medium text-nuit">
                      <ShieldCheck className="w-3.5 h-3.5 text-seve" />
                      {p.store.storeName}
                    </span>
                    <span className="block text-[11px] text-encre/55 mt-0.5">{p.store.city || 'Kinshasa'}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-encre/70">Évaluation Clients</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="py-3 px-3 tabular-nums">
                    <span className="inline-flex items-center gap-1 font-semibold text-nuit">
                      <Star className="w-3.5 h-3.5 text-safran fill-safran" />
                      {(p.rating || p.store.rating || 4.8).toFixed(1)} / 5
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-encre/70">Disponibilité</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="py-3 px-3 font-medium">
                    {p.productType === 'DIGITAL' ? (
                      <span className="text-seve">Téléchargement immédiat</span>
                    ) : p.productType === 'SERVICE' ? (
                      <span className="text-seve">Intervention sous 24h</span>
                    ) : (
                      <span className={(p.stockQty ?? 0) <= 5 ? 'text-wax font-bold' : 'text-seve'}>
                        {p.stockQty ?? 0} en stock
                      </span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-encre/70">Action</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="py-3 px-3">
                    <Link
                      to={`/products/${p.id}`}
                      onClick={() => setCompareOpen(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition"
                    >
                      <span>Voir l’offre</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
