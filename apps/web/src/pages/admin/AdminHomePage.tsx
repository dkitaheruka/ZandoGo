import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    to: '/admin/kyc',
    title: 'Documents à valider',
    text: "Pièces d'identité, documents vendeurs et permis livreurs.",
  },
  {
    to: '/admin/stores',
    title: 'Boutiques à valider',
    text: "Activation des nouvelles boutiques et commission négociée.",
  },
  {
    to: '/admin/disputes',
    title: 'Litiges',
    text: 'File triée par échéance de 48h. Décision réservée au super admin.',
  },
  {
    to: '/admin/exchange-rate',
    title: 'Taux de change',
    text: 'Taux USD vers CDF, saisi manuellement et historisé.',
  },
];

export function AdminHomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Administration</h1>

      <div className="mt-8 grid sm:grid-cols-2 gap-px bg-encre/10 border border-encre/10">
        {SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="bg-brume p-6 hover:bg-white transition-colors"
          >
            <h2 className="font-display text-lg font-semibold">{section.title}</h2>
            <p className="mt-1.5 text-sm text-encre/60">{section.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
