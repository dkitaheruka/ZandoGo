import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  MessageSquare,
  Package,
  Store,
  Search,
  ShieldCheck,
  Globe,
  LogOut,
  Layers,
  Sparkles,
  FileText,
  Truck,
  User,
  Heart,
  ChevronDown,
  Bike,
  Scale,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useStore } from '../lib/store-context';
import { NotificationsBell } from './NotificationsBell';
import { CartDrawer } from './CartDrawer';
import { CompareDrawer } from './CompareDrawer';
import { PaymentOperatorStrip } from './PaymentOperatorLogos';
import { PWAInstallButton } from './PWAInstallButton';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { currency, setCurrency, exchangeRate, cartCount, openCart, wishlistIds, compareProducts, setCompareOpen } =
    useStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const isConsoleRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/vendor');

  // Keyboard shortcut Cmd/Ctrl+K to focus search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close account menu when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (isConsoleRoute) {
    return <>{children}</>;
  }

  async function handleLogout() {
    setAccountMenuOpen(false);
    await logout();
    navigate('/');
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  }

  const isAdmin = user?.roles.some((r) => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN');
  const isVendor = user?.roles.some((r) => r.role === 'VENDOR_OWNER' || r.role === 'VENDOR_STAFF');

  return (
    <div className="min-h-screen flex flex-col bg-brume text-encre antialiased font-sans">
      {/* Top Utility Bar */}
      <div className="bg-nuit text-brume/90 text-[11px] font-sans border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 h-9 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-safran font-semibold truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-safran shrink-0" />
              <span>Protection Acheteur ZandoGo : Séquestre 100% Garanti</span>
            </span>
            <span className="hidden lg:inline text-white/20">|</span>
            <span className="hidden lg:inline-flex items-center gap-1 text-brume/75 truncate">
              <Globe className="w-3 h-3 text-seve shrink-0" />
              <span>Siège Goma (Nord-Kivu) · Vente & livraison dans toute la RDC et ses environs</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-brume/75 shrink-0">
            <span className="hidden sm:inline font-mono text-safran tabular-nums">
              1 USD = {exchangeRate.toLocaleString('fr-FR')} CDF
            </span>

            {/* Live Currency Toggle */}
            <div className="inline-flex items-center rounded-md bg-white/10 p-0.5 border border-white/15">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2 py-0.5 rounded text-[10px] font-display font-bold transition ${
                  currency === 'USD' ? 'bg-safran text-nuit' : 'text-brume/75 hover:text-brume'
                }`}
              >
                USD $
              </button>
              <button
                type="button"
                onClick={() => setCurrency('CDF')}
                className={`px-2 py-0.5 rounded text-[10px] font-display font-bold transition ${
                  currency === 'CDF' ? 'bg-safran text-nuit' : 'text-brume/75 hover:text-brume'
                }`}
              >
                CDF
              </button>
            </div>

            {isAdmin && (
              <Link to="/admin" className="hidden md:inline text-safran hover:underline font-semibold font-display">
                Admin ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <header className="border-b border-encre/10 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-7xl px-6 h-18 flex items-center justify-between gap-4 md:gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="h-9 w-9 rounded-card bg-nuit text-safran font-bold flex items-center justify-center font-display text-lg shadow-xs group-hover:scale-105 transition-transform">
              ZG
            </div>
            <div>
              <span className="text-2xl font-display font-extrabold tracking-tight text-nuit">
                Zando<span className="text-seve">Go</span>
              </span>
              <span className="block text-[9px] font-display font-semibold uppercase tracking-wider text-encre/50 -mt-1">
                RDC & Environs
              </span>
            </div>
          </Link>

          {/* Global Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden sm:flex flex-1 max-w-xl items-center rounded-card border border-encre/20 bg-white overflow-hidden shadow-xs focus-within:border-seve focus-within:ring-1 focus-within:ring-seve transition"
          >
            <div className="px-3.5 py-2 text-xs font-semibold text-encre/70 bg-brume/70 border-r border-encre/10 shrink-0 hidden lg:block">
              Toute la RDC
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher partout en RDC : wax, café du Kivu, smartphone, guide PDF… (Ctrl+K)"
              className="w-full px-3.5 py-2 text-xs text-encre placeholder-encre/40 outline-none bg-transparent"
            />
            <button
              type="submit"
              className="bg-seve hover:bg-seve/90 text-brume px-4 py-2 text-xs font-bold transition flex items-center justify-center shrink-0"
              title="Lancer la recherche"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Navigation Icons */}
          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
            <PWAInstallButton variant="header" compact />

            <Link
              to={isVendor ? '/vendor' : '/vendor/new'}
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-card border border-encre/15 hover:border-seve text-xs font-semibold text-encre hover:text-seve bg-brume/50 transition"
            >
              <Store className="w-4 h-4 text-seve" />
              <span>{isVendor ? 'Espace Vendeur' : 'Vendre sur ZandoGo'}</span>
            </Link>

            {compareProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="p-2 rounded-xl text-encre/70 hover:text-nuit hover:bg-encre/5 transition relative"
                title="Comparer les produits sélectionnés"
              >
                <Scale className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 bg-safran text-nuit font-bold font-display text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {compareProducts.length}
                </span>
              </button>
            )}

            <Link
              to="/chat"
              className="p-2 rounded-xl text-encre/70 hover:text-encre hover:bg-encre/5 transition relative"
              title="Messagerie & Négociations"
              aria-label="Messagerie"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            <Link
              to="/orders"
              className="p-2 rounded-xl text-encre/70 hover:text-encre hover:bg-encre/5 transition relative"
              title="Mes Commandes"
              aria-label="Commandes"
            >
              <Package className="w-5 h-5" />
            </Link>

            {user && <NotificationsBell />}

            {/* Quick Cart Drawer Trigger */}
            <button
              type="button"
              onClick={openCart}
              className="p-2 rounded-xl text-encre/70 hover:text-encre hover:bg-encre/5 transition relative"
              title="Ouvrir le panier rapide"
              aria-label="Panier"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-wax text-brume font-bold font-display text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-xs tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>

            <div className="h-5 w-px bg-encre/10 mx-1" />

            {/* User Account Dropdown */}
            {user ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-encre/5 transition"
                >
                  <div className="h-8 w-8 rounded-full bg-nuit text-safran font-display font-bold text-xs flex items-center justify-center shrink-0 border border-white/10">
                    {(user.fullName || 'U')[0]}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-encre/50 hidden sm:block" />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-card bg-white border border-encre/10 shadow-xl py-2 z-40 text-xs">
                    <div className="px-4 py-2.5 border-b border-encre/10">
                      <p className="font-display font-bold text-nuit truncate">{user.fullName}</p>
                      <p className="text-[11px] text-encre/55 truncate font-mono">{user.email || user.phone}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-encre hover:bg-brume font-medium"
                      >
                        <User className="w-4 h-4 text-seve" />
                        <span>Mon profil & Adresses RDC</span>
                      </Link>
                      <Link
                        to="/products?favorites=1"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2 text-encre hover:bg-brume font-medium"
                      >
                        <span className="flex items-center gap-2.5">
                          <Heart className="w-4 h-4 text-wax" />
                          <span>Mes Favoris</span>
                        </span>
                        {wishlistIds.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-brume font-mono text-[10px] text-nuit">
                            {wishlistIds.length}
                          </span>
                        )}
                      </Link>
                      <Link
                        to="/orders"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-encre hover:bg-brume font-medium"
                      >
                        <Package className="w-4 h-4 text-seve" />
                        <span>Commandes & Factures</span>
                      </Link>
                      <Link
                        to="/kyc"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-encre hover:bg-brume font-medium"
                      >
                        <ShieldCheck className="w-4 h-4 text-seve" />
                        <span>Vérification d’identité (KYC)</span>
                      </Link>
                    </div>

                    <div className="border-t border-encre/10 py-1">
                      <Link
                        to="/vendor"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-encre hover:bg-brume font-medium"
                      >
                        <Store className="w-4 h-4 text-seve" />
                        <span>Espace Vendeur Pro</span>
                      </Link>
                      <Link
                        to="/delivery"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-encre hover:bg-brume font-medium"
                      >
                        <Bike className="w-4 h-4 text-safran" />
                        <span>Portail Livreur / Coursier</span>
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-nuit hover:bg-brume font-semibold"
                        >
                          <ShieldCheck className="w-4 h-4 text-safran" />
                          <span>Console Administration</span>
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-encre/10 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-wax hover:bg-wax/10 font-medium text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Se déconnecter</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-3 py-1.5 text-xs text-encre/80 hover:text-encre font-semibold">
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-1.5 rounded-card bg-seve text-brume text-xs font-semibold hover:bg-seve/90 transition shadow-xs"
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Category Navigation Strip */}
        <div className="border-t border-encre/5 bg-white/70">
          <div className="mx-auto max-w-7xl px-6 h-10 flex items-center gap-5 text-xs font-medium text-encre/70 overflow-x-auto">
            <Link to="/products" className="font-semibold text-nuit hover:text-seve whitespace-nowrap flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-seve" />
              <span>Tout voir</span>
            </Link>
            <Link to="/products?audience=WOMEN" className="hover:text-seve whitespace-nowrap">
              Habits Femme
            </Link>
            <Link to="/products?audience=MEN" className="hover:text-seve whitespace-nowrap">
              Habits Homme
            </Link>
            <Link to="/products?category=cat-1" className="hover:text-seve whitespace-nowrap">
              Électronique
            </Link>
            <Link to="/products?type=DIGITAL" className="hover:text-seve whitespace-nowrap flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-encre/60" />
              <span>Livres PDF (0$ livr.)</span>
            </Link>
            <Link to="/products?category=cat-6" className="hover:text-seve whitespace-nowrap flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-safran" />
              <span>Transport (au km)</span>
            </Link>
            <Link to="/products?type=SERVICE" className="hover:text-seve whitespace-nowrap flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-seve" />
              <span>Services</span>
            </Link>
            <Link to="/chat" className="text-seve font-semibold hover:underline whitespace-nowrap ml-auto">
              Négocier livraison & Localisation Maps &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">{children}</main>

      {/* Slide-over Drawers */}
      <CartDrawer />
      <CompareDrawer />

      {/* Footer */}
      <footer className="border-t border-encre/10 bg-nuit text-brume/80 mt-20">
        <div className="mx-auto max-w-7xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-card bg-seve text-brume font-bold flex items-center justify-center font-display text-xs">
                ZG
              </div>
              <span className="font-display font-bold text-brume text-base">ZandoGo</span>
            </div>
            <p className="text-brume/65 leading-relaxed">
              Place de marché universelle de référence en République Démocratique du Congo.
              Vente au détail dès 1 article, commandes groupées et services avec paiement sécurisé sous séquestre.
            </p>
            <div className="mt-4">
              <PWAInstallButton variant="footer" />
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-brume uppercase tracking-wider text-[11px] mb-3">
              Protection & Confiance
            </h4>
            <ul className="space-y-2 text-brume/65">
              <li>Paiement sous séquestre ZandoGo</li>
              <li>Fournisseurs vérifiés RCCM</li>
              <li>Négociation de prix directe</li>
              <li>Litiges & Arbitrage sous 48h</li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-brume uppercase tracking-wider text-[11px] mb-3">
              Couverture Logistique RDC & Environs
            </h4>
            <ul className="space-y-2 text-brume/65">
              <li>Siège Goma · Grand Kivu (Bukavu, Butembo, Beni, Sake)</li>
              <li>Kinshasa, Lubumbashi, Kisangani, Kolwezi & Matadi</li>
              <li>Ituri (Bunia) & Kasaï (Kananga, Mbuji-Mayi)</li>
              <li>Environs : Rwanda (Gisenyi/Kigali), Burundi & Ouganda</li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-brume uppercase tracking-wider text-[11px] mb-3">
              Paiements Sécurisés & SMS
            </h4>
            <div className="mb-2.5">
              <PaymentOperatorStrip compact dark />
            </div>
            <p className="text-brume/65 mb-2">
              Réglez directement via <strong>Airtel Money</strong>, <strong>M-Pesa Vodacom</strong>,{' '}
              <strong>Orange Money</strong>, <strong>MTN MoMo</strong> ou <strong>Cartes Visa / Mastercard</strong>.
              Alertes SMS temps réel via <strong>Africa’s Talking</strong>.
            </p>
            <span className="font-mono text-brume/40 block text-[10px]">
              © {new Date().getFullYear()} ZandoGo · Basé à Goma, actif dans toute la RDC & ses environs.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
