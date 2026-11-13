import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function mockApiPlugin(): Plugin {
  let exchangeRate = 2850;
  const rateHistory = [
    { id: 'rate-2', rate: 2850, effectiveFrom: new Date().toISOString() },
    { id: 'rate-1', rate: 2800, effectiveFrom: '2026-02-15T08:00:00Z' },
  ];

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
      feeCdf: 18525,
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

  let products: any[] = [
    {
      id: 'prod-1',
      title: 'Pagne Super Wax Vlisco Original (6 yards)',
      description: 'Véritable wax hollandais de qualité premium, motifs vibrants traditionnels de Kinshasa. 100% coton peigné.',
      productType: 'PHYSICAL',
      basePriceUsd: 65,
      basePriceCdf: 185250,
      minOrderQty: 1,
      rating: 4.9,
      reviewCount: 24,
      priceTiers: [
        { minQty: 1, maxQty: 9, unitPriceUsd: 65, unitPriceCdf: 185250 },
        { minQty: 10, maxQty: 49, unitPriceUsd: 55, unitPriceCdf: 156750 },
        { minQty: 50, maxQty: null, unitPriceUsd: 48, unitPriceCdf: 136800 },
      ],
      status: 'PUBLISHED',
      stockQty: 18,
      lowStockThreshold: 5,
      images: [
        { id: 'img-1', url: '/src/assets/images/wax_vlisco_fabric_1794567971042.jpg', altText: 'Pagne Super Wax Vlisco Original' },
      ],
      variants: [
        { id: 'var-1', sku: 'WAX-VLI-01', name: 'Standard 6 yards', attributes: { color: 'Émeraude / Safran' }, priceOverride: 65, stockQty: 18 },
        { id: 'var-1b', sku: 'WAX-VLI-02', name: 'Édition Royale Bordeaux (6 yards)', attributes: { color: 'Bordeaux' }, priceOverride: 68, stockQty: 9 },
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
      basePriceCdf: 242250,
      minOrderQty: 1,
      rating: 4.8,
      reviewCount: 15,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 85, unitPriceCdf: 242250 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 75, unitPriceCdf: 213750 },
        { minQty: 20, maxQty: null, unitPriceUsd: 68, unitPriceCdf: 193800 },
      ],
      status: 'PUBLISHED',
      stockQty: 3,
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
      basePriceCdf: 82650,
      rating: 5.0,
      reviewCount: 41,
      status: 'PUBLISHED',
      stockQty: 9999,
      digitalFileUrl: '/assets/downloads/guide-investissement-rdc-2026.pdf',
      digitalFileName: 'guide-strategie-pme-rdc-2026.pdf',
      digitalFileSize: '18.4 Mo',
      images: [
        { id: 'img-guide', url: '/src/assets/images/digital_business_guide_1794397996870.jpg', altText: 'Guide Digital Business RDC' },
      ],
      variants: [
        { id: 'var-guide-pdf', sku: 'DIGI-GUIDE-PDF', name: 'Licence Pro + Fichiers Excel', priceOverride: 29, stockQty: 9999 },
      ],
      store: { id: 'store-digital', storeName: 'Kinshasa Business Insights', slug: 'kin-insights', ownerId: 'usr-1', rating: 5.0, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[3],
    },
    {
      id: 'prod-4',
      title: 'Abonnement Internet Fibre Pro 100 Mbps (30 Jours)',
      description: 'Connexion très haut débit illimitée avec routeur Wi-Fi 6 offert en prêt. Installation et configuration par technicien certifié sous 24h à Gombe, Ngaliema ou Limete.',
      productType: 'SERVICE',
      basePriceUsd: 75,
      basePriceCdf: 213750,
      rating: 4.8,
      reviewCount: 19,
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
      store: { id: 'store-telecom', storeName: 'KinConnect Télécoms', slug: 'kin-connect', ownerId: 'usr-2', rating: 4.8, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[4],
    },
    {
      id: 'prod-5',
      title: 'Prestation Course Express Moto Dédiée (Grand Kinshasa)',
      description: 'Mise à disposition d’un motard coursier professionnel équipé pour vos colis urgents, plis confidentiels ou livraisons clients dans toutes les communes.',
      productType: 'SERVICE',
      basePriceUsd: 15,
      basePriceCdf: 42750,
      rating: 4.9,
      reviewCount: 52,
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
      store: { id: 'store-logistics', storeName: 'Kota Express Logistique', slug: 'kota-express', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[5],
    },
    {
      id: 'prod-6',
      title: 'Smartphone Tecno Camon 30 Premier 5G (512GB)',
      description: 'Triple capteur photo Sony 50MP, charge 70W ultra-rapide, écran AMOLED 120Hz. Garantie officielle Carlcare 13 mois.',
      productType: 'PHYSICAL',
      basePriceUsd: 380,
      basePriceCdf: 1083000,
      minOrderQty: 1,
      rating: 4.7,
      reviewCount: 11,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 380, unitPriceCdf: 1083000 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 360, unitPriceCdf: 1026000 },
        { minQty: 20, maxQty: null, unitPriceUsd: 345, unitPriceCdf: 983250 },
      ],
      status: 'PUBLISHED',
      stockQty: 12,
      lowStockThreshold: 5,
      images: [
        { id: 'img-tecno', url: '/src/assets/images/smartphone_camon_pro_1794567971555.jpg', altText: 'Smartphone Camon 30 Premier 5G' },
      ],
      variants: [
        { id: 'var-tecno-blk', sku: 'TEC-CAM30-BLK', name: 'Noir Sidéral 512 Go', attributes: { color: 'Noir Sidéral' }, priceOverride: 380, stockQty: 12 },
      ],
      store: { id: 'store-2', storeName: 'Kin Digital Gombe', slug: 'kin-digital', ownerId: 'usr-1', rating: 4.7, city: 'Lubumbashi', verifiedSupplier: true },
      category: categories[0],
    },
    {
      id: 'prod-7',
      title: 'Café Arabica Pur du Sud-Kivu (Lot 5 kg Torréfié)',
      description: 'Grains 100% Arabica cultivés sur les hauts plateaux d’Idjwi et Kalehe. Torréfaction artisanale moyenne, emballage hermétique avec valve de fraîcheur.',
      productType: 'PHYSICAL',
      basePriceUsd: 48,
      basePriceCdf: 136800,
      minOrderQty: 1,
      rating: 4.9,
      reviewCount: 33,
      priceTiers: [
        { minQty: 1, maxQty: 5, unitPriceUsd: 48, unitPriceCdf: 136800 },
        { minQty: 6, maxQty: 20, unitPriceUsd: 42, unitPriceCdf: 119700 },
        { minQty: 21, maxQty: null, unitPriceUsd: 37, unitPriceCdf: 105450 },
      ],
      status: 'PUBLISHED',
      stockQty: 32,
      lowStockThreshold: 5,
      images: [
        { id: 'img-kivu', url: '/src/assets/images/marketplace_parcel_default_1794567970796.jpg', altText: 'Café Arabica du Sud-Kivu' },
      ],
      variants: [
        { id: 'var-kivu-5kg', sku: 'KIVU-CAF-5KG', name: 'Sachet Pro 5 kg (Grains)', priceOverride: 48, stockQty: 32 },
      ],
      store: { id: 'store-kivu', storeName: 'Coopérative Kivu Terroir', slug: 'kivu-terroir', ownerId: 'usr-3', rating: 4.9, city: 'Goma', verifiedSupplier: true },
      category: categories[2],
    },
    {
      id: 'prod-8',
      title: 'Pack 10 Clés USB 64GB Kingston Metal + Étui',
      description: 'Clés USB 3.2 en acier brossé haute résistance pour entreprises, écoles et revendeurs. Prix unitaire ou tarif de gros négociable.',
      productType: 'PHYSICAL',
      basePriceUsd: 42,
      basePriceCdf: 119700,
      minOrderQty: 1,
      rating: 4.8,
      reviewCount: 18,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 42, unitPriceCdf: 119700 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 36, unitPriceCdf: 102600 },
        { minQty: 20, maxQty: null, unitPriceUsd: 32, unitPriceCdf: 91200 },
      ],
      status: 'PUBLISHED',
      stockQty: 45,
      lowStockThreshold: 5,
      images: [
        { id: 'img-usb', url: '/src/assets/images/usb_kingston_bundle_1794567970257.jpg', altText: 'Pack Clés USB 64GB Kingston Metal' },
      ],
      variants: [
        { id: 'var-usb-64', sku: 'USB-KNG-64-10', name: 'Pack 10 × 64 Go', priceOverride: 42, stockQty: 45 },
      ],
      store: { id: 'store-2', storeName: 'Kin Digital Gombe', slug: 'kin-digital', ownerId: 'usr-1', rating: 4.8, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[0],
    },
  ];

  const reviewsByProduct: Record<string, any[]> = {
    'prod-1': [
      {
        id: 'rev-1',
        productId: 'prod-1',
        authorName: 'Merveille Kasongo',
        city: 'Kinshasa (Lingwala)',
        rating: 5,
        comment: 'Authentique Super Wax Vlisco avec étiquette et toucher impeccable. Livré en 1h30 à Gombe.',
        verifiedPurchase: true,
        createdAt: '2026-03-04T15:20:00Z',
      },
      {
        id: 'rev-2',
        productId: 'prod-1',
        authorName: 'Cédric Ilunga',
        city: 'Lubumbashi',
        rating: 5,
        comment: 'Tarif de gros négocié à $50/pièce pour notre boutique, colis arrivé intact via fret.',
        verifiedPurchase: true,
        createdAt: '2026-02-26T11:10:00Z',
      },
    ],
    'prod-2': [
      {
        id: 'rev-3',
        productId: 'prod-2',
        authorName: 'Jean-Paul Banza',
        city: 'Kinshasa (Gombe)',
        rating: 5,
        comment: 'Finitions de couture dignes d’une grande maison. La coupe taille M est parfaite.',
        verifiedPurchase: true,
        createdAt: '2026-03-02T09:45:00Z',
      },
    ],
    'prod-3': [
      {
        id: 'rev-4',
        productId: 'prod-3',
        authorName: 'Fidèle Mulumba',
        city: 'Goma',
        rating: 5,
        comment: 'Les modèles Excel OHADA et contrats bilingues m’ont fait gagner des semaines de préparation.',
        verifiedPurchase: true,
        createdAt: '2026-03-05T18:00:00Z',
      },
    ],
  };

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

  let cart: any = {
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
      referencePoint: 'En face de l’église méthodiste',
      latitude: -4.3412,
      longitude: 15.2654,
      isDefault: false,
    },
  ];

  let orders: any[] = [
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
          storeId: 'store-1',
          status: 'SHIPPED',
          buyerName: 'David Kitenge',
          destinationCity: 'Kinshasa (Gombe)',
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
          downloadUrl: '#download-guide-pme-rdc',
          fileName: 'guide-strategie-pme-rdc-2026.pdf',
        },
      ],
      subOrders: [
        {
          id: 'sub-2',
          storeId: 'store-digital',
          status: 'DELIVERED',
          buyerName: 'David Kitenge',
          destinationCity: 'Téléchargement immédiat',
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
      total: 203.0,
      deliveryFee: 8.0,
      currency: 'USD',
      deliveryOption: deliveryOptions[1],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-3',
          storeId: 'store-1',
          status: 'PENDING',
          buyerName: 'David Kitenge',
          destinationCity: 'Lubumbashi',
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
      total: 386.5,
      deliveryFee: 6.5,
      currency: 'USD',
      deliveryOption: deliveryOptions[0],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-4',
          storeId: 'store-2',
          status: 'PENDING',
          buyerName: 'David Kitenge',
          destinationCity: 'Kinshasa (Ngaliema)',
          store: { storeName: 'Kin Digital Gombe' },
          items: [
            { id: 'item-4', quantity: 1, productTitle: 'Smartphone Tecno Camon 30 Premier 5G (512GB)', unitPrice: 380, productType: 'PHYSICAL' },
          ],
        },
      ],
    },
  ];

  let negotiations: any[] = [
    {
      id: 'neg-101',
      productId: 'prod-1',
      productTitle: 'Pagne Super Wax Vlisco Original (6 yards)',
      productImage: '/src/assets/images/wax_vlisco_fabric_1794567971042.jpg',
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
      productImage: '/src/assets/images/smartphone_camon_pro_1794567971555.jpg',
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

  let stores: any[] = [
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

  let disputes: any[] = [
    {
      id: 'disp-1',
      orderId: 'ord-0988',
      orderNumber: 'ZGO-2026-0988',
      buyerName: 'Marc Mwamba',
      storeName: 'Kin Digital Gombe',
      amountUsd: 380,
      status: 'OPEN',
      reasonCategory: 'PRODUCT_NOT_RECEIVED',
      reason: 'Retard de livraison supérieur à 48h sur smartphone vers Lubumbashi',
      description: 'Retard de livraison supérieur à 48h sur smartphone vers Lubumbashi',
      escrowAmount: 380,
      createdAt: '2026-03-08T10:00:00Z',
    },
  ];

  let notifications: any[] = [
    {
      id: 'notif-1',
      title: 'Bienvenue sur ZandoGo RDC !',
      body: 'Votre devis négocié avec Boutique Victoire Wax ($50.00/unité) a été accepté.',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      title: 'Colis ZGO-2026-1001 en transit',
      body: 'Le coursier Patrick Bolamba est en route vers Gombe avec votre commande.',
      isRead: false,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  let agentProfile: any = {
    id: 'agent-1',
    status: 'AVAILABLE',
    vehicleType: 'MOTO',
    currentLat: -4.3125,
    currentLng: 15.3088,
  };

  let pendingAgents: any[] = [
    {
      id: 'agent-pending-1',
      vehicleType: 'MOTO_YAMAHA',
      user: {
        id: 'usr-moto-2',
        fullName: 'Grace Mbuyi',
        email: 'grace.mbuyi@example.cd',
        phone: '+243819882233',
        kycDocuments: [{ id: 'k-1', status: 'APPROVED' }],
      },
    },
  ];

  let myKycDocuments: any[] = [
    { id: 'kyc-1', type: 'ID_CARD', status: 'APPROVED', createdAt: '2026-01-10T10:00:00Z' },
  ];

  let pendingKycDocuments: any[] = [
    {
      id: 'kyc-pending-1',
      type: 'VENDOR_LICENSE',
      status: 'PENDING',
      createdAt: '2026-03-11T09:30:00Z',
      user: {
        id: 'usr-vendor-new',
        fullName: 'Coopérative Kivu Terroir (Sarah Mukwege)',
        email: 'sarah@kivuterroir.cd',
        phone: '+243991234567',
      },
    },
  ];

  let deliveryJobs: any[] = [
    {
      id: 'del-1',
      status: 'IN_TRANSIT',
      estimatedFee: 6.5,
      distanceKm: 4.8,
      pickupLat: -4.321,
      pickupLng: 15.312,
      dropoffLat: -4.3015,
      dropoffLng: 15.3052,
      otpCode: '4829',
      agent: {
        id: 'agent-1',
        vehicleType: 'Moto Express Yamaha',
        user: { fullName: 'Patrick Bolamba', phone: '+243 81 988 22 33' },
      },
      trackingPings: [
        { lat: -4.321, lng: 15.312, recordedAt: new Date(Date.now() - 900000).toISOString() },
        { lat: -4.314, lng: 15.3095, recordedAt: new Date(Date.now() - 300000).toISOString() },
      ],
      subOrder: {
        store: { storeName: 'Boutique Victoire Wax', city: 'Kinshasa (Victoire)' },
        order: {
          id: 'ord-1001',
          orderNumber: 'ZGO-2026-1001',
          total: 91.5,
          currency: 'USD',
          deliveryAddress: addresses[0],
          paymentTransactions: [{ methodCode: 'MOBILE_MONEY_ORANGE', status: 'SUCCESS' }],
        },
      },
    },
  ];

  let conversations: any[] = [
    {
      id: 'conv-1',
      type: 'CUSTOMER_VENDOR',
      storeId: 'store-1',
      storeName: 'Boutique Victoire Wax',
      city: 'Kinshasa',
      productId: 'prod-1',
      productTitle: 'Pagne Super Wax Vlisco Original (6 yards)',
      productImage: '/src/assets/images/wax_vlisco_fabric_1794567971042.jpg',
      productPriceUsd: 65,
      negotiationId: 'neg-101',
      messages: [
        {
          id: 'm-1',
          conversationId: 'conv-1',
          senderId: 'usr-vendor-1',
          content:
            'Bonjour ! Nous avons bien reçu votre proposition de négociation de prix pour le lot de 10 pagnes Super Wax Vlisco.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'm-2',
          conversationId: 'conv-1',
          senderId: 'usr-vendor-1',
          content:
            'Nous pouvons vous accorder un prix spécial de $50.00 par pièce (au lieu de $65.00) avec coursier express à $3.50 vers Gombe. Le devis est prêt !',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
    },
    {
      id: 'conv-2',
      type: 'CUSTOMER_VENDOR',
      storeId: 'store-2',
      storeName: 'Kin Digital Gombe',
      city: 'Lubumbashi',
      productId: 'prod-6',
      productTitle: 'Smartphone Tecno Camon 30 Premier 5G (512GB)',
      productImage: '/src/assets/images/smartphone_camon_pro_1794567971555.jpg',
      productPriceUsd: 380,
      negotiationId: 'neg-102',
      messages: [
        {
          id: 'm-3',
          conversationId: 'conv-2',
          senderId: 'usr-vendor-2',
          content:
            'Bonjour M. Kitenge, votre demande pour 2 Tecno Camon 30 vers Lubumbashi est en cours d’étude. L’expédition sécurisée par agence aérienne coûte $12.',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    },
    {
      id: 'conv-3',
      type: 'CUSTOMER_DELIVERY',
      storeId: 'store-logistics',
      storeName: 'Patrick Bolamba · Kota Express Moto',
      city: 'Kinshasa',
      productId: 'prod-2',
      productTitle: 'Livraison Commande ZGO-2026-1001',
      productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
      productPriceUsd: 6.5,
      messages: [
        {
          id: 'm-4',
          conversationId: 'conv-3',
          senderId: 'usr-driver-1',
          content:
            'Bonjour ! J’ai récupéré votre veste Motif Kuba chez Boutique Victoire Wax. Je suis sur le Boulevard du 30 Juin, arrivée estimée dans 12 minutes.',
          createdAt: new Date(Date.now() - 600000).toISOString(),
        },
      ],
    },
  ];

  const payouts: any[] = [
    {
      id: 'pay-out-1',
      amountUsd: 420.0,
      method: 'M-Pesa Vodacom (+243 820 001 122)',
      destination: '+243820001122',
      status: 'PAID',
      createdAt: '2026-03-03T10:15:00Z',
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
        if (path === '/users/me/currency' && method === 'PATCH') {
          readBody().then((body) => {
            if (body.currency === 'USD' || body.currency === 'CDF') {
              currentUser.preferredCurrency = body.currency;
            }
            json(currentUser);
          });
          return;
        }
        if (path === '/users/me/addresses' && method === 'GET') {
          return json(addresses);
        }
        if (path === '/users/me/addresses' && method === 'POST') {
          readBody().then((body) => {
            if (body.isDefault) {
              addresses = addresses.map((a) => ({ ...a, isDefault: false }));
            }
            const newAddr = {
              id: `addr-${Date.now()}`,
              commune: body.commune || 'Gombe',
              quartier: body.quartier || 'Centre',
              referencePoint: body.referencePoint || '',
              latitude: body.latitude || -4.325,
              longitude: body.longitude || 15.322,
              isDefault: Boolean(body.isDefault) || addresses.length === 0,
            };
            addresses.unshift(newAddr);
            json(newAddr, 201);
          });
          return;
        }
        const addrDefaultMatch = path.match(/^\/users\/me\/addresses\/([^/]+)\/default$/);
        if (addrDefaultMatch && method === 'PATCH') {
          addresses = addresses.map((a) => ({ ...a, isDefault: a.id === addrDefaultMatch[1] }));
          return json(addresses);
        }
        const addrDeleteMatch = path.match(/^\/users\/me\/addresses\/([^/]+)$/);
        if (addrDeleteMatch && method === 'DELETE') {
          addresses = addresses.filter((a) => a.id !== addrDeleteMatch[1]);
          return json({ success: true });
        }

        // --- CATEGORIES ---
        if (path === '/categories' && method === 'GET') {
          return json(categories);
        }

        // --- PRODUCTS & REVIEWS ---
        if (path === '/products' && method === 'GET') {
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const search = searchParams.get('search')?.toLowerCase();
          const typeFilter = searchParams.get('type')?.toUpperCase();
          const categoryId = searchParams.get('categoryId');

          let filtered = products;
          if (search) {
            filtered = filtered.filter(
              (p) =>
                p.title.toLowerCase().includes(search) ||
                p.description?.toLowerCase().includes(search) ||
                p.store.storeName.toLowerCase().includes(search) ||
                p.store.city?.toLowerCase().includes(search),
            );
          }
          if (typeFilter && typeFilter !== 'ALL') {
            filtered = filtered.filter((p) => p.productType === typeFilter);
          }
          if (categoryId) {
            filtered = filtered.filter((p) => p.category?.id === categoryId);
          }
          return json(filtered);
        }

        const productReviewsMatch = path.match(/^\/products\/([^/]+)\/reviews$/);
        if (productReviewsMatch && method === 'GET') {
          return json(reviewsByProduct[productReviewsMatch[1]] || []);
        }
        if (productReviewsMatch && method === 'POST') {
          readBody().then((body) => {
            const pid = productReviewsMatch[1];
            const review = {
              id: `rev-${Date.now()}`,
              productId: pid,
              authorName: currentUser.fullName,
              city: addresses[0]?.commune ? `Kinshasa (${addresses[0].commune})` : 'Kinshasa',
              rating: Math.min(5, Math.max(1, Number(body.rating) || 5)),
              comment: body.comment || '',
              verifiedPurchase: true,
              createdAt: new Date().toISOString(),
            };
            reviewsByProduct[pid] = [review, ...(reviewsByProduct[pid] || [])];
            const prod = products.find((p) => p.id === pid);
            if (prod) {
              const all = reviewsByProduct[pid];
              prod.reviewCount = (prod.reviewCount || 0) + 1;
              prod.rating = Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1));
            }
            json(review, 201);
          });
          return;
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
            const foundProd = products.find((p) => p.variants.some((v: any) => v.id === body.productVariantId)) || products[0];
            const foundVar = foundProd.variants.find((v: any) => v.id === body.productVariantId) || foundProd.variants[0];
            const qty = Math.max(1, Number(body.quantity) || 1);

            const existing = cart.items.find((it: any) => it.variant?.id === foundVar.id);
            if (existing) {
              existing.quantity += qty;
            } else {
              cart.items.push({
                id: `cart-item-${Date.now()}`,
                quantity: qty,
                unitPriceSnapshot: foundVar.priceOverride || foundProd.basePriceUsd,
                variant: {
                  id: foundVar.id,
                  name: foundVar.name,
                  product: {
                    id: foundProd.id,
                    title: foundProd.title,
                    productType: foundProd.productType,
                    images: foundProd.images,
                  },
                },
              });
            }
            json(cart);
          });
          return;
        }

        const cartItemMatch = path.match(/^\/cart\/items\/([^/]+)$/);
        if (cartItemMatch && method === 'PATCH') {
          readBody().then((body) => {
            const item = cart.items.find((i: any) => i.id === cartItemMatch[1]);
            if (item) item.quantity = Math.max(1, Number(body.quantity) || 1);
            json(cart);
          });
          return;
        }
        if (cartItemMatch && method === 'DELETE') {
          cart.items = cart.items.filter((i: any) => i.id !== cartItemMatch[1]);
          return json(cart);
        }

        // --- DELIVERY ---
        if (path === '/delivery/options' && method === 'GET') {
          return json(deliveryOptions);
        }
        if (path === '/delivery/agents/me' && method === 'GET') {
          return json(agentProfile);
        }
        if (path === '/delivery/agents/me/availability' && method === 'PATCH') {
          readBody().then((body) => {
            if (body.status) agentProfile.status = body.status;
            json(agentProfile);
          });
          return;
        }
        if (path === '/delivery/agents/me/location' && method === 'PATCH') {
          readBody().then((body) => {
            if (body.lat !== undefined) agentProfile.currentLat = body.lat;
            if (body.lng !== undefined) agentProfile.currentLng = body.lng;
            json(agentProfile);
          });
          return;
        }
        if (path === '/delivery/agents/pending' && method === 'GET') {
          return json(pendingAgents);
        }
        const approveAgentMatch = path.match(/^\/delivery\/agents\/([^/]+)\/approve$/);
        if (approveAgentMatch && method === 'PATCH') {
          pendingAgents = pendingAgents.filter((a) => a.id !== approveAgentMatch[1]);
          return json({ success: true });
        }
        if ((path === '/delivery/deliveries' || path === '/delivery/deliveries/mine') && method === 'GET') {
          return json(deliveryJobs);
        }
        const deliveryByOrderMatch = path.match(/^\/delivery\/by-order\/([^/]+)$/);
        if (deliveryByOrderMatch && method === 'GET') {
          const orderId = deliveryByOrderMatch[1];
          const found = deliveryJobs.filter((d) => d.subOrder?.order?.id === orderId);
          if (found.length > 0) return json(found);
          const ord = orders.find((o) => o.id === orderId);
          if (!ord) return json([]);
          const createdJob = {
            id: `del-${orderId}`,
            status: ord.status === 'COMPLETED' ? 'DELIVERED' : 'IN_TRANSIT',
            estimatedFee: ord.deliveryFee ?? 6.5,
            distanceKm: 5.4,
            pickupLat: -4.324,
            pickupLng: 15.314,
            dropoffLat: addresses[0]?.latitude ?? -4.3015,
            dropoffLng: addresses[0]?.longitude ?? 15.3052,
            otpCode: String(1000 + Math.floor(Math.random() * 8999)),
            agent: {
              id: 'agent-1',
              vehicleType: 'Moto Express Yamaha',
              user: { fullName: 'Patrick Bolamba', phone: '+243 81 988 22 33' },
            },
            trackingPings: [
              { lat: -4.324, lng: 15.314, recordedAt: new Date(Date.now() - 600000).toISOString() },
              { lat: -4.313, lng: 15.309, recordedAt: new Date(Date.now() - 180000).toISOString() },
            ],
            subOrder: {
              store: { storeName: ord.subOrders?.[0]?.store?.storeName || 'Boutique Victoire Wax', city: 'Kinshasa' },
              order: {
                id: ord.id,
                orderNumber: ord.orderNumber,
                total: ord.total,
                currency: ord.currency,
                deliveryAddress: addresses[0],
                paymentTransactions: [{ methodCode: 'MOBILE_MONEY_MPESA', status: ord.isPaid ? 'SUCCESS' : 'PENDING' }],
              },
            },
          };
          deliveryJobs.push(createdJob);
          return json([createdJob]);
        }

        const deliveryStatusMatch = path.match(/^\/delivery\/deliveries\/([^/]+)\/status$/);
        if (deliveryStatusMatch && method === 'PATCH') {
          readBody().then((body) => {
            const job = deliveryJobs.find((j) => j.id === deliveryStatusMatch[1]);
            if (job && body.status) {
              job.status = body.status;
              if (body.status === 'IN_TRANSIT' || body.status === 'PICKED_UP') {
                agentProfile.status = 'BUSY';
              }
            }
            json(job || { success: true });
          });
          return;
        }
        const deliveryPingMatch = path.match(/^\/delivery\/deliveries\/([^/]+)\/ping$/);
        if (deliveryPingMatch && method === 'POST') {
          readBody().then((body) => {
            const job = deliveryJobs.find((j) => j.id === deliveryPingMatch[1]);
            if (job) {
              job.trackingPings = job.trackingPings || [];
              job.trackingPings.push({ lat: body.lat, lng: body.lng, recordedAt: new Date().toISOString() });
            }
            json({ success: true });
          });
          return;
        }
        const deliveryCompleteMatch = path.match(/^\/delivery\/deliveries\/([^/]+)\/complete$/);
        if (deliveryCompleteMatch && method === 'POST') {
          readBody().then(() => {
            const job = deliveryJobs.find((j) => j.id === deliveryCompleteMatch[1]);
            if (job) {
              job.status = 'DELIVERED';
              const ord = orders.find((o) => o.id === job.subOrder?.order?.id);
              if (ord) {
                ord.status = 'DELIVERED';
              }
            }
            agentProfile.status = 'AVAILABLE';
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: 'Livraison confirmée avec preuve !',
              body: `Le colis ${job?.subOrder?.order?.orderNumber || ''} a bien été remis au destinataire.`,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json({ success: true });
          });
          return;
        }

        // --- ORDERS & CHECKOUT ---
        if (path === '/orders' && method === 'GET') {
          return json(orders);
        }
        if (path === '/orders/checkout' && method === 'POST') {
          readBody().then((body) => {
            const selectedDel = deliveryOptions.find((d) => d.id === body.deliveryOptionId) || deliveryOptions[0];
            const hasDigital = cart.items.some((i: any) => i.variant?.product?.productType === 'DIGITAL');
            const onlyDigital = cart.items.length > 0 && cart.items.every((i: any) => i.variant?.product?.productType === 'DIGITAL');
            const subtotal =
              cart.items.reduce((sum: number, item: any) => sum + (Number(item.unitPriceSnapshot) || 0) * (item.quantity || 1), 0) || 65;
            const deliveryFee = onlyDigital ? 0 : selectedDel.feeUsd;
            const grandTotal = subtotal + deliveryFee;

            const digitalDownloads = cart.items
              .filter((i: any) => i.variant?.product?.productType === 'DIGITAL')
              .map((i: any) => ({
                productId: i.variant?.product?.id || 'prod-3',
                title: i.variant?.product?.title || 'Fichier Digital',
                downloadUrl: '#download-guide-pme-rdc',
                fileName: 'guide-strategie-pme-rdc-2026.pdf',
              }));

            const chosenAddr = addresses.find((a) => a.id === body.deliveryAddressId) || addresses[0];
            const newOrderId = `ord-${Date.now()}`;
            const orderNumber = `ZGO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

            const newOrder = {
              id: newOrderId,
              orderNumber,
              status: 'PENDING_PAYMENT',
              isPaid: false,
              paymentStatus: 'UNPAID',
              escrowStatus: undefined,
              createdAt: new Date().toISOString(),
              total: grandTotal,
              deliveryFee,
              currency: body.currency || 'USD',
              deliveryOption: selectedDel,
              hasDigitalItems: digitalDownloads.length > 0,
              digitalDownloads: digitalDownloads.length > 0 ? digitalDownloads : undefined,
              subOrders: [
                {
                  id: `sub-${Date.now()}`,
                  storeId: 'store-1',
                  status: 'PENDING',
                  buyerName: currentUser.fullName,
                  destinationCity: chosenAddr ? `Kinshasa (${chosenAddr.commune})` : 'Kinshasa',
                  store: { storeName: 'Boutique Victoire Wax' },
                  items: cart.items.map((it: any) => ({
                    id: it.id,
                    quantity: it.quantity,
                    productTitle: it.variant?.product?.title,
                    unitPrice: Number(it.unitPriceSnapshot),
                    productType: it.variant?.product?.productType || 'PHYSICAL',
                  })),
                },
              ],
            };

            cart.items.forEach((item: any) => {
              const p = products.find((prod) => prod.id === item.variant?.product?.id);
              if (p && p.stockQty !== undefined && p.productType === 'PHYSICAL') {
                p.stockQty = Math.max(0, p.stockQty - item.quantity);
              }
            });

            if (!onlyDigital) {
              deliveryJobs.unshift({
                id: `del-${Date.now()}`,
                status: 'ASSIGNED',
                estimatedFee: deliveryFee,
                distanceKm: 5.2,
                pickupLat: -4.321,
                pickupLng: 15.312,
                dropoffLat: chosenAddr?.latitude || -4.3015,
                dropoffLng: chosenAddr?.longitude || 15.3052,
                otpCode: String(1000 + Math.floor(Math.random() * 8999)),
                agent: {
                  id: 'agent-1',
                  vehicleType: 'Moto Express Yamaha',
                  user: { fullName: 'Patrick Bolamba', phone: '+243 81 988 22 33' },
                },
                trackingPings: [
                  { lat: -4.321, lng: 15.312, recordedAt: new Date().toISOString() },
                ],
                subOrder: {
                  store: { storeName: 'Boutique Victoire Wax', city: 'Kinshasa' },
                  order: {
                    id: newOrderId,
                    orderNumber,
                    total: grandTotal,
                    currency: body.currency || 'USD',
                    deliveryAddress: chosenAddr,
                    paymentTransactions: [{ methodCode: 'MOBILE_MONEY_MPESA', status: 'PENDING' }],
                  },
                },
              });
            }

            cart.items = [];
            orders.unshift(newOrder);

            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Commande ${orderNumber} créée`,
              body: `Montant total : $${grandTotal.toFixed(2)}. En attente de confirmation paiement.`,
              isRead: false,
              createdAt: new Date().toISOString(),
            });

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

        if (path === '/payments/initiate' && method === 'POST') {
          readBody().then((body) => {
            const ord = orders.find((o) => o.id === body.orderId);
            if (ord) {
              if (body.methodCode === 'CASH_ON_DELIVERY') {
                ord.status = 'PROCESSING';
                ord.isPaid = false;
                ord.paymentStatus = 'UNPAID';
              } else {
                ord.status = 'ESCROW_HELD';
                ord.isPaid = true;
                ord.paymentStatus = 'PAID';
                ord.escrowStatus = 'HELD';
              }
              notifications.unshift({
                id: `notif-${Date.now()}`,
                title: body.methodCode === 'CASH_ON_DELIVERY' ? 'Commande confirmée (Paiement à la livraison)' : 'Fonds sécurisés sous séquestre',
                body: `Votre commande ${ord.orderNumber} est en cours de préparation.`,
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
            json({
              status: 'SUCCESS',
              method: body.methodCode === 'CASH_ON_DELIVERY' ? 'cash_on_delivery' : body.methodCode,
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
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: 'Séquestre libéré au vendeur',
              body: `Merci d’avoir confirmé la réception de ${ord.orderNumber}.`,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
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

        // --- NEGOTIATIONS ---
        if (path === '/negotiations' && method === 'GET') {
          return json(negotiations);
        }
        if (path === '/negotiations' && method === 'POST') {
          readBody().then((body) => {
            const newNeg = {
              id: `neg-${Date.now()}`,
              productId: body.productId,
              productTitle: body.productTitle || 'Offre ZandoGo',
              productImage: body.productImage || '/src/assets/images/marketplace_parcel_default_1794567970796.jpg',
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
            conversations.unshift({
              id: `conv-${Date.now()}`,
              type: 'CUSTOMER_VENDOR',
              storeId: newNeg.storeId,
              storeName: newNeg.storeName,
              city: newNeg.destinationCity,
              productId: newNeg.productId,
              productTitle: newNeg.productTitle,
              productImage: newNeg.productImage,
              productPriceUsd: newNeg.requestedPriceUsd,
              negotiationId: newNeg.id,
              messages: [
                {
                  id: `m-${Date.now()}`,
                  conversationId: `conv-${Date.now()}`,
                  senderId: currentUser.id,
                  content: `Proposition envoyée : ${newNeg.requestedQty} pcs à $${newNeg.requestedPriceUsd}/u + transport "${newNeg.transportMode}" ($${newNeg.requestedDeliveryFeeUsd}) vers ${newNeg.destinationCity}. ${newNeg.notes || ''}`,
                  createdAt: new Date().toISOString(),
                },
              ],
            });
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
            const foundVar = foundProd.variants[0];
            const customPrice = neg.agreedPriceUsd || neg.requestedPriceUsd;
            cart.items.push({
              id: `cart-neg-${Date.now()}`,
              quantity: neg.requestedQty,
              unitPriceSnapshot: customPrice,
              variant: {
                id: foundVar.id,
                name: foundVar.name || 'Tarif Négocié',
                product: {
                  id: foundProd.id,
                  title: `${foundProd.title} (Tarif Négocié B2B)`,
                  productType: foundProd.productType,
                  images: foundProd.images,
                },
              },
            });
          }
          return json({ success: true, message: 'Offre personnalisée validée et transférée dans le panier.' });
        }

        // --- STOCK MANAGEMENT & VENDOR ORDERS ---
        const stockUpdateMatch = path.match(/^\/vendors\/stores\/([^/]+)\/products\/([^/]+)\/stock$/);
        if (stockUpdateMatch && method === 'PATCH') {
          readBody().then((body) => {
            const prod = products.find((p) => p.id === stockUpdateMatch[2]);
            if (prod) {
              if (body.stockQty !== undefined) prod.stockQty = Number(body.stockQty);
              if (body.variantId && prod.variants) {
                const v = prod.variants.find((vr: any) => vr.id === body.variantId);
                if (v && body.variantStockQty !== undefined) v.stockQty = Number(body.variantStockQty);
              }
            }
            json(prod || { success: true });
          });
          return;
        }

        const vendorOrdersMatch = path.match(/^\/vendors\/stores\/([^/]+)\/orders$/);
        if (vendorOrdersMatch && method === 'GET') {
          const storeId = vendorOrdersMatch[1];
          const matching = orders.flatMap((o) =>
            (o.subOrders || [])
              .filter((so: any) => so.storeId === storeId || storeId === 'store-1')
              .map((so: any) => ({
                ...so,
                orderId: o.id,
                orderNumber: o.orderNumber,
                orderStatus: o.status,
                isPaid: o.isPaid,
                escrowStatus: o.escrowStatus,
                total: o.total,
                currency: o.currency,
                createdAt: o.createdAt,
                deliveryOption: o.deliveryOption,
              })),
          );
          return json(matching);
        }

        const vendorOrderStatusMatch = path.match(/^\/vendors\/stores\/([^/]+)\/orders\/([^/]+)\/status$/);
        if (vendorOrderStatusMatch && method === 'PATCH') {
          readBody().then((body) => {
            orders.forEach((o) => {
              (o.subOrders || []).forEach((so: any) => {
                if (so.id === vendorOrderStatusMatch[2]) {
                  so.status = body.status;
                  if (body.status === 'SHIPPED') o.status = 'OUT_FOR_DELIVERY';
                  if (body.status === 'DELIVERED') o.status = 'DELIVERED';
                }
              });
            });
            json({ success: true });
          });
          return;
        }

        // --- WALLETS & PAYOUTS ---
        if (path === '/wallets/mine' && method === 'GET') {
          const lockedEscrowUsd = orders
            .filter((o) => o.escrowStatus === 'HELD')
            .reduce((s, o) => s + Number(o.total || 0), 0);
          const availableBalanceUsd = 1840.5;
          return json({
            storeId: 'store-1',
            availableBalanceUsd,
            lockedEscrowUsd,
            totalEarnedUsd: availableBalanceUsd + 420.0,
            currency: 'USD',
            payouts,
          });
        }
        if (path === '/wallets/payout' && method === 'POST') {
          readBody().then((body) => {
            const newPayout = {
              id: `pay-out-${Date.now()}`,
              amountUsd: Number(body.amountUsd) || 0,
              method: body.method || 'Mobile Money',
              destination: body.destination || '+243820001122',
              status: 'REQUESTED',
              createdAt: new Date().toISOString(),
            };
            payouts.unshift(newPayout);
            json(newPayout, 201);
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
              balanceUsd: 0,
              totalOrders: 0,
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
            const pType = body.productType || 'PHYSICAL';
            const fallbackImg =
              pType === 'DIGITAL'
                ? '/src/assets/images/digital_business_guide_1794397996870.jpg'
                : pType === 'SERVICE'
                ? '/src/assets/images/internet_fiber_service_1794397997131.jpg'
                : '/src/assets/images/marketplace_parcel_default_1794567970796.jpg';
            const store = stores.find((s) => s.id === vendorStoreProductsMatch[1]) || stores[0];
            const cat = categories.find((c) => c.id === body.categoryId) || categories[0];

            const newProd = {
              id: `prod-${Date.now()}`,
              title: body.title,
              description: body.description,
              productType: pType,
              basePriceUsd: Number(body.basePriceUsd),
              basePriceCdf: body.basePriceCdf || Math.round(Number(body.basePriceUsd) * exchangeRate),
              status: 'PUBLISHED',
              stockQty: body.stockQty !== undefined ? Number(body.stockQty) : 10,
              lowStockThreshold: body.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : 5,
              digitalFileName: body.digitalFileName,
              digitalFileSize: body.digitalFileSize,
              serviceDuration: body.serviceDuration,
              fulfillmentDetails: body.fulfillmentDetails,
              rating: 5.0,
              reviewCount: 0,
              images: [{ id: `img-${Date.now()}`, url: fallbackImg, altText: body.title }],
              variants: [
                {
                  id: `var-${Date.now()}`,
                  sku: `ZGO-${Date.now().toString().slice(-4)}`,
                  name: 'Standard',
                  priceOverride: Number(body.basePriceUsd),
                  stockQty: Number(body.stockQty) || 10,
                },
              ],
              store: { id: store.id, storeName: store.storeName, slug: store.slug, ownerId: 'usr-1', city: 'Kinshasa', verifiedSupplier: true },
              category: cat,
            };
            products.unshift(newProd);
            json(newProd, 201);
          });
          return;
        }

        const vendorStoreProductSingleMatch = path.match(/^\/vendors\/stores\/([^/]+)\/products\/([^/]+)$/);
        if (vendorStoreProductSingleMatch && method === 'PATCH') {
          readBody().then((body) => {
            const prod = products.find((p) => p.id === vendorStoreProductSingleMatch[2]);
            if (prod && body.status) prod.status = body.status;
            json(prod || { success: true });
          });
          return;
        }

        const vendorStoreReviewMatch = path.match(/^\/vendors\/stores\/([^/]+)\/review$/);
        if (vendorStoreReviewMatch && method === 'PATCH') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStoreReviewMatch[1]);
            if (st && body.status) st.status = body.status;
            json(st || { success: true });
          });
          return;
        }

        const vendorStoreMatch = path.match(/^\/vendors\/stores\/([^/]+)$/);
        if (vendorStoreMatch && method === 'GET') {
          const s = stores.find((st) => st.id === vendorStoreMatch[1]) || stores[0];
          return json(s);
        }

        // --- KYC ---
        if (path === '/kyc/documents/mine' && method === 'GET') {
          return json(myKycDocuments);
        }
        if (path === '/kyc/documents' && method === 'POST') {
          readBody().then((body) => {
            const doc = {
              id: `kyc-${Date.now()}`,
              type: body.type || 'ID_CARD',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            };
            myKycDocuments.unshift(doc);
            pendingKycDocuments.unshift({
              ...doc,
              user: { id: currentUser.id, fullName: currentUser.fullName, email: currentUser.email, phone: currentUser.phone },
            });
            json(doc, 201);
          });
          return;
        }
        if (path === '/kyc/documents/pending' && method === 'GET') {
          return json(pendingKycDocuments);
        }
        const kycSignedMatch = path.match(/^\/kyc\/documents\/([^/]+)\/signed-url$/);
        if (kycSignedMatch && method === 'GET') {
          const svg = encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440"><rect width="100%" height="100%" fill="#F6F4EE"/><rect x="24" y="24" width="672" height="392" rx="18" fill="#ffffff" stroke="#26735B" stroke-width="3"/><text x="56" y="88" font-family="sans-serif" font-size="22" font-weight="bold" fill="#172320">JUSTIFICATIF KYC ZANDOGO RDC</text><text x="56" y="132" font-family="monospace" font-size="14" fill="#26735B">Document ID : ${kycSignedMatch[1]}</text><text x="56" y="176" font-family="sans-serif" font-size="16" fill="#202A27">Registre Commercial & Identité Vérifiable</text><rect x="56" y="216" width="240" height="140" rx="12" fill="#172320"/><text x="86" y="292" font-family="sans-serif" font-size="18" font-weight="bold" fill="#F2B84B">SCEAU RCCM RDC</text></svg>`,
          );
          return json({ url: `data:image/svg+xml;charset=utf-8,${svg}` });
        }
        const kycReviewMatch = path.match(/^\/kyc\/documents\/([^/]+)\/review$/);
        if (kycReviewMatch && method === 'PATCH') {
          readBody().then((body) => {
            pendingKycDocuments = pendingKycDocuments.filter((d) => d.id !== kycReviewMatch[1]);
            const mine = myKycDocuments.find((d) => d.id === kycReviewMatch[1]);
            if (mine && body.status) mine.status = body.status;
            json({ success: true });
          });
          return;
        }

        // --- NOTIFICATIONS ---
        if (path === '/notifications/mine' && method === 'GET') {
          return json(notifications);
        }
        const notifReadMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
        if (notifReadMatch && method === 'PATCH') {
          const n = notifications.find((x) => x.id === notifReadMatch[1]);
          if (n) n.isRead = true;
          return json({ success: true });
        }
        if (path === '/notifications/read-all' && method === 'PATCH') {
          notifications = notifications.map((n) => ({ ...n, isRead: true }));
          return json({ success: true });
        }

        // --- FINANCE ---
        if (path === '/finance/exchange-rates' && method === 'GET') {
          return json({
            rate: exchangeRate,
            currencyPair: 'USD/CDF',
            updatedAt: rateHistory[0]?.effectiveFrom || new Date().toISOString(),
            history: rateHistory,
          });
        }
        if (path === '/finance/exchange-rates' && method === 'POST') {
          readBody().then((body) => {
            const nextRate = Number(body.rate);
            if (nextRate > 0) {
              exchangeRate = nextRate;
              rateHistory.unshift({ id: `rate-${Date.now()}`, rate: nextRate, effectiveFrom: new Date().toISOString() });
              products.forEach((p) => {
                p.basePriceCdf = Math.round(Number(p.basePriceUsd) * exchangeRate);
                if (p.priceTiers) {
                  p.priceTiers = p.priceTiers.map((t: any) => ({
                    ...t,
                    unitPriceCdf: Math.round(t.unitPriceUsd * exchangeRate),
                  }));
                }
              });
            }
            json({ rate: exchangeRate, history: rateHistory }, 201);
          });
          return;
        }

        // --- DISPUTES ---
        if (path === '/disputes' && method === 'GET') {
          return json(disputes);
        }
        if (path === '/disputes' && method === 'POST') {
          readBody().then((body) => {
            const ord = orders.find((o) => o.id === body.orderId);
            const newDispute = {
              id: `disp-${Date.now()}`,
              orderId: body.orderId,
              orderNumber: ord?.orderNumber || body.orderNumber || 'ZGO-2026',
              buyerName: currentUser.fullName,
              storeName: ord?.subOrders?.[0]?.store?.storeName || 'Boutique Partenaire',
              amountUsd: Number(ord?.total || 0),
              status: 'OPEN',
              reasonCategory: body.reasonCategory || 'OTHER',
              reason: body.description || body.reason || 'Réclamation client',
              description: body.description || body.reason || 'Réclamation client',
              escrowAmount: Number(ord?.total || 0),
              createdAt: new Date().toISOString(),
            };
            disputes.unshift(newDispute);
            if (ord) {
              ord.status = 'DISPUTED';
            }
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Litige ouvert pour ${newDispute.orderNumber}`,
              body: 'Les fonds restent bloqués sous séquestre pendant l’arbitrage (délai max 48h).',
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json(newDispute, 201);
          });
          return;
        }
        const disputeResolveMatch = path.match(/^\/disputes\/([^/]+)\/resolve$/);
        if (disputeResolveMatch && method === 'PATCH') {
          readBody().then((body) => {
            const d = disputes.find((x) => x.id === disputeResolveMatch[1]);
            if (d) {
              d.status = body.status || 'RESOLVED_REFUND';
              const ord = orders.find((o) => o.id === d.orderId || o.orderNumber === d.orderNumber);
              if (ord) {
                ord.status = body.status === 'RESOLVED_REFUND' ? 'REFUNDED' : 'COMPLETED';
                ord.escrowStatus = body.status === 'RESOLVED_REFUND' ? 'REFUNDED_TO_BUYER' : 'RELEASED_TO_VENDOR';
              }
            }
            disputes = disputes.filter((x) => x.id !== disputeResolveMatch[1]);
            json({ success: true });
          });
          return;
        }

        // --- CHAT ---
        if (path === '/chat/conversations' && method === 'GET') {
          return json(conversations);
        }
        if (path === '/chat/conversations' && method === 'POST') {
          readBody().then((body) => {
            const existing = conversations.find((c) => c.storeId === body.storeId || c.productId === body.productId);
            if (existing) return json(existing);
            const conv = {
              id: `conv-${Date.now()}`,
              type: body.type || 'CUSTOMER_VENDOR',
              storeId: body.storeId || 'store-1',
              storeName: body.storeName || 'Boutique Partenaire ZandoGo',
              city: 'Kinshasa',
              productId: body.productId,
              productTitle: body.productTitle || 'Demande d’information produit',
              productImage: body.productImage || '/src/assets/images/marketplace_parcel_default_1794567970796.jpg',
              productPriceUsd: body.productPriceUsd,
              messages: [
                {
                  id: `m-${Date.now()}`,
                  conversationId: `conv-${Date.now()}`,
                  senderId: 'usr-vendor-1',
                  content: 'Bonjour ! Comment pouvons-nous vous aider concernant cette offre ?',
                  createdAt: new Date().toISOString(),
                },
              ],
            };
            conversations.unshift(conv);
            json(conv, 201);
          });
          return;
        }
        const chatMsgMatch = path.match(/^\/chat\/conversations\/([^/]+)\/messages$/);
        if (chatMsgMatch && method === 'POST') {
          readBody().then((body) => {
            const conv = conversations.find((c) => c.id === chatMsgMatch[1]);
            const msg = {
              id: `m-${Date.now()}`,
              conversationId: chatMsgMatch[1],
              senderId: currentUser.id,
              content: body.content || '',
              createdAt: new Date().toISOString(),
            };
            if (conv) conv.messages.push(msg);
            json(msg, 201);
          });
          return;
        }

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
