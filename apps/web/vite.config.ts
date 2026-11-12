import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function mockApiPlugin(): Plugin {
  // In-memory data store for standalone execution in AI Studio
  const categories = [
    { id: 'cat-1', name: 'Électronique & High-Tech' },
    { id: 'cat-2', name: 'Mode & Wax Africain' },
    { id: 'cat-3', name: 'Alimentation & Kivu' },
    { id: 'cat-4', name: 'Produits Digitaux & E-books' },
    { id: 'cat-5', name: 'Services & Télécoms' },
    { id: 'cat-6', name: 'Logistique & Transport' },
  ];

  const deliveryOptions = [
    {
      id: 'del-opt-express',
      providerName: 'Kota Express Moto',
      code: 'EXPRESS_MOTO',
      name: 'Coursier Moto Express (Urbain Rapide)',
      estimatedTime: 'Moins de 2 heures',
      feeUsd: 6.5,
      feeCdf: 18500,
      description: 'Livraison express prioritaire dans toute l’agglomération urbaine (Kinshasa, Lubumbashi, Goma).',
      badgeText: 'Express Urbain',
    },
    {
      id: 'del-opt-partner',
      providerName: 'MaxiLog RDC Fret National',
      code: 'PARTNER_LOGISTICS',
      name: 'Fret Interurbain & National (Toute la RDC)',
      estimatedTime: '24 à 48 heures',
      feeUsd: 8.0,
      feeCdf: 22800,
      description: 'Liaison nationale sécurisée (Kinshasa ↔ Lubumbashi ↔ Goma ↔ Matadi ↔ Kisangani).',
      badgeText: 'Toute la RDC',
    },
    {
      id: 'del-opt-pickup',
      providerName: 'Hub ZandoGo / Dépôt Vendeur',
      code: 'CLICK_AND_COLLECT',
      name: 'Retrait en Hub ou Boutique (Click & Collect)',
      estimatedTime: 'Disponible dès aujourd’hui',
      feeUsd: 0,
      feeCdf: 0,
      description: 'Retrait sans frais au dépôt du vendeur ou dans un hub relais ZandoGo agréé.',
      badgeText: 'Gratuit',
    },
  ];

  let products = [
    {
      id: 'prod-1',
      title: 'Pagne Super Wax Vlisco Original (6 yards)',
      description: 'Véritable wax hollandais de qualité premium, motifs vibrants traditionnels de Kinshasa. 100% coton peigné.',
      productType: 'PHYSICAL',
      basePriceUsd: 65,
      basePriceCdf: 185000,
      minOrderQty: 1,
      priceTiers: [
        { minQty: 1, maxQty: 9, unitPriceUsd: 65, unitPriceCdf: 185000 },
        { minQty: 10, maxQty: 49, unitPriceUsd: 55, unitPriceCdf: 156000 },
        { minQty: 50, maxQty: null, unitPriceUsd: 48, unitPriceCdf: 136000 },
      ],
      status: 'PUBLISHED',
      stockQty: 18,
      lowStockThreshold: 5,
      images: [
        { id: 'img-1', url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80', altText: 'Wax Vlisco' },
      ],
      variants: [
        { id: 'var-1', sku: 'WAX-VLI-01', name: 'Standard 6 yards', attributes: { color: 'Bleu / Safran' }, priceOverride: 65, stockQty: 18 },
      ],
      store: { id: 'store-1', storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[1],
    },
    {
      id: 'prod-2',
      title: 'Veste Tailleur Haute Couture Motif Kuba',
      description: 'Confection artisanale exclusive en lin et coton imprimé aux motifs royaux Kuba. Doublure satinée respirante, boutons en corne naturelle.',
      productType: 'PHYSICAL',
      basePriceUsd: 85,
      basePriceCdf: 242000,
      minOrderQty: 1,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 85, unitPriceCdf: 242000 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 75, unitPriceCdf: 213000 },
        { minQty: 20, maxQty: null, unitPriceUsd: 68, unitPriceCdf: 193000 },
      ],
      status: 'PUBLISHED',
      stockQty: 3, // Low stock alert!
      lowStockThreshold: 5,
      images: [
        { id: 'img-kuba', url: '/src/assets/images/fashion_jacket_kuba_1794397997636.jpg', altText: 'Veste Kuba Haute Couture' },
      ],
      variants: [
        { id: 'var-kuba-m', sku: 'JKT-KUBA-M', name: 'Taille M', attributes: { size: 'M' }, priceOverride: 85, stockQty: 2 },
        { id: 'var-kuba-l', sku: 'JKT-KUBA-L', name: 'Taille L', attributes: { size: 'L' }, priceOverride: 85, stockQty: 1 },
      ],
      store: { id: 'store-1', storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[1],
    },
    {
      id: 'prod-3',
      title: 'Guide d’Investissement & Stratégie PME RDC (PDF + Modèles)',
      description: 'Document complet de 142 pages rédigé par des experts fiduciaires de Kinshasa : fiscalité OHADA, grille salariale locale, contrats bilingues et templates Excel de trésorerie.',
      productType: 'DIGITAL',
      basePriceUsd: 29,
      basePriceCdf: 82500,
      status: 'PUBLISHED',
      stockQty: 9999,
      digitalFileUrl: 'https://example.com/downloads/guide-investissement-rdc-2026.pdf',
      digitalFileName: 'guide-strategie-pme-rdc-2026.pdf',
      digitalFileSize: '18.4 Mo',
      images: [
        { id: 'img-guide', url: '/src/assets/images/digital_business_guide_1794397996870.jpg', altText: 'Guide Digital Business RDC' },
      ],
      variants: [
        { id: 'var-guide-pdf', sku: 'DIGI-GUIDE-PDF', name: 'Licence Pro + Fichiers Excel', priceOverride: 29, stockQty: 9999 },
      ],
      store: { id: 'store-digital', storeName: 'Kinshasa Business Insights', slug: 'kin-insights', ownerId: 'usr-1', rating: 5.0 },
      category: categories[3],
    },
    {
      id: 'prod-4',
      title: 'Abonnement Internet Fibre Pro 100 Mbps (30 Jours)',
      description: 'Connexion très haut débit illimitée avec routeur Wi-Fi 6 offert en prêt. Installation et configuration par technicien certifié sous 24h à Gombe, Ngaliema ou Limete.',
      productType: 'SERVICE',
      basePriceUsd: 75,
      basePriceCdf: 213500,
      status: 'PUBLISHED',
      stockQty: 50,
      serviceDuration: 'Forfait mensuel (30 jours)',
      fulfillmentDetails: 'Prise de contact téléphonique du technicien sous 2 heures après commande.',
      images: [
        { id: 'img-fiber', url: '/src/assets/images/internet_fiber_service_1794397997131.jpg', altText: 'Internet Fibre Pro Kinshasa' },
      ],
      variants: [
        { id: 'var-fiber-100', sku: 'SRV-FIBER-100', name: 'Forfait 100 Mbps Illimité', priceOverride: 75, stockQty: 50 },
      ],
      store: { id: 'store-telecom', storeName: 'KinConnect Télécoms', slug: 'kin-connect', ownerId: 'usr-2', rating: 4.8 },
      category: categories[4],
    },
    {
      id: 'prod-5',
      title: 'Prestation Course Express Moto Dédiée (Grand Kinshasa)',
      description: 'Mise à disposition d’un motard coursier professionnel équipé pour vos colis urgents, plis confidentiels ou livraisons clients dans toutes les communes.',
      productType: 'SERVICE',
      basePriceUsd: 15,
      basePriceCdf: 42500,
      status: 'PUBLISHED',
      stockQty: 25,
      serviceDuration: 'Course immédiate (durée max 3h)',
      fulfillmentDetails: 'Prise en charge à votre adresse dans les 30 minutes suivant l’achat.',
      images: [
        { id: 'img-courier', url: '/src/assets/images/express_courier_moto_1794397998233.jpg', altText: 'Coursier Moto Express' },
      ],
      variants: [
        { id: 'var-moto-course', sku: 'LOG-MOTO-COURSE', name: 'Course Standard (-10 kg)', priceOverride: 15, stockQty: 25 },
      ],
      store: { id: 'store-logistics', storeName: 'Kota Express Logistique', slug: 'kota-express', ownerId: 'usr-1', rating: 4.9 },
      category: categories[5],
    },
    {
      id: 'prod-6',
      title: 'Smartphone Tecno Camon 30 Premier 5G (512GB)',
      description: 'Triple capteur photo Sony 50MP, charge 70W ultra-rapide, écran AMOLED 120Hz. Garantie officielle Carlcare 13 mois.',
      productType: 'PHYSICAL',
      basePriceUsd: 380,
      basePriceCdf: 1080000,
      minOrderQty: 1,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 380, unitPriceCdf: 1080000 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 360, unitPriceCdf: 1026000 },
        { minQty: 20, maxQty: null, unitPriceUsd: 345, unitPriceCdf: 983000 },
      ],
      status: 'PUBLISHED',
      stockQty: 12,
      lowStockThreshold: 5,
      images: [
        { id: 'img-tecno', url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80', altText: 'Tecno Camon 30 Premier' },
      ],
      variants: [
        { id: 'var-tecno-blk', sku: 'TEC-CAM30-BLK', name: 'Noir Sidéral 512 Go', attributes: { color: 'Noir Sidéral' }, priceOverride: 380, stockQty: 12 },
      ],
      store: { id: 'store-2', storeName: 'Kin Digital Gombe', slug: 'kin-digital', ownerId: 'usr-1', rating: 4.7, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[0],
    },
  ];

  let currentUser: any = {
    id: 'usr-1',
    fullName: 'David Kitenge',
    email: 'david.kitenge@example.cd',
    phone: '+243820001122',
    preferredCurrency: 'USD',
    roles: [
      { role: 'CUSTOMER' },
      { role: 'VENDOR_OWNER', scopeId: 'store-1' },
      { role: 'DELIVERY_AGENT' },
      { role: 'ADMIN' },
      { role: 'SUPER_ADMIN' },
    ],
  };

  let cart = {
    id: 'cart-1',
    items: [
      {
        id: 'cart-item-1',
        quantity: 1,
        unitPriceSnapshot: 85,
        variant: {
          id: 'var-kuba-m',
          name: 'Taille M',
          product: {
            id: 'prod-2',
            title: 'Veste Tailleur Haute Couture Motif Kuba',
            productType: 'PHYSICAL',
            images: [
              { id: 'img-kuba', url: '/src/assets/images/fashion_jacket_kuba_1794397997636.jpg' },
            ],
          },
        },
      },
    ],
  };

  let addresses = [
    {
      id: 'addr-1',
      commune: 'Gombe',
      quartier: 'Haut Commandement',
      referencePoint: 'Croisement Batetela et Boulevard du 30 Juin',
      latitude: -4.3015,
      longitude: 15.3052,
      isDefault: true,
    },
    {
      id: 'addr-2',
      commune: 'Ngaliema',
      quartier: 'Macampagne',
      referencePoint: 'En face de l église méthodiste',
      latitude: -4.3412,
      longitude: 15.2654,
      isDefault: false,
    },
  ];

  let orders = [
    {
      id: 'ord-1001',
      orderNumber: 'ZGO-2026-1001',
      status: 'OUT_FOR_DELIVERY',
      isPaid: true,
      paymentStatus: 'PAID',
      escrowStatus: 'HELD',
      createdAt: new Date().toISOString(),
      total: 91.5,
      deliveryFee: 6.5,
      currency: 'USD',
      deliveryOption: deliveryOptions[0],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-1',
          store: { storeName: 'Boutique Victoire Wax' },
          items: [
            { id: 'item-1', quantity: 1, productTitle: 'Veste Tailleur Haute Couture Motif Kuba', unitPrice: 85, productType: 'PHYSICAL' },
          ],
        },
      ],
    },
    {
      id: 'ord-1002',
      orderNumber: 'ZGO-2026-1002',
      status: 'COMPLETED',
      isPaid: true,
      paymentStatus: 'PAID',
      escrowStatus: 'RELEASED_TO_VENDOR',
      createdAt: '2026-03-01T14:30:00Z',
      total: 29.0,
      deliveryFee: 0,
      currency: 'USD',
      deliveryOption: deliveryOptions[2],
      hasDigitalItems: true,
      digitalDownloads: [
        {
          productId: 'prod-3',
          title: 'Guide d’Investissement & Stratégie PME RDC (PDF + Modèles)',
          downloadUrl: 'https://example.com/downloads/guide-investissement-rdc-2026.pdf',
          fileName: 'guide-strategie-pme-rdc-2026.pdf',
        },
      ],
      subOrders: [
        {
          id: 'sub-2',
          store: { storeName: 'Kinshasa Business Insights' },
          items: [
            { id: 'item-2', quantity: 1, productTitle: 'Guide d’Investissement & Stratégie PME RDC', unitPrice: 29, productType: 'DIGITAL' },
          ],
        },
      ],
    },
    {
      id: 'ord-1003',
      orderNumber: 'ZGO-2026-1003',
      status: 'PENDING_PAYMENT',
      isPaid: false,
      paymentStatus: 'UNPAID',
      escrowStatus: undefined,
      createdAt: '2026-03-10T16:20:00Z',
      total: 195.0,
      deliveryFee: 8.0,
      currency: 'USD',
      deliveryOption: deliveryOptions[1],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-3',
          store: { storeName: 'Boutique Victoire Wax' },
          items: [
            { id: 'item-3', quantity: 3, productTitle: 'Pagne Super Wax Vlisco Original (6 yards)', unitPrice: 65, productType: 'PHYSICAL' },
          ],
        },
      ],
    },
    {
      id: 'ord-1004',
      orderNumber: 'ZGO-2026-1004',
      status: 'PENDING_PAYMENT',
      isPaid: false,
      paymentStatus: 'UNPAID',
      escrowStatus: undefined,
      createdAt: '2026-03-11T08:10:00Z',
      total: 380.0,
      deliveryFee: 6.5,
      currency: 'USD',
      deliveryOption: deliveryOptions[0],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-4',
          store: { storeName: 'Kin Digital Gombe' },
          items: [
            { id: 'item-4', quantity: 1, productTitle: 'Smartphone Tecno Camon 30 Premier 5G (512GB)', unitPrice: 380, productType: 'PHYSICAL' },
          ],
        },
      ],
    },
  ];

  let negotiations = [
    {
      id: 'neg-101',
      productId: 'prod-1',
      productTitle: 'Pagne Super Wax Vlisco Original (6 yards)',
      productImage: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
      storeId: 'store-1',
      storeName: 'Boutique Victoire Wax',
      buyerId: 'usr-1',
      buyerName: 'David Kitenge',
      requestedQty: 10,
      requestedPriceUsd: 48,
      agreedPriceUsd: 50,
      transportMode: 'Coursier Express Kinshasa',
      requestedDeliveryFeeUsd: 3.0,
      agreedDeliveryFeeUsd: 3.5,
      destinationCity: 'Kinshasa (Gombe)',
      currency: 'USD',
      status: 'ACCEPTED_BY_VENDOR',
      notes: 'Commande de 10 pièces avec livraison groupée au bureau.',
      createdAt: '2026-03-09T11:20:00Z',
      updatedAt: '2026-03-09T14:45:00Z',
    },
    {
      id: 'neg-102',
      productId: 'prod-6',
      productTitle: 'Smartphone Tecno Camon 30 Premier 5G (512GB)',
      productImage: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80',
      storeId: 'store-2',
      storeName: 'Kin Digital Gombe',
      buyerId: 'usr-1',
      buyerName: 'David Kitenge',
      requestedQty: 2,
      requestedPriceUsd: 340,
      agreedPriceUsd: null,
      transportMode: 'Bus / Agence Interurbaine (Fret Lubumbashi)',
      requestedDeliveryFeeUsd: 12.0,
      agreedDeliveryFeeUsd: null,
      destinationCity: 'Lubumbashi (Haut-Katanga)',
      currency: 'USD',
      status: 'PENDING_VENDOR_REVIEW',
      notes: 'Envoi sécurisé vers Lubumbashi par agence de voyage partenaire.',
      createdAt: '2026-03-10T09:15:00Z',
      updatedAt: '2026-03-10T09:15:00Z',
    },
  ];

  let stores = [
    {
      id: 'store-1',
      storeName: 'Boutique Victoire Wax',
      slug: 'victoire-wax',
      storeType: 'RETAIL',
      description: 'Maison de couture et grossiste de pagnes et tissus haut de gamme à Kinshasa.',
      status: 'ACTIVE',
      fulfillmentMode: 'PLATFORM_DELIVERY',
      balanceUsd: 1840.5,
      totalOrders: 142,
      createdAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'store-digital',
      storeName: 'Kinshasa Business Insights',
      slug: 'kin-insights',
      storeType: 'DIGITAL',
      description: 'Vente d’études sectorielles, templates contractuels et e-books pour entrepreneurs en RDC.',
      status: 'ACTIVE',
      fulfillmentMode: 'DIRECT_DOWNLOAD',
      balanceUsd: 870.0,
      totalOrders: 65,
      createdAt: '2026-02-10T11:00:00Z',
    },
    {
      id: 'store-telecom',
      storeName: 'KinConnect Télécoms',
      slug: 'kin-connect',
      storeType: 'SERVICES',
      description: 'Opérateur télécom agréé : forfaits data, fibre optique professionnelle et assistance réseau.',
      status: 'ACTIVE',
      fulfillmentMode: 'SERVICE_APPOINTMENT',
      balanceUsd: 3250.0,
      totalOrders: 89,
      createdAt: '2026-01-20T09:00:00Z',
    },
    {
      id: 'store-logistics',
      storeName: 'Kota Express Logistique',
      slug: 'kota-express',
      storeType: 'LOGISTICS',
      description: 'Flotte de 45 coursiers motos et camionnettes pour livraison express dans tout Kinshasa.',
      status: 'ACTIVE',
      fulfillmentMode: 'LOGISTICS_PROVIDER',
      balanceUsd: 2180.0,
      totalOrders: 310,
      createdAt: '2026-01-05T08:00:00Z',
    },
  ];

  let disputes = [
    {
      id: 'disp-1',
      orderNumber: 'KND-2026-0988',
      buyerName: 'Marc Mwamba',
      storeName: 'Kin Digital Gombe',
      amountUsd: 380,
      status: 'OPEN',
      reason: 'Retard de livraison supérieur à 48h sur smartphone',
      escrowAmount: 380,
      createdAt: '2026-03-08T10:00:00Z',
    },
  ];

  let notifications = [
    {
      id: 'notif-1',
      title: 'Bienvenue sur Marché Kinshasa !',
      body: 'Explorez nos boutiques locales et suivez vos livraisons en temps réel.',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
  ];

  let deliveryJobs = [
    {
      id: 'del-1',
      status: 'IN_TRANSIT',
      estimatedFee: 5,
      distanceKm: 4.8,
      pickupLat: -4.321,
      pickupLng: 15.312,
      dropoffLat: -4.3015,
      dropoffLng: 15.3052,
      subOrder: {
        store: { storeName: 'Boutique Victoire Wax' },
        order: {
          id: 'ord-1001',
          orderNumber: 'KND-2026-1001',
          total: 65,
          currency: 'USD',
          deliveryAddress: addresses[0],
          paymentTransactions: [{ methodCode: 'ORANGE_MONEY', status: 'SUCCESS' }],
        },
      },
    },
  ];

  return {
    name: 'mock-api-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api')) {
          return next();
        }

        const path = url.split('?')[0].replace(/^\/api/, '');
        const method = req.method?.toUpperCase() || 'GET';

        // Helper to parse JSON body
        const readBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        const json = (data: any, statusCode = 200) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        // --- AUTH ---
        if (path === '/auth/refresh' && method === 'POST') {
          return json({ accessToken: 'mock-jwt-token-12345' });
        }
        if (path === '/auth/login' && method === 'POST') {
          return json({ accessToken: 'mock-jwt-token-12345' });
        }
        if (path === '/auth/register' && method === 'POST') {
          return json({ accessToken: 'mock-jwt-token-12345' });
        }
        if (path === '/auth/logout' && method === 'POST') {
          return json({ success: true });
        }

        // --- USER ---
        if (path === '/users/me' && method === 'GET') {
          return json(currentUser);
        }
        if (path === '/users/me/addresses' && method === 'GET') {
          return json(addresses);
        }
        if (path === '/users/me/addresses' && method === 'POST') {
          readBody().then((body) => {
            const newAddr = {
              id: `addr-${Date.now()}`,
              commune: body.commune || 'Gombe',
              quartier: body.quartier || 'Centre',
              referencePoint: body.referencePoint || '',
              latitude: body.latitude || -4.325,
              longitude: body.longitude || 15.322,
              isDefault: Boolean(body.isDefault),
            };
            addresses.push(newAddr);
            json(newAddr, 201);
          });
          return;
        }

        // --- CATEGORIES ---
        if (path === '/categories' && method === 'GET') {
          return json(categories);
        }

        // --- PRODUCTS ---
        if (path === '/products' && method === 'GET') {
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const search = searchParams.get('search')?.toLowerCase();
          if (search) {
            const filtered = products.filter(
              (p) =>
                p.title.toLowerCase().includes(search) ||
                p.description?.toLowerCase().includes(search) ||
                p.store.storeName.toLowerCase().includes(search),
            );
            return json(filtered);
          }
          return json(products);
        }

        const productMatch = path.match(/^\/products\/([^/]+)$/);
        if (productMatch && method === 'GET') {
          const prodId = productMatch[1];
          const prod = products.find((p) => p.id === prodId) || products[0];
          return json(prod);
        }

        // --- CART ---
        if (path === '/cart' && method === 'GET') {
          return json(cart);
        }
        if (path === '/cart/items' && method === 'POST') {
          readBody().then((body) => {
            const foundProd = products.find((p) => p.variants.some((v) => v.id === body.productVariantId)) || products[0];
            const foundVar = foundProd.variants.find((v) => v.id === body.productVariantId) || foundProd.variants[0];
            const newItem = {
              id: `cart-item-${Date.now()}`,
              quantity: body.quantity || 1,
              unitPriceSnapshot: foundVar.priceOverride || foundProd.basePriceUsd,
              variant: {
                id: foundVar.id,
                product: {
                  id: foundProd.id,
                  title: foundProd.title,
                  images: foundProd.images,
                },
              },
            };
            cart.items.push(newItem);
            json(cart);
          });
          return;
        }

        const cartItemMatch = path.match(/^\/cart\/items\/([^/]+)$/);
        if (cartItemMatch && method === 'PATCH') {
          readBody().then((body) => {
            const item = cart.items.find((i) => i.id === cartItemMatch[1]);
            if (item) item.quantity = body.quantity;
            json(cart);
          });
          return;
        }
        if (cartItemMatch && method === 'DELETE') {
          cart.items = cart.items.filter((i) => i.id !== cartItemMatch[1]);
          return json(cart);
        }

        // --- DELIVERY OPTIONS ---
        if (path === '/delivery/options' && method === 'GET') {
          return json(deliveryOptions);
        }

        // --- ORDERS & CHECKOUT ---
        if (path === '/orders' && method === 'GET') {
          return json(orders);
        }
        if (path === '/orders/checkout' && method === 'POST') {
          readBody().then((body) => {
            const selectedDel = deliveryOptions.find((d) => d.id === body.deliveryOptionId) || deliveryOptions[0];
            const hasDigital = cart.items.some((i) => (i.variant?.product as any)?.productType === 'DIGITAL');
            const subtotal = cart.items.reduce((sum, item) => sum + (Number(item.unitPriceSnapshot) || 0) * (item.quantity || 1), 0) || 65;
            const deliveryFee = hasDigital && cart.items.every((i) => (i.variant?.product as any)?.productType === 'DIGITAL') ? 0 : selectedDel.feeUsd;
            const grandTotal = subtotal + deliveryFee;

            const digitalDownloads = cart.items
              .filter((i) => (i.variant?.product as any)?.productType === 'DIGITAL')
              .map((i) => ({
                productId: (i.variant?.product as any)?.id || 'prod-3',
                title: i.variant?.product?.title || 'Fichier Digital',
                downloadUrl: 'https://example.com/downloads/guide-investissement-rdc-2026.pdf',
                fileName: 'guide-strategie-pme-rdc-2026.pdf',
              }));

            const newOrder = {
              id: `ord-${Date.now()}`,
              orderNumber: `KND-2026-${Math.floor(1000 + Math.random() * 9000)}`,
              status: 'ESCROW_HELD' as const,
              escrowStatus: 'HELD' as const,
              createdAt: new Date().toISOString(),
              total: grandTotal,
              deliveryFee,
              currency: (body.currency || 'USD') as any,
              deliveryOption: selectedDel,
              hasDigitalItems: digitalDownloads.length > 0,
              digitalDownloads: digitalDownloads.length > 0 ? digitalDownloads : undefined,
              subOrders: [
                {
                  id: `sub-${Date.now()}`,
                  store: { storeName: cart.items[0]?.variant?.product?.title ? 'Boutique Partenaire' : 'Boutique Victoire Wax' },
                  items: cart.items.map((it) => ({
                    id: it.id,
                    quantity: it.quantity,
                    productTitle: it.variant?.product?.title,
                    unitPrice: Number(it.unitPriceSnapshot),
                    productType: (it.variant?.product as any)?.productType || 'PHYSICAL',
                  })),
                },
              ],
            };

            // Deduct stock for physical items
            cart.items.forEach((item) => {
              const p = products.find((prod) => prod.id === (item.variant?.product as any)?.id);
              if (p && p.stockQty !== undefined && p.productType === 'PHYSICAL') {
                p.stockQty = Math.max(0, p.stockQty - item.quantity);
              }
            });

            // Empty cart
            cart.items = [];
            orders.unshift(newOrder);

            json({
              orderId: newOrder.id,
              orderNumber: newOrder.orderNumber,
              total: newOrder.total,
              deliveryFee: newOrder.deliveryFee,
              currency: newOrder.currency,
              status: newOrder.status,
            });
          });
          return;
        }

        const releaseEscrowMatch = path.match(/^\/orders\/([^/]+)\/release-escrow$/);
        if (releaseEscrowMatch && method === 'POST') {
          const ord = orders.find((o) => o.id === releaseEscrowMatch[1]);
          if (ord) {
            ord.status = 'COMPLETED';
            ord.escrowStatus = 'RELEASED_TO_VENDOR';
          }
          return json({ success: true, message: 'Fonds débloqués au vendeur avec succès' });
        }

        const payOrderMatch = path.match(/^\/orders\/([^/]+)\/pay$/);
        if (payOrderMatch && method === 'POST') {
          const ord = orders.find((o) => o.id === payOrderMatch[1]);
          if (ord) {
            ord.status = 'ESCROW_HELD';
            ord.isPaid = true;
            ord.paymentStatus = 'PAID';
            ord.escrowStatus = 'HELD';
          }
          return json({ success: true, message: 'Commande réglée avec succès et placée sous séquestre sécurisé ZandoGo.' });
        }

        // --- NEGOTIATIONS (B2B Price Discussion & Custom Quotations) ---
        if (path === '/negotiations' && method === 'GET') {
          return json(negotiations);
        }
        if (path === '/negotiations' && method === 'POST') {
          readBody().then((body) => {
            const newNeg = {
              id: `neg-${Date.now()}`,
              productId: body.productId,
              productTitle: body.productTitle || 'Offre ZandoGo',
              productImage: body.productImage,
              storeId: body.storeId || 'store-1',
              storeName: body.storeName || 'Fournisseur Certifié',
              buyerId: currentUser.id,
              buyerName: currentUser.fullName,
              requestedQty: Number(body.requestedQty) || 1,
              requestedPriceUsd: Number(body.requestedPriceUsd) || 0,
              agreedPriceUsd: null,
              transportMode: body.transportMode || 'Coursier Express Kinshasa',
              requestedDeliveryFeeUsd: body.requestedDeliveryFeeUsd !== undefined ? Number(body.requestedDeliveryFeeUsd) : 3.5,
              agreedDeliveryFeeUsd: null,
              destinationCity: body.destinationCity || 'Kinshasa',
              currency: body.currency || 'USD',
              status: 'PENDING_VENDOR_REVIEW',
              notes: body.notes || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            negotiations.unshift(newNeg);
            json(newNeg, 201);
          });
          return;
        }

        const negItemMatch = path.match(/^\/negotiations\/([^/]+)$/);
        if (negItemMatch && method === 'PATCH') {
          readBody().then((body) => {
            const neg = negotiations.find((n) => n.id === negItemMatch[1]);
            if (neg) {
              if (body.agreedPriceUsd !== undefined) neg.agreedPriceUsd = Number(body.agreedPriceUsd);
              if (body.agreedDeliveryFeeUsd !== undefined) neg.agreedDeliveryFeeUsd = Number(body.agreedDeliveryFeeUsd);
              if (body.transportMode) neg.transportMode = body.transportMode;
              if (body.status) neg.status = body.status;
              neg.updatedAt = new Date().toISOString();
            }
            json(neg || { success: true });
          });
          return;
        }

        const negAcceptMatch = path.match(/^\/negotiations\/([^/]+)\/accept$/);
        if (negAcceptMatch && method === 'POST') {
          const neg = negotiations.find((n) => n.id === negAcceptMatch[1]);
          if (neg) {
            neg.status = 'CONVERTED_TO_ORDER';
            const foundProd = products.find((p) => p.id === neg.productId) || products[0];
            const customPrice = neg.agreedPriceUsd || neg.requestedPriceUsd;
            cart.items.push({
              id: `cart-neg-${Date.now()}`,
              quantity: neg.requestedQty,
              unitPriceSnapshot: customPrice,
              variant: {
                product: {
                  id: foundProd.id,
                  title: `${foundProd.title} (Tarif Négocié & Transport Convenus)`,
                  images: foundProd.images,
                },
              },
            });
          }
          return json({ success: true, message: 'Offre personnalisée validée et transférée dans le panier au tarif et conditions négociés.' });
        }

        // --- STOCK MANAGEMENT ---
        const stockUpdateMatch = path.match(/^\/vendors\/stores\/([^/]+)\/products\/([^/]+)\/stock$/);
        if (stockUpdateMatch && method === 'PATCH') {
          readBody().then((body) => {
            const prod = products.find((p) => p.id === stockUpdateMatch[2]);
            if (prod) {
              if (body.stockQty !== undefined) prod.stockQty = Number(body.stockQty);
              if (body.variantId && prod.variants) {
                const v = prod.variants.find((vr) => vr.id === body.variantId);
                if (v && body.variantStockQty !== undefined) v.stockQty = Number(body.variantStockQty);
              }
            }
            json(prod || { success: true });
          });
          return;
        }

        // --- VENDORS ---
        if (path === '/vendors/stores/mine' && method === 'GET') {
          return json(stores);
        }
        if (path === '/vendors/stores' && method === 'POST') {
          readBody().then((body) => {
            const newStore = {
              id: `store-${Date.now()}`,
              storeName: body.storeName,
              slug: body.slug,
              description: body.description,
              status: 'ACTIVE' as const,
              fulfillmentMode: body.fulfillmentMode || 'PLATFORM_DELIVERY',
              createdAt: new Date().toISOString(),
            };
            stores.push(newStore);
            json(newStore, 201);
          });
          return;
        }

        const vendorStoreProductsMatch = path.match(/^\/vendors\/stores\/([^/]+)\/products$/);
        if (vendorStoreProductsMatch && method === 'GET') {
          const storeId = vendorStoreProductsMatch[1];
          return json(products.filter((p) => p.store.id === storeId || p.store.id === 'store-1'));
        }
        if (vendorStoreProductsMatch && method === 'POST') {
          readBody().then((body) => {
            const newProd = {
              id: `prod-${Date.now()}`,
              title: body.title,
              description: body.description,
              basePriceUsd: body.basePriceUsd,
              basePriceCdf: body.basePriceCdf || Number(body.basePriceUsd) * 2850,
              status: 'PUBLISHED',
              images: [{ id: `img-${Date.now()}`, url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80', altText: body.title }],
              variants: [{ id: `var-${Date.now()}`, sku: 'SKU-NEW', stockQty: body.stockQty || 10 }],
              store: { id: vendorStoreProductsMatch[1], storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1' },
              category: categories[0],
            };
            products.unshift(newProd);
            json(newProd, 201);
          });
          return;
        }

        const vendorStoreMatch = path.match(/^\/vendors\/stores\/([^/]+)$/);
        if (vendorStoreMatch && method === 'GET') {
          const s = stores.find((st) => st.id === vendorStoreMatch[1]) || stores[0];
          return json(s);
        }

        // --- DELIVERY ---
        if (path === '/delivery/agents/me' && method === 'GET') {
          return json({ id: 'agent-1', status: 'AVAILABLE', vehicleType: 'MOTO' });
        }
        if (path === '/delivery/deliveries' && method === 'GET') {
          return json(deliveryJobs);
        }

        // --- KYC ---
        if (path === '/kyc/documents/mine' && method === 'GET') {
          return json([
            { id: 'kyc-1', type: 'NATIONAL_ID', status: 'VERIFIED', createdAt: '2026-01-10T10:00:00Z' },
          ]);
        }
        if (path === '/kyc/documents/pending' && method === 'GET') {
          return json([]);
        }

        // --- NOTIFICATIONS ---
        if (path === '/notifications/mine' && method === 'GET') {
          return json(notifications);
        }

        // --- FINANCE ---
        if (path === '/finance/exchange-rates' && method === 'GET') {
          return json({ rate: 2850, currencyPair: 'USD/CDF', updatedAt: new Date().toISOString() });
        }

        // --- DISPUTES ---
        if (path === '/disputes' && method === 'GET') {
          return json([]);
        }

        // --- CHAT ---
        if (path.startsWith('/chat/conversations') && method === 'GET') {
          return json([]);
        }

        // Default fallback for any unhandled GET/POST
        if (method === 'GET') {
          return json(path.endsWith('s') ? [] : {});
        }
        return json({ success: true, message: 'Opération réussie' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mockApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});

