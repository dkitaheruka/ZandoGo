import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function mockApiPlugin(): Plugin {
  let exchangeRate = 2850;
  const rateHistory = [
    { id: 'rate-2', rate: 2850, effectiveFrom: new Date().toISOString() },
    { id: 'rate-1', rate: 2800, effectiveFrom: '2026-02-15T08:00:00Z' },
  ];

  let platformPricing = {
    storeCreationFeeUsd: 15,
    servicePhysicalFeeUsd: 15,
    serviceDigitalFeeUsd: 10,
    servicePrestationFeeUsd: 20,
    certificationMonthlyFeeUsd: 15,
    certificationQuarterlyFeeUsd: 39,
    adEssentialMonthlyFeeUsd: 29,
    adProCarouselMonthlyFeeUsd: 59,
    defaultCommissionPercent: 5,
    paymentTransactionFeePercent: 3.5,
    allowImmediateVendorWithdrawal: false,
    updatedAt: new Date().toISOString(),
  };

  function getServiceModuleFeeUsd(service: string): number {
    if (service === 'DIGITAL') return Number(platformPricing.serviceDigitalFeeUsd || 0);
    if (service === 'SERVICE') return Number(platformPricing.servicePrestationFeeUsd || 0);
    return Number(platformPricing.servicePhysicalFeeUsd || 0);
  }

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
  }

  function buildRealPdfBuffer(title: string, orderNumber: string, fileName: string): Buffer {
    const sanitize = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[()\\]/g, ' ')
        .replace(/[^\x20-\x7E]/g, ' ');
    const safeTitle = sanitize(title).slice(0, 72);
    const safeOrder = sanitize(orderNumber);
    const safeFile = sanitize(fileName);
    const streamContent = [
      'BT',
      '/F1 18 Tf',
      '50 750 Td',
      '(ZANDOGO RDC - EDITION NUMERIQUE OFFICIELLE) Tj',
      '0 -32 Td',
      '/F1 13 Tf',
      `(${safeTitle}) Tj`,
      '0 -26 Td',
      '/F1 11 Tf',
      `(Commande certifiee : ${safeOrder} | Fichier : ${safeFile}) Tj`,
      '0 -22 Td',
      '(Paiement Airtel, M-Pesa, Orange, MTN ou Visa valide & envoi automatique ZandoGo Goma.) Tj',
      '0 -34 Td',
      '(SOMMAIRE EXECUTIF :) Tj',
      '0 -20 Td',
      '(1. Cadre juridique OHADA et immatriculation RCCM en RDC) Tj',
      '0 -18 Td',
      '(2. Gestion de tresorerie bi-monnaie USD / CDF et taux de change) Tj',
      '0 -18 Td',
      '(3. Fiscalite PME, DGI, TVA et obligations sociales CNSS / INPP) Tj',
      '0 -18 Td',
      '(4. Modeles de contrats commerciaux et logistique multi-provinces) Tj',
      'ET',
    ].join('\n');

    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${Buffer.byteLength(streamContent, 'utf8')} >> stream\n${streamContent}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += obj + '\n';
    }
    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    return Buffer.from(pdf, 'utf8');
  }

  const categories = [
    { id: 'cat-1', name: 'Électronique & High-Tech' },
    { id: 'cat-2', name: 'Habits & Mode — Femme' },
    { id: 'cat-7', name: 'Habits & Mode — Homme' },
    { id: 'cat-3', name: 'Alimentation & Terroir Kivu' },
    { id: 'cat-4', name: 'Livres & Documents PDF' },
    { id: 'cat-5', name: 'Services & Télécoms' },
    { id: 'cat-6', name: 'Transport & Coursiers (au km)' },
  ];

  const deliveryOptions = [
    {
      id: 'del-opt-express',
      providerName: 'Nyiragongo Express Moto',
      code: 'EXPRESS_MOTO',
      name: 'Coursier Moto Express Goma (Tarif négociable + GPS)',
      estimatedTime: '30 à 90 minutes',
      feeUsd: 3.5,
      feeCdf: 9975,
      description: 'Livraison express à Goma (Himbi, Les Volcans, Katindo, Ndosho, Karisimbi). Partagez votre point Google Maps et négociez le tarif avec le livreur.',
      badgeText: 'Express Goma',
    },
    {
      id: 'del-opt-partner',
      providerName: 'KivuLog Fret Lac Kivu & RDC',
      code: 'PARTNER_LOGISTICS',
      name: 'Fret Interurbain Nord/Sud-Kivu & RDC',
      estimatedTime: '24 à 48 heures',
      feeUsd: 8.0,
      feeCdf: 22800,
      description: 'Liaison sécurisée Goma ↔ Bukavu ↔ Butembo ↔ Beni ↔ Sake ↔ Lubumbashi ↔ Kisangani ↔ Kinshasa.',
      badgeText: 'Kivu & National',
    },
    {
      id: 'del-opt-pickup',
      providerName: 'Hub ZandoGo Goma / Dépôt Vendeur',
      code: 'CLICK_AND_COLLECT',
      name: 'Retrait en Hub Goma ou Boutique (Click & Collect)',
      estimatedTime: 'Disponible dès aujourd’hui',
      feeUsd: 0,
      feeCdf: 0,
      description: 'Retrait sans frais au dépôt du vendeur à Goma (Centre / Himbi / Karisimbi) ou au point relais ZandoGo.',
      badgeText: 'Gratuit',
    },
  ];

  let products: any[] = [
    {
      id: 'prod-1',
      title: 'Pagne Super Wax Vlisco Original (6 yards)',
      description: 'Véritable wax hollandais de qualité premium, motifs vibrants disponibles à Goma (Nord-Kivu). 100% coton peigné.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'WOMEN',
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
      stockQty: 27,
      lowStockThreshold: 5,
      images: [
        { id: 'img-1', url: '/src/assets/images/wax_vlisco_fabric_1794567971042.jpg', altText: 'Pagne Super Wax Vlisco Original' },
      ],
      variants: [
        { id: 'var-1', sku: 'WAX-VLI-01', name: 'Émeraude / Safran · 6 yards', attributes: { size: '6 yards', color: 'Émeraude & Safran', colorHex: '#26735B' }, priceOverride: 65, stockQty: 18 },
        { id: 'var-1b', sku: 'WAX-VLI-02', name: 'Bordeaux Royal · 6 yards', attributes: { size: '6 yards', color: 'Bordeaux Wax', colorHex: '#B84C43' }, priceOverride: 68, stockQty: 9 },
        { id: 'var-1c', sku: 'WAX-VLI-03', name: 'Indigo Nuit · 12 yards', attributes: { size: '12 yards', color: 'Indigo Nuit', colorHex: '#172320' }, priceOverride: 120, stockQty: 6 },
      ],
      store: { id: 'store-1', storeName: 'Boutique Virunga Wax', slug: 'virunga-wax', ownerId: 'usr-1', rating: 4.9, city: 'Goma (Himbi)', verifiedSupplier: true },
      category: categories[1],
    },
    {
      id: 'prod-2',
      title: 'Veste Tailleur Haute Couture Motif Kuba — Homme',
      description: 'Confection artisanale exclusive en lin et coton imprimé aux motifs royaux Kuba. Doublure satinée respirante, boutons en corne naturelle.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'MEN',
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
      stockQty: 12,
      lowStockThreshold: 5,
      images: [
        { id: 'img-kuba', url: '/src/assets/images/fashion_jacket_kuba_1794397997636.jpg', altText: 'Veste Kuba Haute Couture' },
      ],
      variants: [
        { id: 'var-kuba-m', sku: 'JKT-KUBA-M-N', name: 'M · Nuit Kuba', attributes: { size: 'M', color: 'Nuit Kuba', colorHex: '#172320' }, priceOverride: 85, stockQty: 5 },
        { id: 'var-kuba-l', sku: 'JKT-KUBA-L-N', name: 'L · Nuit Kuba', attributes: { size: 'L', color: 'Nuit Kuba', colorHex: '#172320' }, priceOverride: 85, stockQty: 4 },
        { id: 'var-kuba-xl', sku: 'JKT-KUBA-XL-S', name: 'XL · Safran & Terre', attributes: { size: 'XL', color: 'Safran & Terre', colorHex: '#F2B84B' }, priceOverride: 88, stockQty: 3 },
      ],
      store: { id: 'store-1', storeName: 'Boutique Virunga Wax', slug: 'virunga-wax', ownerId: 'usr-1', rating: 4.9, city: 'Goma (Himbi)', verifiedSupplier: true },
      category: categories[2],
    },
    {
      id: 'prod-9',
      title: 'Robe Portefeuille Wax Contemporaine — Femme',
      description: 'Coupe cintrée élégante confectionnée à Goma avec véritable pagne Wax et finitions tailleur. Idéale bureau et cérémonies.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'WOMEN',
      basePriceUsd: 54,
      basePriceCdf: 153900,
      minOrderQty: 1,
      rating: 4.9,
      reviewCount: 21,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 54, unitPriceCdf: 153900 },
        { minQty: 5, maxQty: 14, unitPriceUsd: 47, unitPriceCdf: 133950 },
        { minQty: 15, maxQty: null, unitPriceUsd: 41, unitPriceCdf: 116850 },
      ],
      status: 'PUBLISHED',
      stockQty: 24,
      lowStockThreshold: 5,
      images: [
        { id: 'img-robe-wax', url: '/src/assets/images/robe_wax_femme_1794575464194.jpg', altText: 'Robe Portefeuille Wax Femme' },
      ],
      variants: [
        { id: 'var-robe-s-em', sku: 'ROBE-S-EM', name: 'S · Émeraude', attributes: { size: 'S', color: 'Émeraude', colorHex: '#26735B' }, priceOverride: 54, stockQty: 6 },
        { id: 'var-robe-m-em', sku: 'ROBE-M-EM', name: 'M · Émeraude', attributes: { size: 'M', color: 'Émeraude', colorHex: '#26735B' }, priceOverride: 54, stockQty: 8 },
        { id: 'var-robe-l-saf', sku: 'ROBE-L-SAF', name: 'L · Safran Soleil', attributes: { size: 'L', color: 'Safran Soleil', colorHex: '#F2B84B' }, priceOverride: 54, stockQty: 6 },
        { id: 'var-robe-xl-wax', sku: 'ROBE-XL-WAX', name: 'XL · Rouge Terracotta', attributes: { size: 'XL', color: 'Rouge Terracotta', colorHex: '#B84C43' }, priceOverride: 56, stockQty: 4 },
      ],
      store: { id: 'store-1', storeName: 'Boutique Virunga Wax', slug: 'virunga-wax', ownerId: 'usr-1', rating: 4.9, city: 'Goma (Himbi)', verifiedSupplier: true },
      category: categories[1],
    },
    {
      id: 'prod-10',
      title: 'Chemise en Lin Col Mao Brodé — Homme',
      description: 'Chemise respirante 100% lin naturel avec broderie géométrique congolaise discrète au col et poignets.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'MEN',
      basePriceUsd: 45,
      basePriceCdf: 128250,
      minOrderQty: 1,
      rating: 4.8,
      reviewCount: 16,
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 45, unitPriceCdf: 128250 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 39, unitPriceCdf: 111150 },
        { minQty: 20, maxQty: null, unitPriceUsd: 34, unitPriceCdf: 96900 },
      ],
      status: 'PUBLISHED',
      stockQty: 22,
      lowStockThreshold: 5,
      images: [
        { id: 'img-chemise-lin', url: '/src/assets/images/chemise_lin_homme_1794575463772.jpg', altText: 'Chemise Lin Col Mao Homme' },
      ],
      variants: [
        { id: 'var-chem-m-ivoire', sku: 'CHM-M-IV', name: 'M · Ivoire Lin', attributes: { size: 'M', color: 'Ivoire Lin', colorHex: '#E8E2D5' }, priceOverride: 45, stockQty: 8 },
        { id: 'var-chem-l-ivoire', sku: 'CHM-L-IV', name: 'L · Ivoire Lin', attributes: { size: 'L', color: 'Ivoire Lin', colorHex: '#E8E2D5' }, priceOverride: 45, stockQty: 6 },
        { id: 'var-chem-xl-seve', sku: 'CHM-XL-SV', name: 'XL · Vert Sève', attributes: { size: 'XL', color: 'Vert Sève', colorHex: '#26735B' }, priceOverride: 45, stockQty: 5 },
        { id: 'var-chem-xxl-nuit', sku: 'CHM-XXL-NT', name: 'XXL · Noir Nuit', attributes: { size: 'XXL', color: 'Noir Nuit', colorHex: '#172320' }, priceOverride: 47, stockQty: 3 },
      ],
      store: { id: 'store-1', storeName: 'Boutique Virunga Wax', slug: 'virunga-wax', ownerId: 'usr-1', rating: 4.9, city: 'Goma (Himbi)', verifiedSupplier: true },
      category: categories[2],
    },
    {
      id: 'prod-3',
      title: 'Guide d’Investissement & Stratégie PME RDC (Livre PDF)',
      description: 'Livre numérique de 142 pages rédigé par des experts fiduciaires de Goma & RDC : fiscalité OHADA, grille salariale locale et modèles de contrats. Téléchargement direct après paiement.',
      productType: 'DIGITAL',
      pricingUnit: 'UNIT',
      audience: 'PRO',
      basePriceUsd: 29,
      basePriceCdf: 82650,
      rating: 5.0,
      reviewCount: 41,
      status: 'PUBLISHED',
      stockQty: 9999,
      digitalFileUrl: '/api/downloads/prod-3/ord-1002',
      digitalFileName: 'guide-strategie-pme-rdc-2026.pdf',
      digitalFileSize: '18.4 Mo',
      images: [
        { id: 'img-guide', url: '/src/assets/images/digital_business_guide_1794397996870.jpg', altText: 'Guide Digital Business RDC' },
      ],
      variants: [
        { id: 'var-guide-pdf', sku: 'DIGI-GUIDE-PDF', name: 'Édition Complète PDF + Modèles', attributes: { size: 'PDF 142 pages' }, priceOverride: 29, stockQty: 9999 },
      ],
      store: { id: 'store-digital', storeName: 'Kivu Business Insights', slug: 'kivu-insights', ownerId: 'usr-1', rating: 5.0, city: 'Goma (Centre)', verifiedSupplier: true },
      category: categories[4],
    },
    {
      id: 'prod-4',
      title: 'Abonnement Internet Fibre Pro 100 Mbps (30 Jours)',
      description: 'Connexion très haut débit illimitée avec routeur Wi-Fi 6 offert en prêt. Installation et configuration par technicien certifié sous 24h à Himbi, Les Volcans, Katindo ou Karisimbi (Goma).',
      productType: 'SERVICE',
      pricingUnit: 'FLAT',
      audience: 'PRO',
      basePriceUsd: 75,
      basePriceCdf: 213750,
      rating: 4.8,
      reviewCount: 19,
      status: 'PUBLISHED',
      stockQty: 50,
      serviceDuration: 'Forfait mensuel (30 jours)',
      fulfillmentDetails: 'Prise de contact téléphonique du technicien sous 2 heures après commande.',
      images: [
        { id: 'img-fiber', url: '/src/assets/images/internet_fiber_service_1794397997131.jpg', altText: 'Internet Fibre Pro Goma' },
      ],
      variants: [
        { id: 'var-fiber-100', sku: 'SRV-FIBER-100', name: 'Forfait 100 Mbps Illimité', attributes: { capacity: '100 Mbps' }, priceOverride: 75, stockQty: 50 },
      ],
      store: { id: 'store-telecom', storeName: 'GomaConnect Télécoms', slug: 'goma-connect', ownerId: 'usr-2', rating: 4.8, city: 'Goma (Katindo)', verifiedSupplier: true },
      category: categories[5],
    },
    {
      id: 'prod-5',
      title: 'Transport & Course Express Moto Dédiée (Tarif au km)',
      description: 'Prestation de transport urbain et livraison de colis à la demande dans le Grand Goma (Nord-Kivu). Tarif calculé au kilomètre réel via Google Maps avec suivi GPS du coursier.',
      productType: 'SERVICE',
      pricingUnit: 'KM',
      audience: 'PRO',
      basePriceUsd: 1.5,
      basePriceCdf: 4275,
      minOrderQty: 2,
      rating: 4.9,
      reviewCount: 52,
      priceTiers: [
        { minQty: 1, maxQty: 5, unitPriceUsd: 1.5, unitPriceCdf: 4275 },
        { minQty: 6, maxQty: 15, unitPriceUsd: 1.25, unitPriceCdf: 3562 },
        { minQty: 16, maxQty: null, unitPriceUsd: 1.0, unitPriceCdf: 2850 },
      ],
      status: 'PUBLISHED',
      stockQty: 99,
      serviceDuration: 'Facturation au km parcouru',
      fulfillmentDetails: 'Partagez votre position Google Maps après commande · Prise en charge sous 25 min.',
      images: [
        { id: 'img-courier', url: '/src/assets/images/express_courier_moto_1794397998233.jpg', altText: 'Coursier Moto Express au km' },
      ],
      variants: [
        { id: 'var-moto-course', sku: 'LOG-MOTO-KM', name: 'Moto Express (-15 kg) · par km', attributes: { capacity: 'Jusqu’à 15 kg' }, priceOverride: 1.5, stockQty: 99 },
        { id: 'var-van-course', sku: 'LOG-VAN-KM', name: 'Fourgonnette Urbaine (-350 kg) · par km', attributes: { capacity: 'Jusqu’à 350 kg' }, priceOverride: 2.8, stockQty: 20 },
      ],
      store: { id: 'store-logistics', storeName: 'Nyiragongo Express Logistique', slug: 'nyiragongo-express', ownerId: 'usr-1', rating: 4.9, city: 'Goma (Birere)', verifiedSupplier: true },
      category: categories[6],
    },
    {
      id: 'prod-6',
      title: 'Smartphone Tecno Camon 30 Premier 5G (512GB)',
      description: 'Triple capteur photo Sony 50MP, charge 70W ultra-rapide, écran AMOLED 120Hz. Garantie officielle Carlcare 13 mois.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'UNISEX',
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
      stockQty: 18,
      lowStockThreshold: 5,
      images: [
        { id: 'img-tecno', url: '/src/assets/images/smartphone_camon_pro_1794567971555.jpg', altText: 'Smartphone Camon 30 Premier 5G' },
      ],
      variants: [
        { id: 'var-tecno-blk', sku: 'TEC-CAM30-BLK', name: '512 Go · Noir Sidéral', attributes: { size: '512 Go', color: 'Noir Sidéral', colorHex: '#172320', capacity: '512 Go' }, priceOverride: 380, stockQty: 12 },
        { id: 'var-tecno-slv', sku: 'TEC-CAM30-SLV', name: '256 Go · Argent Alpes', attributes: { size: '256 Go', color: 'Argent Alpes', colorHex: '#CBD5E1', capacity: '256 Go' }, priceOverride: 345, stockQty: 6 },
      ],
      store: { id: 'store-2', storeName: 'Kivu Digital & Tech', slug: 'kivu-digital', ownerId: 'usr-1', rating: 4.7, city: 'Goma (Les Volcans)', verifiedSupplier: true },
      category: categories[0],
    },
    {
      id: 'prod-7',
      title: 'Café Arabica Pur du Sud-Kivu (Lot 5 kg Torréfié)',
      description: 'Grains 100% Arabica cultivés sur les hauts plateaux d’Idjwi et Kalehe. Torréfaction artisanale moyenne, emballage hermétique avec valve de fraîcheur.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'UNISEX',
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
        { id: 'var-kivu-5kg', sku: 'KIVU-CAF-5KG', name: 'Sachet Pro 5 kg (Grains)', attributes: { size: '5 kg' }, priceOverride: 48, stockQty: 32 },
        { id: 'var-kivu-1kg', sku: 'KIVU-CAF-1KG', name: 'Sachet 1 kg (Moulu)', attributes: { size: '1 kg' }, priceOverride: 12, stockQty: 40 },
      ],
      store: { id: 'store-kivu', storeName: 'Coopérative Kivu Terroir', slug: 'kivu-terroir', ownerId: 'usr-3', rating: 4.9, city: 'Goma (Lac Vert)', verifiedSupplier: true },
      category: categories[3],
    },
    {
      id: 'prod-8',
      title: 'Pack 10 Clés USB 64GB Kingston Metal + Étui',
      description: 'Clés USB 3.2 en acier brossé haute résistance pour entreprises, écoles et revendeurs. Prix unitaire ou tarif de gros négociable.',
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'PRO',
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
        { id: 'var-usb-64', sku: 'USB-KNG-64-10', name: 'Pack 10 × 64 Go (Argent)', attributes: { size: '64 Go', color: 'Acier Argent', colorHex: '#94A3B8' }, priceOverride: 42, stockQty: 45 },
      ],
      store: { id: 'store-2', storeName: 'Kivu Digital & Tech', slug: 'kivu-digital', ownerId: 'usr-1', rating: 4.8, city: 'Goma (Les Volcans)', verifiedSupplier: true },
      category: categories[0],
    },
  ];

  const reviewsByProduct: Record<string, any[]> = {
    'prod-1': [
      {
        id: 'rev-1',
        productId: 'prod-1',
        authorName: 'Merveille Kasongo',
        city: 'Goma (Les Volcans)',
        rating: 5,
        comment: 'Authentique Super Wax Vlisco avec étiquette et toucher impeccable. Livré en 45 min à Himbi.',
        verifiedPurchase: true,
        createdAt: '2026-03-04T15:20:00Z',
      },
      {
        id: 'rev-2',
        productId: 'prod-1',
        authorName: 'Cédric Ilunga',
        city: 'Bukavu (Sud-Kivu)',
        rating: 5,
        comment: 'Tarif de gros négocié à $50/pièce pour notre boutique, colis arrivé intact via le Lac Kivu.',
        verifiedPurchase: true,
        createdAt: '2026-02-26T11:10:00Z',
      },
    ],
    'prod-2': [
      {
        id: 'rev-3',
        productId: 'prod-2',
        authorName: 'Jean-Paul Banza',
        city: 'Goma (Himbi)',
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
        city: 'Goma (Karisimbi)',
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

  let addresses: any[] = [
    {
      id: 'addr-1',
      email: 'david.kitenge@example.cd',
      commune: 'Goma',
      quartier: 'Himbi',
      ville: 'Goma (Nord-Kivu)',
      referencePoint: 'Avenue du Tourisme, proche de l’Hôtel Ihusi & Lac Kivu',
      latitude: -1.6815,
      longitude: 29.2115,
      isDefault: true,
    },
    {
      id: 'addr-2',
      email: 'david.kitenge@example.cd',
      commune: 'Karisimbi',
      quartier: 'Ndosho',
      ville: 'Goma (Nord-Kivu)',
      referencePoint: 'Boulevard Kanyamuhanga / Rond-Point Terminus Ndosho',
      latitude: -1.646,
      longitude: 29.208,
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
      paymentGateway: 'MOBILE_MONEY',
      paymentOperator: 'MOBILE_MONEY_ORANGE',
      paymentRef: 'ZG-PAY-261001',
      escrowStatus: 'HELD',
      createdAt: new Date().toISOString(),
      total: 88.5,
      deliveryFee: 3.5,
      currency: 'USD',
      deliveryOption: deliveryOptions[0],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-1',
          storeId: 'store-1',
          status: 'SHIPPED',
          buyerName: 'David Kitenge',
          destinationCity: 'Goma (Himbi)',
          store: { storeName: 'Boutique Virunga Wax' },
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
          title: 'Guide d’Investissement & Stratégie PME RDC (Livre PDF)',
          downloadUrl: '/api/downloads/prod-3/ord-1002?token=zg-auto-1002',
          fileName: 'guide-strategie-pme-rdc-2026.pdf',
          token: 'zg-auto-1002',
          autoDispatched: true,
          autoDispatchedAt: '2026-03-01T14:30:05Z',
        },
      ],
      paymentGateway: 'MOBILE_MONEY',
      paymentOperator: 'MOBILE_MONEY_AIRTEL',
      paymentRef: 'ZG-PAY-88421',
      noDeliveryNeeded: true,
      subOrders: [
        {
          id: 'sub-2',
          storeId: 'store-digital',
          status: 'DELIVERED',
          autoFulfilled: true,
          buyerName: 'David Kitenge',
          destinationCity: 'Envoi automatique du lien PDF',
          store: { storeName: 'Kivu Business Insights' },
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
          destinationCity: 'Bukavu (Sud-Kivu)',
          store: { storeName: 'Boutique Virunga Wax' },
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
      deliveryNegotiationStatus: 'PENDING_DRIVER',
      createdAt: '2026-03-11T08:10:00Z',
      total: 383.5,
      deliveryFee: 3.5,
      currency: 'USD',
      deliveryOption: deliveryOptions[0],
      deliveryAddress: addresses[1],
      hasDigitalItems: false,
      subOrders: [
        {
          id: 'sub-4',
          storeId: 'store-2',
          status: 'PENDING',
          buyerName: 'David Kitenge',
          destinationCity: 'Goma (Karisimbi — Ndosho)',
          store: { storeName: 'Kivu Digital & Tech' },
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
      storeName: 'Boutique Virunga Wax',
      buyerId: 'usr-1',
      buyerName: 'David Kitenge',
      requestedQty: 10,
      requestedPriceUsd: 48,
      agreedPriceUsd: 50,
      transportMode: 'Coursier Express Goma',
      requestedDeliveryFeeUsd: 3.0,
      agreedDeliveryFeeUsd: 3.5,
      destinationCity: 'Goma (Les Volcans)',
      currency: 'USD',
      status: 'ACCEPTED_BY_VENDOR',
      notes: 'Commande de 10 pièces avec livraison groupée au bureau à Goma.',
      createdAt: '2026-03-09T11:20:00Z',
      updatedAt: '2026-03-09T14:45:00Z',
    },
    {
      id: 'neg-102',
      productId: 'prod-6',
      productTitle: 'Smartphone Tecno Camon 30 Premier 5G (512GB)',
      productImage: '/src/assets/images/smartphone_camon_pro_1794567971555.jpg',
      storeId: 'store-2',
      storeName: 'Kivu Digital & Tech',
      buyerId: 'usr-1',
      buyerName: 'David Kitenge',
      requestedQty: 2,
      requestedPriceUsd: 340,
      agreedPriceUsd: null,
      transportMode: 'Bateau Express / Fret Lac Kivu (Goma → Bukavu)',
      requestedDeliveryFeeUsd: 10.0,
      agreedDeliveryFeeUsd: null,
      destinationCity: 'Bukavu (Sud-Kivu)',
      currency: 'USD',
      status: 'PENDING_VENDOR_REVIEW',
      notes: 'Envoi sécurisé depuis Goma vers Bukavu par agence partenaire.',
      createdAt: '2026-03-10T09:15:00Z',
      updatedAt: '2026-03-10T09:15:00Z',
    },
  ];

  let stores: any[] = [
    {
      id: 'store-1',
      ownerId: 'usr-1',
      storeName: 'Boutique Virunga Wax',
      slug: 'virunga-wax',
      storeType: 'RETAIL',
      enabledServices: ['PHYSICAL'],
      serviceFeesPaidUsd: { PHYSICAL: 15 },
      description: 'Maison de couture et grossiste de pagnes et tissus haut de gamme à Goma (Nord-Kivu).',
      status: 'ACTIVE',
      fulfillmentMode: 'PLATFORM_DELIVERY',
      commissionRate: 5,
      balanceUsd: 1840.5,
      totalOrders: 142,
      payoutBlocked: false,
      payoutBlockReason: null,
      isCertified: true,
      certificationStatus: 'ACTIVE',
      certificationFeeUsd: 15,
      certifiedUntil: '2026-12-31T23:59:59Z',
      hasMonthlyAd: true,
      monthlyAdPlan: 'PRO_CAROUSEL_59',
      monthlyAdFeeUsd: 59,
      monthlyAdUntil: '2026-12-15T23:59:59Z',
      createdAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'store-2',
      ownerId: 'usr-1',
      storeName: 'Kivu Digital & Tech',
      slug: 'kivu-digital',
      storeType: 'RETAIL',
      enabledServices: ['PHYSICAL', 'SERVICE'],
      serviceFeesPaidUsd: { PHYSICAL: 15, SERVICE: 20 },
      description: 'Importateur officiel smartphones, informatique et accessoires high-tech à Goma, Bukavu & Butembo.',
      status: 'ACTIVE',
      fulfillmentMode: 'PLATFORM_DELIVERY',
      commissionRate: 5,
      balanceUsd: 2640.0,
      totalOrders: 98,
      payoutBlocked: false,
      payoutBlockReason: null,
      isCertified: true,
      certificationStatus: 'ACTIVE',
      certificationFeeUsd: 15,
      certifiedUntil: '2026-12-31T23:59:59Z',
      hasMonthlyAd: true,
      monthlyAdPlan: 'PRO_CAROUSEL_59',
      monthlyAdFeeUsd: 59,
      monthlyAdUntil: '2026-12-20T23:59:59Z',
      createdAt: '2026-01-18T10:00:00Z',
    },
    {
      id: 'store-digital',
      ownerId: 'usr-1',
      storeName: 'Kivu Business Insights',
      slug: 'kivu-insights',
      storeType: 'DIGITAL',
      enabledServices: ['DIGITAL'],
      serviceFeesPaidUsd: { DIGITAL: 10 },
      description: 'Vente d’études sectorielles, templates contractuels et e-books pour entrepreneurs à Goma & RDC.',
      status: 'ACTIVE',
      fulfillmentMode: 'DIRECT_DOWNLOAD',
      commissionRate: 5,
      balanceUsd: 870.0,
      totalOrders: 65,
      payoutBlocked: false,
      payoutBlockReason: null,
      isCertified: true,
      certificationStatus: 'ACTIVE',
      certificationFeeUsd: 15,
      certifiedUntil: '2026-12-31T23:59:59Z',
      hasMonthlyAd: false,
      monthlyAdPlan: 'NONE',
      monthlyAdFeeUsd: 0,
      monthlyAdUntil: null,
      createdAt: '2026-02-10T11:00:00Z',
    },
    {
      id: 'store-telecom',
      ownerId: 'usr-2',
      storeName: 'GomaConnect Télécoms',
      slug: 'goma-connect',
      storeType: 'SERVICES',
      enabledServices: ['SERVICE'],
      serviceFeesPaidUsd: { SERVICE: 20 },
      description: 'Opérateur télécom agréé à Goma : forfaits data, fibre optique professionnelle et assistance réseau.',
      status: 'ACTIVE',
      fulfillmentMode: 'SERVICE_APPOINTMENT',
      commissionRate: 5,
      balanceUsd: 3250.0,
      totalOrders: 89,
      payoutBlocked: false,
      payoutBlockReason: null,
      isCertified: false,
      certificationStatus: 'NONE',
      certificationFeeUsd: 0,
      certifiedUntil: null,
      hasMonthlyAd: false,
      monthlyAdPlan: 'NONE',
      monthlyAdFeeUsd: 0,
      monthlyAdUntil: null,
      createdAt: '2026-01-20T09:00:00Z',
    },
    {
      id: 'store-logistics',
      ownerId: 'usr-1',
      storeName: 'Nyiragongo Express Logistique',
      slug: 'nyiragongo-express',
      storeType: 'LOGISTICS',
      isTransportAgency: true,
      transportDestinations: [
        { id: 'td-1', originCity: 'Goma', destinationCity: 'Bukavu', basePriceUsd: 10, pricePerKmUsd: 0.45, estimatedDelay: '3h (Bateau / Route)', vehicleMode: 'Bateau Express / Fourgon' },
        { id: 'td-2', originCity: 'Goma', destinationCity: 'Butembo & Beni', basePriceUsd: 14, pricePerKmUsd: 0.40, estimatedDelay: '18 à 24h', vehicleMode: 'Bus & Cargo Nord-Kivu' },
        { id: 'td-3', originCity: 'Goma', destinationCity: 'Kinshasa', basePriceUsd: 25, pricePerKmUsd: 0.65, estimatedDelay: '24 à 48h (Cargo aérien)', vehicleMode: 'Fret Aérien Express' },
        { id: 'td-4', originCity: 'Goma', destinationCity: 'Lubumbashi', basePriceUsd: 22, pricePerKmUsd: 0.55, estimatedDelay: '48h', vehicleMode: 'Fret Aérien / Routier' },
        { id: 'td-5', originCity: 'Goma', destinationCity: 'Gisenyi / Kigali', basePriceUsd: 9, pricePerKmUsd: 0.35, estimatedDelay: '4h', vehicleMode: 'Navette Transfrontalière' },
      ],
      enabledServices: ['SERVICE'],
      serviceFeesPaidUsd: { SERVICE: 20 },
      description: 'Agence de transport RDC & environs : fret Goma, Bukavu, Butembo, Beni, Kinshasa, Lubumbashi, Kigali et courses urbaines.',
      status: 'ACTIVE',
      fulfillmentMode: 'LOGISTICS_PROVIDER',
      commissionRate: 5,
      balanceUsd: 2180.0,
      totalOrders: 310,
      payoutBlocked: false,
      payoutBlockReason: null,
      immediateWithdrawalEnabled: false,
      isCertified: true,
      certificationStatus: 'ACTIVE',
      certificationFeeUsd: 15,
      certifiedUntil: '2026-12-31T23:59:59Z',
      hasMonthlyAd: true,
      monthlyAdPlan: 'PRO_CAROUSEL_59',
      monthlyAdFeeUsd: 59,
      monthlyAdUntil: '2026-12-18T23:59:59Z',
      createdAt: '2026-01-05T08:00:00Z',
    },
    {
      id: 'store-kivu',
      ownerId: 'usr-3',
      storeName: 'Coopérative Kivu Terroir',
      slug: 'kivu-terroir',
      storeType: 'RETAIL',
      enabledServices: ['PHYSICAL'],
      serviceFeesPaidUsd: { PHYSICAL: 15 },
      description: 'Producteurs de café Arabica et produits agroalimentaires du Nord et Sud-Kivu basés à Goma.',
      status: 'ACTIVE',
      fulfillmentMode: 'PLATFORM_DELIVERY',
      commissionRate: 5,
      balanceUsd: 920.0,
      totalOrders: 41,
      payoutBlocked: false,
      payoutBlockReason: null,
      immediateWithdrawalEnabled: false,
      isCertified: false,
      certificationStatus: 'NONE',
      certificationFeeUsd: 0,
      certifiedUntil: null,
      hasMonthlyAd: false,
      monthlyAdPlan: 'NONE',
      monthlyAdFeeUsd: 0,
      monthlyAdUntil: null,
      createdAt: '2026-02-12T08:00:00Z',
    },
  ];

  function enrichProduct(p: any) {
    const matchedStore = stores.find((s) => s.id === p.store?.id);
    const hasMonthlyAd = Boolean(matchedStore?.hasMonthlyAd);
    const isCertified = Boolean(matchedStore?.isCertified);
    return {
      ...p,
      isSponsored: hasMonthlyAd,
      monthlyAdPlan: matchedStore?.monthlyAdPlan || 'NONE',
      adExpiresAt: matchedStore?.monthlyAdUntil || null,
      store: {
        ...p.store,
        isCertified,
        verifiedSupplier: isCertified,
        hasMonthlyAd,
        isTransportAgency: Boolean(matchedStore?.isTransportAgency || matchedStore?.storeType === 'LOGISTICS'),
        transportDestinations: matchedStore?.transportDestinations || [],
      },
    };
  }

  let disputes: any[] = [
    {
      id: 'disp-1',
      orderId: 'ord-0988',
      orderNumber: 'ZGO-2026-0988',
      buyerName: 'Marc Mwamba',
      storeId: 'store-2',
      storeName: 'Kivu Digital & Tech',
      amountUsd: 380,
      status: 'OPEN',
      severity: 'HIGH',
      payoutFrozen: false,
      reasonCategory: 'PRODUCT_NOT_RECEIVED',
      reason: 'Retard de livraison supérieur à 48h sur smartphone vers Bukavu — demande de blocage des retraits vendeur.',
      description: 'Retard de livraison supérieur à 48h sur smartphone vers Bukavu — demande de blocage des retraits vendeur.',
      escrowAmount: 380,
      createdAt: '2026-03-08T10:00:00Z',
    },
  ];

  let notifications: any[] = [
    {
      id: 'notif-1',
      title: 'Bienvenue sur ZandoGo Goma !',
      body: 'Votre devis négocié avec Boutique Virunga Wax ($50.00/unité) a été accepté.',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      title: 'Colis ZGO-2026-1001 en transit',
      body: 'Le coursier Patrick Muhindo est en route vers Himbi (Goma) avec votre commande.',
      isRead: false,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  let agentProfile: any = {
    id: 'agent-1',
    status: 'AVAILABLE',
    vehicleType: 'MOTO',
    currentLat: -1.6741,
    currentLng: 29.2285,
  };

  let pendingAgents: any[] = [
    {
      id: 'agent-pending-1',
      vehicleType: 'MOTO_YAMAHA',
      user: {
        id: 'usr-moto-2',
        fullName: 'Grace Kavira',
        email: 'grace.kavira@example.cd',
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
      estimatedFee: 3.5,
      negotiatedFeeUsd: 3.5,
      feeNegotiationStatus: 'AGREED',
      distanceKm: 3.2,
      pickupLat: -1.6741,
      pickupLng: 29.2285,
      dropoffLat: -1.6815,
      dropoffLng: 29.2115,
      clientGoogleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-1.6815,29.2115',
      otpCode: '4829',
      agent: {
        id: 'agent-1',
        vehicleType: 'Moto Express Yamaha',
        user: { fullName: 'Patrick Muhindo', phone: '+243 81 988 22 33' },
      },
      trackingPings: [
        { lat: -1.6741, lng: 29.2285, recordedAt: new Date(Date.now() - 900000).toISOString() },
        { lat: -1.6778, lng: 29.2195, recordedAt: new Date(Date.now() - 300000).toISOString() },
      ],
      subOrder: {
        store: { storeName: 'Boutique Virunga Wax', city: 'Goma (Les Volcans)' },
        order: {
          id: 'ord-1001',
          orderNumber: 'ZGO-2026-1001',
          total: 88.5,
          currency: 'USD',
          deliveryAddress: addresses[0],
          paymentTransactions: [{ methodCode: 'MOBILE_MONEY_ORANGE', status: 'SUCCESS' }],
        },
      },
    },
    {
      id: 'del-2',
      status: 'ASSIGNED',
      estimatedFee: 3.5,
      negotiatedFeeUsd: 3.0,
      feeNegotiationStatus: 'PENDING_DRIVER',
      distanceKm: 4.9,
      pickupLat: -1.6741,
      pickupLng: 29.2285,
      dropoffLat: -1.646,
      dropoffLng: 29.208,
      clientGoogleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-1.6460,29.2080',
      otpCode: '7194',
      agent: {
        id: 'agent-1',
        vehicleType: 'Moto Express Yamaha',
        user: { fullName: 'Patrick Muhindo', phone: '+243 81 988 22 33' },
      },
      trackingPings: [
        { lat: -1.6741, lng: 29.2285, recordedAt: new Date(Date.now() - 400000).toISOString() },
      ],
      subOrder: {
        store: { storeName: 'Kivu Digital & Tech', city: 'Goma (Centre)' },
        order: {
          id: 'ord-1004',
          orderNumber: 'ZGO-2026-1004',
          total: 383.5,
          currency: 'USD',
          deliveryAddress: addresses[1],
          paymentTransactions: [{ methodCode: 'MOBILE_MONEY_MPESA', status: 'PENDING' }],
        },
      },
    },
  ];

  let conversations: any[] = [
    {
      id: 'conv-4',
      type: 'CUSTOMER_DELIVERY',
      orderId: 'ord-1004',
      orderNumber: 'ZGO-2026-1004',
      storeId: 'store-logistics',
      storeName: 'Patrick Muhindo · Coursier Moto (Avant paiement)',
      city: 'Goma (Karisimbi — Ndosho)',
      productId: 'prod-6',
      productTitle: 'Livraison Commande ZGO-2026-1004 (Avant paiement)',
      productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
      productPriceUsd: 3.5,
      distanceKm: 4.9,
      clientLocation: {
        lat: -1.646,
        lng: 29.208,
        label: 'Karisimbi · Ndosho (Goma)',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-1.6460,29.2080',
        distanceKm: 4.9,
      },
      deliveryNegotiation: {
        orderId: 'ord-1004',
        originalFeeUsd: 3.5,
        proposedFeeUsd: 3.0,
        agreedFeeUsd: null,
        status: 'PENDING_DRIVER',
        proposedBy: 'CUSTOMER',
        distanceKm: 4.9,
      },
      messages: [
        {
          id: 'm-40',
          conversationId: 'conv-4',
          senderId: 'usr-driver-1',
          content:
            'Bonjour M. Kitenge ! Avant de régler votre commande ZGO-2026-1004 à Goma, partagez votre point Google Maps exact afin que nous fixions un tarif de course juste.',
          createdAt: new Date(Date.now() - 1200000).toISOString(),
        },
        {
          id: 'm-41',
          conversationId: 'conv-4',
          senderId: 'usr-1',
          content: 'Voici ma position Google Maps à Ndosho (Karisimbi · Goma). Je propose $3.00 pour la course.',
          location: {
            lat: -1.646,
            lng: 29.208,
            label: 'Karisimbi · Ndosho (4.9 km)',
            googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-1.6460,29.2080',
            distanceKm: 4.9,
          },
          deliveryProposal: {
            feeUsd: 3.0,
            originalFeeUsd: 3.5,
            distanceKm: 4.9,
            status: 'PROPOSED',
            proposedBy: 'CUSTOMER',
            orderId: 'ord-1004',
          },
          createdAt: new Date(Date.now() - 800000).toISOString(),
        },
      ],
    },
    {
      id: 'conv-1',
      type: 'CUSTOMER_VENDOR',
      storeId: 'store-1',
      storeName: 'Boutique Virunga Wax',
      city: 'Goma (Les Volcans)',
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
            'Nous pouvons vous accorder un prix spécial de $50.00 par pièce (au lieu de $65.00) avec coursier express à $3.50 vers Himbi / Les Volcans (Goma). Le devis est prêt !',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
    },
    {
      id: 'conv-2',
      type: 'CUSTOMER_VENDOR',
      storeId: 'store-2',
      storeName: 'Kivu Digital & Tech',
      city: 'Bukavu',
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
            'Bonjour M. Kitenge, votre demande pour 2 Tecno Camon 30 depuis Goma vers Bukavu est en cours d’étude. L’expédition sécurisée par bateau / agence coûte $10.',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    },
    {
      id: 'conv-3',
      type: 'CUSTOMER_DELIVERY',
      orderId: 'ord-1001',
      orderNumber: 'ZGO-2026-1001',
      storeId: 'store-logistics',
      storeName: 'Patrick Muhindo · Nyiragongo Express Moto',
      city: 'Goma (Nord-Kivu)',
      productId: 'prod-2',
      productTitle: 'Livraison Commande ZGO-2026-1001',
      productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
      productPriceUsd: 3.5,
      distanceKm: 3.2,
      messages: [
        {
          id: 'm-4',
          conversationId: 'conv-3',
          senderId: 'usr-driver-1',
          content:
            'Bonjour ! J’ai récupéré votre veste Motif Kuba chez Boutique Virunga Wax. Je suis sur le Boulevard Kanyamuhanga (Goma), arrivée estimée dans 10 minutes.',
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
        if (path === '/users/me/addresses/by-email' && method === 'GET') {
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const targetEmail = (searchParams.get('email') || currentUser.email || '').trim().toLowerCase();
          if (!targetEmail || !targetEmail.includes('@')) {
            return json({ statusCode: 400, message: 'Veuillez saisir une adresse e-mail valide.' }, 400);
          }
          let matched = addresses.filter(
            (a) => !a.email || a.email.toLowerCase() === targetEmail,
          );
          if (matched.length === 0) {
            const recovered = {
              id: `addr-${Date.now()}`,
              email: targetEmail,
              commune: 'Goma — Les Volcans',
              quartier: 'Boulevard Kanyamuhanga',
              ville: 'Goma (Nord-Kivu)',
              referencePoint: `Adresse liée au compte ${targetEmail} (modifiable)`,
              latitude: -1.6741,
              longitude: 29.2285,
              isDefault: false,
            };
            addresses.push(recovered);
            matched = [recovered];
          }
          return json({ email: targetEmail, addresses: matched });
        }
        if (path === '/users/me/addresses' && method === 'POST') {
          readBody().then((body) => {
            if (body.isDefault) {
              addresses = addresses.map((a) => ({ ...a, isDefault: false }));
            }
            const newAddr = {
              id: `addr-${Date.now()}`,
              email: (body.email || currentUser.email || '').toLowerCase(),
              commune: body.commune || 'Goma',
              quartier: body.quartier || 'Himbi',
              ville: body.ville || body.commune || 'Goma (Nord-Kivu)',
              referencePoint: body.referencePoint || '',
              latitude: body.latitude || -1.6741,
              longitude: body.longitude || 29.2285,
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
        const addrSingleMatch = path.match(/^\/users\/me\/addresses\/([^/]+)$/);
        if (addrSingleMatch && method === 'PATCH') {
          readBody().then((body) => {
            const addr = addresses.find((a) => a.id === addrSingleMatch[1]);
            if (!addr) {
              return json({ statusCode: 404, message: 'Adresse introuvable.' }, 404);
            }
            if (body.isDefault) {
              addresses = addresses.map((a) => ({ ...a, isDefault: false }));
            }
            if (body.commune !== undefined) addr.commune = body.commune;
            if (body.quartier !== undefined) addr.quartier = body.quartier;
            if (body.ville !== undefined) addr.ville = body.ville;
            if (body.referencePoint !== undefined) addr.referencePoint = body.referencePoint;
            if (body.latitude !== undefined) addr.latitude = Number(body.latitude);
            if (body.longitude !== undefined) addr.longitude = Number(body.longitude);
            if (body.email !== undefined) addr.email = String(body.email).trim().toLowerCase();
            if (body.isDefault !== undefined) addr.isDefault = Boolean(body.isDefault);
            json(addr);
          });
          return;
        }
        if (addrSingleMatch && method === 'DELETE') {
          addresses = addresses.filter((a) => a.id !== addrSingleMatch[1]);
          return json({ success: true });
        }

        // --- CATEGORIES (ILLIMITÉES & DYNAMIQUES) ---
        if (path === '/categories' && method === 'GET') {
          return json(categories);
        }
        if (path === '/categories' && method === 'POST') {
          readBody().then((body) => {
            const name = String(body.name || '').trim();
            if (!name || name.length < 2) {
              return json({ statusCode: 400, message: 'Nom de catégorie invalide.' }, 400);
            }
            const existing = categories.find(
              (c) => c.name.toLowerCase() === name.toLowerCase(),
            );
            if (existing) {
              return json(existing, 200);
            }
            const newCat = {
              id: `cat-${Date.now()}`,
              name,
            };
            categories.push(newCat);
            json(newCat, 201);
          });
          return;
        }

        // --- PRODUCTS & REVIEWS ---
        if (path === '/products/sponsored' && method === 'GET') {
          const sponsored = products
            .map(enrichProduct)
            .filter((p) => p.isSponsored)
            .sort((a, b) => (b.store?.isCertified ? 1 : 0) - (a.store?.isCertified ? 1 : 0));
          return json(sponsored);
        }

        if (path === '/products' && method === 'GET') {
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const search = searchParams.get('search')?.toLowerCase();
          const typeFilter = searchParams.get('type')?.toUpperCase();
          const categoryId = searchParams.get('categoryId');

          let filtered = products.map(enrichProduct);
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
          // Priorité absolue aux produits des vendeurs ayant payé la publicité mensuelle, puis aux vendeurs certifiés
          filtered.sort((a, b) => {
            const adDiff = (b.isSponsored ? 1 : 0) - (a.isSponsored ? 1 : 0);
            if (adDiff !== 0) return adDiff;
            return (b.store?.isCertified ? 1 : 0) - (a.store?.isCertified ? 1 : 0);
          });
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
              city: addresses[0]?.commune ? `Goma (${addresses[0].commune})` : 'Goma (Nord-Kivu)',
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
          return json(enrichProduct(prod));
        }

        // --- REAL DIGITAL PDF DOWNLOAD ---
        const downloadMatch = path.match(/^\/downloads\/([^/]+)\/([^/]+)$/);
        if (downloadMatch && method === 'GET') {
          const [, prodId, ordId] = downloadMatch;
          const prod = products.find((p) => p.id === prodId) || products.find((p) => p.productType === 'DIGITAL');
          const ord = orders.find((o) => o.id === ordId);
          const fileName = prod?.digitalFileName || 'document-zandogo.pdf';

          let pdfBytes: Buffer;
          if (typeof prod?.digitalFileDataUrl === 'string' && prod.digitalFileDataUrl.includes('base64,')) {
            const b64 = prod.digitalFileDataUrl.split('base64,')[1];
            pdfBytes = Buffer.from(b64, 'base64');
          } else {
            pdfBytes = buildRealPdfBuffer(
              prod?.title || 'Document Numerique ZandoGo',
              ord?.orderNumber || 'ZGO-2026',
              fileName,
            );
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.end(pdfBytes);
          return;
        }

        // --- UPLOADS ---
        if (path === '/uploads/presign' && method === 'POST') {
          readBody().then((body) => {
            json({
              mode: 'local',
              key: `uploads/${(body.purpose || 'PRODUCT_IMAGE').toLowerCase()}-${Date.now()}`,
            });
          });
          return;
        }
        if (path === '/uploads/local' && method === 'POST') {
          return json({ key: `uploads/local-${Date.now()}.jpg` });
        }

        // --- CART ---
        if (path === '/cart' && method === 'GET') {
          return json(cart);
        }
        if (path === '/cart/items' && method === 'POST') {
          readBody().then((body) => {
            const foundProd =
              products.find(
                (p) =>
                  (body.productVariantId && p.variants.some((v: any) => v.id === body.productVariantId)) ||
                  (body.productId && p.id === body.productId),
              ) || products[0];
            const foundVar =
              (foundProd.variants || []).find((v: any) => v.id === body.productVariantId) ||
              (foundProd.variants && foundProd.variants[0]) || {
                id: `${foundProd.id}-var-default`,
                name: 'Standard',
                attributes: {},
                priceOverride: foundProd.basePriceUsd,
                stockQty: foundProd.stockQty ?? 10,
              };
            const qty = Math.max(1, Number(body.quantity) || 1);

            let unitPrice = Number(foundVar.priceOverride || foundProd.basePriceUsd);
            if (foundProd.priceTiers && foundProd.priceTiers.length > 0) {
              const matchedTier = foundProd.priceTiers
                .slice()
                .reverse()
                .find((t: any) => qty >= t.minQty && (t.maxQty === null || t.maxQty === undefined || qty <= t.maxQty));
              if (matchedTier) unitPrice = matchedTier.unitPriceUsd;
            }

            const existing = cart.items.find((it: any) => it.variant?.id === foundVar.id);
            if (existing) {
              existing.quantity += qty;
              existing.unitPriceSnapshot = unitPrice;
            } else {
              cart.items.push({
                id: `cart-item-${Date.now()}`,
                quantity: qty,
                unitPriceSnapshot: unitPrice,
                variant: {
                  id: foundVar.id,
                  name: foundVar.name,
                  attributes: foundVar.attributes,
                  product: {
                    id: foundProd.id,
                    title: foundProd.title,
                    productType: foundProd.productType,
                    pricingUnit: foundProd.pricingUnit || 'UNIT',
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
            estimatedFee: ord.deliveryFee ?? 3.5,
            distanceKm: 3.4,
            pickupLat: -1.6741,
            pickupLng: 29.2285,
            dropoffLat: addresses[0]?.latitude ?? -1.6815,
            dropoffLng: addresses[0]?.longitude ?? 29.2115,
            otpCode: String(1000 + Math.floor(Math.random() * 8999)),
            agent: {
              id: 'agent-1',
              vehicleType: 'Moto Express Yamaha',
              user: { fullName: 'Patrick Muhindo', phone: '+243 81 988 22 33' },
            },
            trackingPings: [
              { lat: -1.6741, lng: 29.2285, recordedAt: new Date(Date.now() - 600000).toISOString() },
              { lat: -1.678, lng: 29.219, recordedAt: new Date(Date.now() - 180000).toISOString() },
            ],
            subOrder: {
              store: { storeName: ord.subOrders?.[0]?.store?.storeName || 'Boutique Virunga Wax', city: 'Goma (Nord-Kivu)' },
              order: {
                id: ord.id,
                orderNumber: ord.orderNumber,
                total: ord.total,
                currency: ord.currency,
                deliveryAddress: addresses[0],
                paymentTransactions: [{ methodCode: ord.paymentOperator || 'MOBILE_MONEY_MPESA', status: ord.isPaid ? 'SUCCESS' : 'PENDING' }],
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

        // --- DELIVERY FEE NEGOTIATION BY DRIVER ---
        const deliveryNegotiateMatch = path.match(/^\/delivery\/deliveries\/([^/]+)\/negotiate$/);
        if (deliveryNegotiateMatch && method === 'POST') {
          readBody().then((body) => {
            const job = deliveryJobs.find((j) => j.id === deliveryNegotiateMatch[1]);
            if (job) {
              const ordId = job.subOrder?.order?.id;
              const ord = orders.find((o) => o.id === ordId);
              const conv = conversations.find((c) => c.orderId === ordId && c.type === 'CUSTOMER_DELIVERY');
              const agreed = body.action === 'ACCEPT';
              const nextFee = Number(body.feeUsd ?? job.negotiatedFeeUsd ?? job.estimatedFee);

              job.negotiatedFeeUsd = nextFee;
              job.feeNegotiationStatus = agreed ? 'AGREED' : 'COUNTERED';
              if (agreed) {
                job.estimatedFee = nextFee;
              }

              if (ord) {
                if (agreed) {
                  const itemsSubtotal = Math.max(0, Number(ord.total) - Number(ord.deliveryFee || 0));
                  ord.deliveryFee = nextFee;
                  ord.total = Number((itemsSubtotal + nextFee).toFixed(2));
                  ord.deliveryNegotiationStatus = 'AGREED';
                  if (job.subOrder?.order) job.subOrder.order.total = ord.total;
                } else {
                  ord.deliveryNegotiationStatus = 'COUNTERED';
                }
              }

              if (conv) {
                conv.deliveryNegotiation = {
                  orderId: ordId,
                  originalFeeUsd: conv.deliveryNegotiation?.originalFeeUsd ?? Number(job.estimatedFee),
                  proposedFeeUsd: nextFee,
                  agreedFeeUsd: agreed ? nextFee : null,
                  status: agreed ? 'AGREED' : 'COUNTERED',
                  proposedBy: 'DRIVER',
                  distanceKm: job.distanceKm,
                };
                conv.messages.push({
                  id: `m-${Date.now()}`,
                  conversationId: conv.id,
                  senderId: 'usr-driver-1',
                  content: agreed
                    ? `Tarif de livraison accepté à $${nextFee.toFixed(2)} pour ${ord?.orderNumber || ''}. Vous pouvez procéder au paiement Mobile Money ou Carte.`
                    : `Contre-proposition du livreur : $${nextFee.toFixed(2)} pour parcourir les ${job.distanceKm || 4} km jusqu’à votre point Google Maps à Goma.`,
                  deliveryProposal: {
                    feeUsd: nextFee,
                    originalFeeUsd: conv.deliveryNegotiation.originalFeeUsd,
                    distanceKm: job.distanceKm,
                    status: agreed ? 'ACCEPTED' : 'COUNTERED',
                    proposedBy: 'DRIVER',
                    orderId: ordId,
                  },
                  createdAt: new Date().toISOString(),
                });
              }

              notifications.unshift({
                id: `notif-${Date.now()}`,
                title: agreed ? `Tarif livraison validé ($${nextFee.toFixed(2)})` : `Contre-offre livreur ($${nextFee.toFixed(2)})`,
                body: `Livreur Patrick Muhindo (Goma) — Commande ${ord?.orderNumber || ''}.`,
                channel: 'SMS_AFRICASTALKING',
                smsRecipient: currentUser.phone,
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
            json(job || { success: true });
          });
          return;
        }

        // --- ORDERS & CHECKOUT ---
        if (path === '/orders' && method === 'GET') {
          return json(orders);
        }
        const singleOrderMatch = path.match(/^\/orders\/([^/]+)$/);
        if (singleOrderMatch && method === 'GET') {
          const found = orders.find((o) => o.id === singleOrderMatch[1]);
          return json(found || orders[0]);
        }
        if (path === '/orders/checkout' && method === 'POST') {
          readBody().then((body) => {
            const onlyDigital = cart.items.length > 0 && cart.items.every((i: any) => i.variant?.product?.productType === 'DIGITAL');
            const selectedDel = onlyDigital
              ? {
                  id: 'del-opt-digital',
                  providerName: 'ZandoGo Instant Cloud',
                  code: 'CLICK_AND_COLLECT',
                  name: 'Envoi Automatique Numérique (Sans frais)',
                  estimatedTime: 'Instantané après paiement',
                  feeUsd: 0,
                  feeCdf: 0,
                  description: 'Envoi automatique du lien de téléchargement PDF par le système sans intervention du vendeur.',
                }
              : deliveryOptions.find((d) => d.id === body.deliveryOptionId) || deliveryOptions[0];

            const subtotal =
              cart.items.reduce((sum: number, item: any) => sum + (Number(item.unitPriceSnapshot) || 0) * (item.quantity || 1), 0) || 65;
            const deliveryFee = onlyDigital
              ? 0
              : body.negotiatedDeliveryFeeUsd !== undefined
              ? Number(body.negotiatedDeliveryFeeUsd)
              : selectedDel.feeUsd;
            const grandTotal = Number((subtotal + deliveryFee).toFixed(2));

            const newOrderId = `ord-${Date.now()}`;
            const orderNumber = `ZGO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

            const digitalDownloads = cart.items
              .filter((i: any) => i.variant?.product?.productType === 'DIGITAL')
              .map((i: any, idx: number) => {
                const prod = products.find((p) => p.id === i.variant?.product?.id);
                const prodId = prod?.id || i.variant?.product?.id || 'prod-3';
                const token = `zg-${Date.now().toString(36)}-${idx}`;
                return {
                  productId: prodId,
                  title: prod?.title || i.variant?.product?.title || 'Document Numérique PDF',
                  downloadUrl: `/api/downloads/${prodId}/${newOrderId}?token=${token}`,
                  fileName: prod?.digitalFileName || 'document-zandogo.pdf',
                  token,
                  autoDispatched: false,
                  fileUrl: prod?.digitalFileUrl || undefined,
                };
              });

            const chosenAddr = onlyDigital ? undefined : addresses.find((a) => a.id === body.deliveryAddressId) || addresses[0];
            const distKm = chosenAddr ? haversineKm(-1.6741, 29.2285, chosenAddr.latitude, chosenAddr.longitude) : 0;

            // Group cart items by their actual store
            const storeGroups = new Map<string, { storeId: string; storeName: string; items: any[] }>();
            cart.items.forEach((it: any) => {
              const prod = products.find((p) => p.id === it.variant?.product?.id);
              const sId = prod?.store?.id || (onlyDigital ? 'store-digital' : 'store-1');
              const sName = prod?.store?.storeName || (onlyDigital ? 'Kivu Business Insights' : 'Boutique Virunga Wax');
              const group = storeGroups.get(sId) || { storeId: sId, storeName: sName, items: [] };
              group.items.push({
                id: it.id,
                quantity: it.quantity,
                productTitle: it.variant?.product?.title || prod?.title,
                unitPrice: Number(it.unitPriceSnapshot),
                productType: prod?.productType || it.variant?.product?.productType || 'PHYSICAL',
                pricingUnit: prod?.pricingUnit || it.variant?.product?.pricingUnit || 'UNIT',
                variantName: it.variant?.name,
              });
              storeGroups.set(sId, group);
            });

            const subOrders = Array.from(storeGroups.values()).map((grp, idx) => ({
              id: `sub-${Date.now()}-${idx}`,
              storeId: grp.storeId,
              status: 'PENDING',
              autoFulfilled: false,
              buyerName: currentUser.fullName,
              destinationCity: grp.items.every((it) => it.productType === 'DIGITAL')
                ? 'Envoi automatique du lien PDF'
                : chosenAddr
                ? `Goma (${chosenAddr.commune})`
                : 'Goma (Nord-Kivu)',
              store: { storeName: grp.storeName },
              items: grp.items,
            }));

            const newOrder: any = {
              id: newOrderId,
              orderNumber,
              status: 'PENDING_PAYMENT',
              isPaid: false,
              paymentStatus: 'UNPAID',
              escrowStatus: undefined,
              createdAt: new Date().toISOString(),
              total: grandTotal,
              deliveryFee,
              noDeliveryNeeded: onlyDigital,
              deliveryNegotiationStatus: 'NONE',
              deliveryAddress: chosenAddr,
              currency: body.currency || 'USD',
              deliveryOption: selectedDel,
              hasDigitalItems: digitalDownloads.length > 0,
              digitalDownloads: digitalDownloads.length > 0 ? digitalDownloads : undefined,
              smsDispatches: [],
              subOrders,
            };

            cart.items.forEach((item: any) => {
              const p = products.find((prod) => prod.id === item.variant?.product?.id);
              if (p && p.stockQty !== undefined && p.productType === 'PHYSICAL') {
                p.stockQty = Math.max(0, p.stockQty - item.quantity);
              }
            });

            let deliveryConversationId: string | undefined;

            if (!onlyDigital && deliveryFee >= 0 && selectedDel.code !== 'CLICK_AND_COLLECT') {
              const jobId = `del-${Date.now()}`;
              const dropLat = chosenAddr?.latitude || -1.6815;
              const dropLng = chosenAddr?.longitude || 29.2115;
              const mapsLink = `https://www.google.com/maps/search/?api=1&query=${dropLat},${dropLng}`;

              deliveryJobs.unshift({
                id: jobId,
                status: 'ASSIGNED',
                estimatedFee: deliveryFee,
                negotiatedFeeUsd: deliveryFee,
                feeNegotiationStatus: 'NONE',
                distanceKm: distKm || 3.4,
                pickupLat: -1.6741,
                pickupLng: 29.2285,
                dropoffLat: dropLat,
                dropoffLng: dropLng,
                clientGoogleMapsUrl: mapsLink,
                otpCode: String(1000 + Math.floor(Math.random() * 8999)),
                agent: {
                  id: 'agent-1',
                  vehicleType: 'Moto Express Yamaha',
                  user: { fullName: 'Patrick Muhindo', phone: '+243 81 988 22 33' },
                },
                trackingPings: [{ lat: -1.6741, lng: 29.2285, recordedAt: new Date().toISOString() }],
                subOrder: {
                  store: { storeName: subOrders[0]?.store?.storeName || 'Boutique Virunga Wax', city: 'Goma (Nord-Kivu)' },
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

              const convId = `conv-del-${Date.now()}`;
              deliveryConversationId = convId;
              conversations.unshift({
                id: convId,
                type: 'CUSTOMER_DELIVERY',
                orderId: newOrderId,
                orderNumber,
                storeId: 'store-logistics',
                storeName: 'Patrick Muhindo · Coursier Moto (Avant paiement)',
                city: chosenAddr?.commune ? `Goma (${chosenAddr.commune})` : 'Goma (Nord-Kivu)',
                productTitle: `Livraison ${orderNumber}`,
                productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
                productPriceUsd: deliveryFee,
                distanceKm: distKm || 3.4,
                clientLocation: {
                  lat: dropLat,
                  lng: dropLng,
                  label: `${chosenAddr?.commune || 'Goma'} · ${chosenAddr?.quartier || 'Himbi'}`,
                  googleMapsUrl: mapsLink,
                  distanceKm: distKm || 3.4,
                },
                deliveryNegotiation: {
                  orderId: newOrderId,
                  originalFeeUsd: deliveryFee,
                  proposedFeeUsd: deliveryFee,
                  agreedFeeUsd: null,
                  status: 'NONE',
                  distanceKm: distKm || 3.4,
                },
                messages: [
                  {
                    id: `m-${Date.now()}`,
                    conversationId: convId,
                    senderId: 'usr-driver-1',
                    content: `Bonjour ! Course prête à Goma pour ${orderNumber} (${distKm || 3.4} km, tarif initial $${deliveryFee.toFixed(2)}). Vous pouvez partager votre position Google Maps ou proposer un tarif avant de payer.`,
                    createdAt: new Date().toISOString(),
                  },
                ],
              });
            }

            cart.items = [];
            orders.unshift(newOrder);

            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Commande ${orderNumber} créée`,
              body: onlyDigital
                ? `Montant : $${grandTotal.toFixed(2)}. Dès paiement, le système enverra automatiquement le lien de téléchargement PDF sans action du vendeur.`
                : `Montant total : $${grandTotal.toFixed(2)}. Discutez le tarif coursier ou réglez par Airtel, M-Pesa, Orange, MTN ou Visa.`,
              isRead: false,
              createdAt: new Date().toISOString(),
            });

            json({
              orderId: newOrder.id,
              orderNumber: newOrder.orderNumber,
              total: newOrder.total,
              deliveryFee: newOrder.deliveryFee,
              noDeliveryNeeded: onlyDigital,
              hasDigitalItems: digitalDownloads.length > 0,
              digitalDownloads: newOrder.digitalDownloads,
              deliveryConversationId,
              distanceKm: distKm,
              currency: newOrder.currency,
              status: newOrder.status,
            });
          });
          return;
        }

        function resolveOperatorLabel(methodCode?: string, phone?: string): { code: string; label: string } {
          if (methodCode === 'MOBILE_MONEY_AIRTEL' || methodCode === 'AIRTEL_MONEY') {
            return { code: 'MOBILE_MONEY_AIRTEL', label: 'Airtel Money' };
          }
          if (methodCode === 'MOBILE_MONEY_ORANGE' || methodCode === 'ORANGE_MONEY') {
            return { code: 'MOBILE_MONEY_ORANGE', label: 'Orange Money' };
          }
          if (methodCode === 'MOBILE_MONEY_MTN' || methodCode === 'MTN_MOMO') {
            return { code: 'MOBILE_MONEY_MTN', label: 'MTN MoMo' };
          }
          if (methodCode === 'CARD_STRIPE' || methodCode === 'CARD') {
            return { code: 'CARD_STRIPE', label: 'Visa / Mastercard' };
          }
          if (methodCode === 'CASH_ON_DELIVERY') {
            return { code: 'CASH_ON_DELIVERY', label: 'Espèces à la livraison' };
          }
          if (methodCode === 'MOBILE_MONEY_MPESA' || methodCode === 'MPESA') {
            return { code: 'MOBILE_MONEY_MPESA', label: 'M-Pesa Vodacom' };
          }
          const digits = String(phone || '').replace(/[^\d+]/g, '');
          if (digits.startsWith('+250') || digits.startsWith('250') || digits.startsWith('+256') || digits.startsWith('256')) {
            return { code: 'MOBILE_MONEY_MTN', label: 'MTN MoMo' };
          }
          let local = digits.replace(/^\+?243/, '').replace(/^0/, '');
          const p2 = local.slice(0, 2);
          if (['97', '98', '99'].includes(p2)) return { code: 'MOBILE_MONEY_AIRTEL', label: 'Airtel Money' };
          if (['80', '84', '85', '89'].includes(p2)) return { code: 'MOBILE_MONEY_ORANGE', label: 'Orange Money' };
          if (p2 === '88') return { code: 'MOBILE_MONEY_MTN', label: 'MTN MoMo' };
          return { code: 'MOBILE_MONEY_MPESA', label: 'M-Pesa Vodacom' };
        }

        function fulfillDigitalDownloadsAutomatically(
          ord: any,
          smsTarget: string,
          paymentRef: string,
          operatorLabel: string,
        ) {
          const originHost = req.headers.host ? `http://${req.headers.host}` : '';
          const nowIso = new Date().toISOString();
          if (ord.digitalDownloads && ord.digitalDownloads.length > 0) {
            ord.digitalDownloads = ord.digitalDownloads.map((dl: any) => ({
              ...dl,
              autoDispatched: true,
              autoDispatchedAt: nowIso,
            }));
          }

          (ord.subOrders || []).forEach((so: any) => {
            const allDigitalItems = (so.items || []).length > 0 && so.items.every((it: any) => it.productType === 'DIGITAL');
            if (allDigitalItems && !so.autoFulfilled) {
              so.status = 'DELIVERED';
              so.autoFulfilled = true;
              const targetStore = stores.find((s) => s.id === so.storeId);
              if (targetStore) {
                const subTotal = so.items.reduce(
                  (sum: number, it: any) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
                  0,
                );
                const commRate = Number(targetStore.commissionRate ?? platformPricing.defaultCommissionPercent ?? 5) / 100;
                const netAmount = Number((subTotal * (1 - commRate)).toFixed(2));
                targetStore.balanceUsd = Number(((targetStore.balanceUsd || 0) + netAmount).toFixed(2));
              }
            }
          });

          const firstDl = ord.digitalDownloads?.[0];
          const fullUrl = firstDl ? `${originHost}${firstDl.downloadUrl}` : '';
          const smsBody = firstDl
            ? `[SMS] ZandoGo Goma : Paiement ${operatorLabel} $${Number(ord.total).toFixed(2)} confirmé (${paymentRef}). Lien direct de votre livre (${firstDl.fileName}) envoyé automatiquement : ${fullUrl}`
            : `[SMS] ZandoGo Goma : Commande ${ord.orderNumber} confirmée via ${operatorLabel} (${paymentRef}). Séquestre actif.`;

          ord.smsDispatches = [
            {
              id: `sms-${Date.now()}`,
              provider: 'AFRICASTALKING',
              to: smsTarget,
              message: smsBody,
              sentAt: nowIso,
            },
            ...(ord.smsDispatches || []),
          ];

          notifications.unshift({
            id: `notif-${Date.now()}`,
            title: firstDl
              ? `Lien PDF envoyé automatiquement (${ord.orderNumber})`
              : `Paiement ${operatorLabel} confirmé (${paymentRef})`,
            body: smsBody,
            channel: 'SMS_AFRICASTALKING',
            smsRecipient: smsTarget,
            actionUrl: firstDl?.downloadUrl,
            actionLabel: firstDl ? `Télécharger ${firstDl.fileName}` : undefined,
            isRead: false,
            createdAt: nowIso,
          });
        }

        if (path === '/payments/initiate' && method === 'POST') {
          readBody().then((body) => {
            const ord = orders.find((o) => o.id === body.orderId);
            const paymentRef = `ZG-PAY-${Date.now().toString().slice(-6)}`;
            const smsTarget = body.phoneNumber || currentUser.phone || '+243820001122';
            const op = resolveOperatorLabel(body.methodCode, smsTarget);
            const isCash = op.code === 'CASH_ON_DELIVERY';

            const baseTotal = Number(ord?.total ?? 0);
            const transactionFeePercent = isCash
              ? 0
              : Number(platformPricing.paymentTransactionFeePercent ?? 3.5);
            const transactionFeeAmount = isCash
              ? 0
              : Number((baseTotal * (transactionFeePercent / 100)).toFixed(2));
            const chargedTotal = Number((baseTotal + transactionFeeAmount).toFixed(2));
            const paidAt = new Date().toISOString();
            const escrowReleaseAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            if (ord) {
              ord.transactionFeePercent = transactionFeePercent;
              ord.transactionFeeAmount = transactionFeeAmount;
              ord.chargedTotal = chargedTotal;

              if (isCash) {
                ord.status = 'PROCESSING';
                ord.isPaid = false;
                ord.paymentStatus = 'UNPAID';
                ord.paymentGateway = 'CASH_ON_DELIVERY';
                ord.paymentOperator = 'CASH_ON_DELIVERY';

                const smsBody = `[SMS] ZandoGo Goma : Commande ${ord.orderNumber} confirmée (paiement en espèces à la livraison · $${chargedTotal.toFixed(2)}).`;
                ord.smsDispatches = [
                  { id: `sms-${Date.now()}`, provider: 'AFRICASTALKING', to: smsTarget, message: smsBody, sentAt: paidAt },
                  ...(ord.smsDispatches || []),
                ];
                notifications.unshift({
                  id: `notif-${Date.now()}`,
                  title: 'Commande confirmée + SMS envoyé',
                  body: smsBody,
                  channel: 'SMS_AFRICASTALKING',
                  smsRecipient: smsTarget,
                  isRead: false,
                  createdAt: paidAt,
                });
              } else {
                ord.status = ord.noDeliveryNeeded ? 'COMPLETED' : 'ESCROW_HELD';
                ord.isPaid = true;
                ord.paymentStatus = 'PAID';
                ord.paidAt = paidAt;
                ord.escrowReleaseAt = escrowReleaseAt;
                ord.paymentGateway = op.code === 'CARD_STRIPE' ? 'CARD' : 'MOBILE_MONEY';
                ord.paymentOperator = op.code;
                ord.paymentRef = paymentRef;
                ord.escrowStatus = ord.noDeliveryNeeded ? 'RELEASED_TO_VENDOR' : 'HELD';
                fulfillDigitalDownloadsAutomatically(ord, smsTarget, paymentRef, op.label);
              }
            }

            const ussdByOp: Record<string, string | undefined> = {
              MOBILE_MONEY_MPESA: '*150*00#',
              MOBILE_MONEY_AIRTEL: '*501#',
              MOBILE_MONEY_ORANGE: '#144#',
              MOBILE_MONEY_MTN: '*182#',
            };
            const ussdCode = ussdByOp[op.code];
            const expiresAt = ussdCode ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined;

            json({
              status: 'SUCCESS',
              paymentStatus: 'SUCCESS',
              operator: op.code,
              operatorLabel: op.label,
              paymentRef: isCash ? undefined : paymentRef,
              baseTotal,
              transactionFeePercent,
              transactionFeeAmount,
              chargedTotal,
              paidAt: isCash ? undefined : paidAt,
              escrowReleaseAt: isCash ? undefined : escrowReleaseAt,
              ussdCode,
              expiresAt,
              smsProvider: 'AFRICASTALKING',
              smsRecipient: smsTarget,
              digitalDownloads: ord?.digitalDownloads || [],
              noDeliveryNeeded: Boolean(ord?.noDeliveryNeeded),
              order: ord,
              method: isCash ? 'cash_on_delivery' : op.code,
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
          readBody().then((body) => {
            const ord = orders.find((o) => o.id === payOrderMatch[1]);
            const paymentRef = `ZG-PAY-${Date.now().toString().slice(-6)}`;
            const smsTarget = body.phoneNumber || currentUser.phone || '+243820001122';
            const op = resolveOperatorLabel(body.methodCode, smsTarget);
            const feePct = Number(platformPricing.paymentTransactionFeePercent ?? 3.5);
            const baseTotal = Number(ord?.total ?? 0);
            const feeAmt = Number((baseTotal * (feePct / 100)).toFixed(2));
            const chargedTotal = Number((baseTotal + feeAmt).toFixed(2));
            const paidAt = new Date().toISOString();
            const escrowReleaseAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            if (ord) {
              ord.status = ord.noDeliveryNeeded ? 'COMPLETED' : 'ESCROW_HELD';
              ord.isPaid = true;
              ord.paymentStatus = 'PAID';
              ord.paidAt = paidAt;
              ord.escrowReleaseAt = escrowReleaseAt;
              ord.transactionFeePercent = feePct;
              ord.transactionFeeAmount = feeAmt;
              ord.chargedTotal = chargedTotal;
              ord.paymentGateway = op.code === 'CARD_STRIPE' ? 'CARD' : 'MOBILE_MONEY';
              ord.paymentOperator = op.code;
              ord.paymentRef = paymentRef;
              ord.escrowStatus = ord.noDeliveryNeeded ? 'RELEASED_TO_VENDOR' : 'HELD';
              fulfillDigitalDownloadsAutomatically(ord, smsTarget, paymentRef, op.label);
            }
            json({
              success: true,
              operator: op.code,
              operatorLabel: op.label,
              paymentRef,
              transactionFeePercent: feePct,
              transactionFeeAmount: feeAmt,
              chargedTotal,
              paidAt,
              escrowReleaseAt,
              digitalDownloads: ord?.digitalDownloads || [],
              message: ord?.digitalDownloads?.length
                ? `Paiement ${op.label} $${chargedTotal.toFixed(2)} (${paymentRef}) validé ! Lien de téléchargement envoyé automatiquement.`
                : `Commande réglée via ${op.label} pour $${chargedTotal.toFixed(2)} (${paymentRef}). Décompte 48h démarré.`,
            });
          });
          return;
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
              transportMode: body.transportMode || 'Coursier Express Goma',
              requestedDeliveryFeeUsd: body.requestedDeliveryFeeUsd !== undefined ? Number(body.requestedDeliveryFeeUsd) : 3.5,
              agreedDeliveryFeeUsd: null,
              destinationCity: body.destinationCity || 'Goma (Nord-Kivu)',
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
              .filter((so: any) => so.storeId === storeId)
              .map((so: any) => ({
                ...so,
                orderId: o.id,
                orderNumber: o.orderNumber,
                orderStatus: o.status,
                isPaid: o.isPaid,
                escrowStatus: o.escrowStatus,
                hasDigitalItems: Boolean(
                  o.hasDigitalItems && (so.items || []).every((it: any) => it.productType === 'DIGITAL'),
                ),
                autoFulfilled: Boolean(so.autoFulfilled),
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
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const requestedStoreId = searchParams.get('storeId') || 'store-1';
          const targetStore = stores.find((s) => s.id === requestedStoreId) || stores[0];
          const blockingDisputes = disputes
            .filter((d) => d.storeId === targetStore.id && d.payoutFrozen && d.status === 'OPEN')
            .map((d) => ({ id: d.id, orderNumber: d.orderNumber, reason: d.reason }));
          const isBlocked = Boolean(targetStore?.payoutBlocked) || blockingDisputes.length > 0;
          const immediateAuthorized =
            !isBlocked &&
            (Boolean(platformPricing.allowImmediateVendorWithdrawal) ||
              Boolean(targetStore?.immediateWithdrawalEnabled));

          const storeHeldOrders = orders.filter(
            (o) =>
              o.escrowStatus === 'HELD' &&
              (o.subOrders || []).some((so: any) => so.storeId === targetStore.id),
          );
          const lockedEscrowUsd = storeHeldOrders.reduce((s, o) => s + Number(o.total || 0), 0);
          const availableBalanceUsd = Number(targetStore?.balanceUsd ?? 1840.5);
          return json({
            storeId: targetStore.id,
            storeName: targetStore.storeName,
            availableBalanceUsd,
            lockedEscrowUsd,
            totalEarnedUsd: availableBalanceUsd + lockedEscrowUsd + 420.0,
            currency: 'USD',
            immediateWithdrawalAuthorized: immediateAuthorized,
            payoutBlocked: isBlocked,
            payoutBlockReason: isBlocked
              ? targetStore?.payoutBlockReason ||
                `Retraits bloqués suite au litige pertinent (${blockingDisputes[0]?.orderNumber || 'en cours'}).`
              : null,
            blockingDisputes,
            payouts,
          });
        }
        const adminUnlockStoreMatch = path.match(/^\/wallets\/admin\/store\/([^/]+)\/unlock-funds$/);
        if (adminUnlockStoreMatch && method === 'POST') {
          const st = stores.find((s) => s.id === adminUnlockStoreMatch[1]);
          if (!st) return json({ statusCode: 404, message: 'Boutique introuvable.' }, 404);
          if (st.payoutBlocked) {
            return json({ statusCode: 403, message: 'Boutique bloquée pour litige en cours.' }, 403);
          }
          let unlockedAmount = 0;
          orders.forEach((o) => {
            const belongs = (o.subOrders || []).some((so: any) => so.storeId === st.id);
            if (belongs && o.escrowStatus === 'HELD') {
              o.escrowStatus = 'RELEASED_TO_VENDOR';
              const comm = Number(st.commissionRate ?? platformPricing.defaultCommissionPercent ?? 5) / 100;
              const net = Number((Number(o.total || 0) * (1 - comm)).toFixed(2));
              st.balanceUsd = Number(((st.balanceUsd || 0) + net).toFixed(2));
              unlockedAmount += net;
            }
          });
          notifications.unshift({
            id: `notif-${Date.now()}`,
            title: `Fonds débloqués par le Super Admin (${st.storeName})`,
            body: `$${unlockedAmount.toFixed(2)} transférés vers votre solde disponible immédiat.`,
            isRead: false,
            createdAt: new Date().toISOString(),
          });
          return json({ storeId: st.id, unlockedAmount: Number(unlockedAmount.toFixed(2)) });
        }
        if ((path === '/wallets/payout' || path === '/wallets/payouts') && method === 'POST') {
          readBody().then((body) => {
            const targetStoreId = body.storeId || 'store-1';
            const targetStore = stores.find((s) => s.id === targetStoreId) || stores[0];
            const blockingDispute = disputes.find(
              (d) => d.storeId === targetStore.id && d.payoutFrozen && d.status === 'OPEN',
            );
            if (targetStore?.payoutBlocked || blockingDispute) {
              return json(
                {
                  statusCode: 403,
                  message:
                    targetStore?.payoutBlockReason ||
                    `Retrait refusé : les retraits de « ${targetStore.storeName} » sont bloqués suite à un litige client pertinent (${blockingDispute?.orderNumber || ''}).`,
                },
                403,
              );
            }

            const immediateAuthorized =
              Boolean(platformPricing.allowImmediateVendorWithdrawal) ||
              Boolean(targetStore?.immediateWithdrawalEnabled);

            if (immediateAuthorized) {
              orders.forEach((o) => {
                const belongs = (o.subOrders || []).some((so: any) => so.storeId === targetStore.id);
                if (belongs && o.escrowStatus === 'HELD') {
                  o.escrowStatus = 'RELEASED_TO_VENDOR';
                  const comm = Number(targetStore.commissionRate ?? platformPricing.defaultCommissionPercent ?? 5) / 100;
                  const net = Number((Number(o.total || 0) * (1 - comm)).toFixed(2));
                  targetStore.balanceUsd = Number(((targetStore.balanceUsd || 0) + net).toFixed(2));
                }
              });
            }

            const amount = Number(body.amountUsd ?? body.amount ?? 0);
            const currentBal = Number(targetStore?.balanceUsd ?? 0);
            if (amount <= 0) {
              return json({ statusCode: 400, message: 'Montant de retrait invalide.' }, 400);
            }
            if (amount > currentBal) {
              return json(
                {
                  statusCode: 400,
                  message: `Solde disponible insuffisant ($${currentBal.toFixed(2)}).`,
                },
                400,
              );
            }

            const newPayout = {
              id: `pay-out-${Date.now()}`,
              amountUsd: amount,
              method: body.method || 'Mobile Money',
              destination: body.destination || '+243820001122',
              status: immediateAuthorized ? 'PAID' : 'REQUESTED',
              createdAt: new Date().toISOString(),
            };
            payouts.unshift(newPayout);
            if (targetStore && typeof targetStore.balanceUsd === 'number') {
              targetStore.balanceUsd = Math.max(0, Number((targetStore.balanceUsd - amount).toFixed(2)));
            }
            if (immediateAuthorized) {
              notifications.unshift({
                id: `notif-${Date.now()}`,
                title: `Retrait immédiat exécuté ($${amount.toFixed(2)})`,
                body: `Décaissement direct vers ${newPayout.destination} (${newPayout.method}) autorisé par le Super Admin.`,
                channel: 'SMS_AFRICASTALKING',
                smsRecipient: newPayout.destination,
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
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
            const existingSlug = stores.find((s) => s.slug === body.slug);
            if (existingSlug) {
              return json({ statusCode: 409, message: 'Ce slug de boutique est déjà utilisé.' }, 409);
            }

            const validModules = ['PHYSICAL', 'DIGITAL', 'SERVICE'];
            const requestedModules: string[] = Array.isArray(body.enabledServices)
              ? Array.from(new Set(body.enabledServices.filter((m: string) => validModules.includes(m))))
              : ['PHYSICAL'];

            if (requestedModules.length === 0) {
              return json(
                { statusCode: 400, message: 'Veuillez sélectionner au moins un service payant (Bien physique, Livre PDF ou Service).' },
                400,
              );
            }

            const serviceFeesPaidUsd: Record<string, number> = {};
            let modulesTotalUsd = 0;
            requestedModules.forEach((svc) => {
              const svcFee = getServiceModuleFeeUsd(svc);
              serviceFeesPaidUsd[svc] = svcFee;
              modulesTotalUsd += svcFee;
            });

            const baseFeeUsd = Number(platformPricing.storeCreationFeeUsd || 0);
            const feeUsd = Number((baseFeeUsd + modulesTotalUsd).toFixed(2));
            const paymentRef = `ZG-STORE-${Math.floor(100000 + Math.random() * 900000)}`;
            const smsTarget = body.customerPhone || currentUser.phone || '+243820001122';
            const op = resolveOperatorLabel(body.paymentMethod, smsTarget);

            const derivedStoreType =
              body.storeType ||
              (requestedModules.length === 1 && requestedModules[0] === 'DIGITAL'
                ? 'DIGITAL'
                : requestedModules.length === 1 && requestedModules[0] === 'SERVICE'
                ? 'SERVICES'
                : 'RETAIL');

            const newStore = {
              id: `store-${Date.now()}`,
              ownerId: currentUser.id,
              storeName: body.storeName,
              slug: body.slug,
              storeType: derivedStoreType,
              isTransportAgency: Boolean(body.isTransportAgency || derivedStoreType === 'LOGISTICS'),
              transportDestinations: Array.isArray(body.transportDestinations)
                ? body.transportDestinations.map((td: any, idx: number) => ({
                    id: td.id || `td-${Date.now()}-${idx}`,
                    originCity: td.originCity || 'Goma',
                    destinationCity: td.destinationCity || 'Bukavu',
                    basePriceUsd: Number(td.basePriceUsd || 0),
                    pricePerKmUsd: td.pricePerKmUsd !== undefined ? Number(td.pricePerKmUsd) : undefined,
                    estimatedDelay: td.estimatedDelay || '24h',
                    vehicleMode: td.vehicleMode || 'Fourgon / Fret',
                  }))
                : [],
              enabledServices: requestedModules,
              serviceFeesPaidUsd,
              description: body.description,
              status: 'ACTIVE' as const,
              fulfillmentMode: body.fulfillmentMode || 'PLATFORM_DELIVERY',
              commissionRate: platformPricing.defaultCommissionPercent,
              balanceUsd: 0,
              totalOrders: 0,
              payoutBlocked: false,
              payoutBlockReason: null,
              immediateWithdrawalEnabled: false,
              creationFeePaidUsd: feeUsd,
              paymentRef,
              paymentOperator: op.code,
              isCertified: false,
              certificationStatus: 'NONE',
              hasMonthlyAd: false,
              monthlyAdPlan: 'NONE',
              createdAt: new Date().toISOString(),
            };
            stores.push(newStore);

            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Boutique achetée & activée ($${feeUsd.toFixed(2)} · ${op.label})`,
              body: `[SMS] Boutique "${newStore.storeName}" créée (${newStore.isTransportAgency ? `Agence Transport · ${newStore.transportDestinations.length} lignes` : requestedModules.join(', ')} · Réf : ${paymentRef}).`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: smsTarget,
              isRead: false,
              createdAt: new Date().toISOString(),
            });

            json({ ...newStore, creationFeeUsd: feeUsd, paymentRef, operator: op.code }, 201);
          });
          return;
        }

        const vendorStoreActivateServiceMatch = path.match(/^\/vendors\/stores\/([^/]+)\/activate-service$/);
        if (vendorStoreActivateServiceMatch && method === 'POST') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStoreActivateServiceMatch[1]);
            if (!st) {
              return json({ statusCode: 404, message: 'Boutique introuvable.' }, 404);
            }
            const svc = body.service;
            if (!['PHYSICAL', 'DIGITAL', 'SERVICE'].includes(svc)) {
              return json({ statusCode: 400, message: 'Service inconnu.' }, 400);
            }
            const currentEnabled: string[] = Array.isArray(st.enabledServices) ? st.enabledServices : ['PHYSICAL'];
            if (currentEnabled.includes(svc)) {
              return json({ store: st, activatedService: svc, feeUsd: 0 });
            }

            const feeUsd = getServiceModuleFeeUsd(svc);
            const paymentRef = `ZG-SVC-${Math.floor(100000 + Math.random() * 900000)}`;
            const smsTarget = body.customerPhone || currentUser.phone || '+243820001122';
            const op = resolveOperatorLabel(body.paymentMethod, smsTarget);

            st.enabledServices = [...currentEnabled, svc];
            st.serviceFeesPaidUsd = { ...(st.serviceFeesPaidUsd || {}), [svc]: feeUsd };

            const svcLabel =
              svc === 'PHYSICAL'
                ? 'Biens Physiques'
                : svc === 'DIGITAL'
                ? 'Livres & Documents PDF'
                : 'Services & Transport au km';

            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Service "${svcLabel}" activé ($${feeUsd.toFixed(2)} · ${op.label})`,
              body: `[SMS] Le module ${svcLabel} est désormais débloqué sur "${st.storeName}" (Réf : ${paymentRef}).`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: smsTarget,
              isRead: false,
              createdAt: new Date().toISOString(),
            });

            json({ store: st, activatedService: svc, feeUsd, paymentRef, operator: op.code });
          });
          return;
        }

        const vendorStoreProductsMatch = path.match(/^\/vendors\/stores\/([^/]+)\/products$/);
        if (vendorStoreProductsMatch && method === 'GET') {
          const storeId = vendorStoreProductsMatch[1];
          return json(products.map(enrichProduct).filter((p) => p.store.id === storeId));
        }
        if (vendorStoreProductsMatch && method === 'POST') {
          readBody().then((body) => {
            const pType = body.productType || 'PHYSICAL';
            const store = stores.find((s) => s.id === vendorStoreProductsMatch[1]) || stores[0];
            const enabledServices: string[] = Array.isArray(store.enabledServices)
              ? store.enabledServices
              : ['PHYSICAL'];

            if (!enabledServices.includes(pType)) {
              const svcLabel =
                pType === 'DIGITAL'
                  ? 'Livre / Document PDF'
                  : pType === 'SERVICE'
                  ? 'Service / Transport au km'
                  : 'Bien Physique';
              return json(
                {
                  statusCode: 403,
                  message: `Le module "${svcLabel}" n’est pas encore acheté pour cette boutique. Activez-le par Mobile Money ou Carte avant de publier cette offre.`,
                },
                403,
              );
            }

            const fallbackImg =
              pType === 'DIGITAL'
                ? '/src/assets/images/digital_business_guide_1794397996870.jpg'
                : pType === 'SERVICE'
                ? '/src/assets/images/internet_fiber_service_1794397997131.jpg'
                : '/src/assets/images/marketplace_parcel_default_1794567970796.jpg';
            const cat = categories.find((c) => c.id === body.categoryId) || categories[0];

            const uploadedImages =
              Array.isArray(body.images) && body.images.length > 0
                ? body.images.map((url: string, idx: number) => ({
                    id: `img-${Date.now()}-${idx}`,
                    url,
                    altText: body.title,
                  }))
                : [{ id: `img-${Date.now()}`, url: fallbackImg, altText: body.title }];

            const rawVariants =
              Array.isArray(body.variants) && body.variants.length > 0
                ? body.variants.map((v: any, idx: number) => ({
                    id: `var-${Date.now()}-${idx}`,
                    sku: v.sku || `ZGO-${Date.now().toString().slice(-4)}-${idx + 1}`,
                    name: [v.size, v.color].filter(Boolean).join(' · ') || v.name || 'Standard',
                    attributes: {
                      size: v.size || undefined,
                      color: v.color || undefined,
                      colorHex: v.colorHex || undefined,
                    },
                    priceOverride: Number(v.priceOverride || body.basePriceUsd),
                    stockQty: Number(v.stockQty ?? body.stockQty ?? 10),
                  }))
                : [
                    {
                      id: `var-${Date.now()}`,
                      sku: `ZGO-${Date.now().toString().slice(-4)}`,
                      name: 'Standard',
                      priceOverride: Number(body.basePriceUsd),
                      stockQty: Number(body.stockQty) || 10,
                    },
                  ];

            const totalStock =
              pType === 'PHYSICAL'
                ? rawVariants.reduce((sum: number, v: any) => sum + (Number(v.stockQty) || 0), 0)
                : 9999;

            const tiers =
              Array.isArray(body.priceTiers) && body.priceTiers.length > 0
                ? body.priceTiers.map((t: any) => ({
                    minQty: Number(t.minQty) || 1,
                    maxQty: t.maxQty ? Number(t.maxQty) : null,
                    unitPriceUsd: Number(t.unitPriceUsd),
                    unitPriceCdf: Math.round(Number(t.unitPriceUsd) * exchangeRate),
                  }))
                : undefined;

            const newId = `prod-${Date.now()}`;
            const newProd = {
              id: newId,
              title: body.title,
              description: body.description,
              productType: pType,
              pricingUnit: body.pricingUnit || (pType === 'SERVICE' ? 'FLAT' : 'UNIT'),
              audience: body.audience || 'UNISEX',
              basePriceUsd: Number(body.basePriceUsd),
              basePriceCdf: body.basePriceCdf || Math.round(Number(body.basePriceUsd) * exchangeRate),
              priceTiers: tiers,
              status: 'PUBLISHED',
              stockQty: totalStock,
              lowStockThreshold: body.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : 5,
              digitalFileName: body.digitalFileName,
              digitalFileSize: body.digitalFileSize,
              digitalFileDataUrl: body.digitalFileDataUrl || undefined,
              digitalFileUrl: body.digitalFileUrl || undefined,
              serviceDuration: body.serviceDuration,
              fulfillmentDetails: body.fulfillmentDetails,
              rating: 5.0,
              reviewCount: 0,
              images: uploadedImages,
              variants: rawVariants,
              store: {
                id: store.id,
                storeName: store.storeName,
                slug: store.slug,
                ownerId: store.ownerId || 'usr-1',
                city: 'Goma (Nord-Kivu)',
                verifiedSupplier: Boolean(store.isCertified),
                isCertified: Boolean(store.isCertified),
              },
              category: cat,
            };
            products.unshift(newProd);
            json(enrichProduct(newProd), 201);
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

        const vendorStoreSubscribeAdMatch = path.match(/^\/vendors\/stores\/([^/]+)\/subscribe-ad$/);
        if (vendorStoreSubscribeAdMatch && method === 'POST') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStoreSubscribeAdMatch[1]) || stores[0];
            const plan = body.plan === 'ESSENTIAL_29' ? 'ESSENTIAL_29' : 'PRO_CAROUSEL_59';
            const feeUsd =
              plan === 'ESSENTIAL_29'
                ? Number(platformPricing.adEssentialMonthlyFeeUsd)
                : Number(platformPricing.adProCarouselMonthlyFeeUsd);
            const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            st.hasMonthlyAd = true;
            st.monthlyAdPlan = plan;
            st.monthlyAdFeeUsd = feeUsd;
            st.monthlyAdUntil = until;
            const paymentRef = `ZG-AD-${Math.floor(100000 + Math.random() * 900000)}`;
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Publicité mensuelle activée ($${feeUsd})`,
              body: `Les offres de ${st.storeName} apparaissent désormais dans le carrousel d’accueil et en tête du catalogue. Réf : ${paymentRef}.`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: currentUser.phone,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json({ store: st, paymentRef, feeUsd, plan });
          });
          return;
        }

        const vendorStoreCertifyMatch = path.match(/^\/vendors\/stores\/([^/]+)\/subscribe-certification$/);
        if (vendorStoreCertifyMatch && method === 'POST') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStoreCertifyMatch[1]) || stores[0];
            const feeUsd =
              body.billing === 'QUARTERLY'
                ? Number(platformPricing.certificationQuarterlyFeeUsd)
                : Number(platformPricing.certificationMonthlyFeeUsd);
            const days = body.billing === 'QUARTERLY' ? 90 : 30;
            const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
            st.isCertified = true;
            st.certificationStatus = 'ACTIVE';
            st.certificationFeeUsd = feeUsd;
            st.certifiedUntil = until;
            const paymentRef = `ZG-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Certification Vendeur activée ($${feeUsd})`,
              body: `Le badge « Vendeur Certifié » est maintenant affiché sur tous les produits de ${st.storeName}. Réf : ${paymentRef}.`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: currentUser.phone,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json({ store: st, paymentRef, feeUsd });
          });
          return;
        }

        const vendorStorePayoutBlockMatch = path.match(/^\/vendors\/stores\/([^/]+)\/payout-block$/);
        if (vendorStorePayoutBlockMatch && method === 'PATCH') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStorePayoutBlockMatch[1]);
            if (st) {
              const blocked = Boolean(body.blocked);
              st.payoutBlocked = blocked;
              st.payoutBlockReason = blocked
                ? body.reason || 'Retraits bloqués par l’administration suite à un litige client pertinent.'
                : null;
              notifications.unshift({
                id: `notif-${Date.now()}`,
                title: blocked
                  ? `Retraits bloqués : ${st.storeName}`
                  : `Retraits débloqués : ${st.storeName}`,
                body:
                  st.payoutBlockReason ||
                  'Les retraits Mobile Money / banque sont de nouveau autorisés sur votre boutique.',
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
            json(st || { success: true });
          });
          return;
        }

        const vendorStoreImmediateMatch = path.match(/^\/vendors\/stores\/([^/]+)\/immediate-withdrawal$/);
        if (vendorStoreImmediateMatch && method === 'PATCH') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStoreImmediateMatch[1]);
            if (st) {
              st.immediateWithdrawalEnabled = Boolean(body.enabled);
              notifications.unshift({
                id: `notif-${Date.now()}`,
                title: st.immediateWithdrawalEnabled
                  ? `Retrait immédiat autorisé : ${st.storeName}`
                  : `Délai standard 48h rétabli : ${st.storeName}`,
                body: st.immediateWithdrawalEnabled
                  ? `Le Super Admin autorise désormais les retraits immédiats sans attendre les 48h sur « ${st.storeName} ».`
                  : `Le délai standard de 48h dès paiement s’applique désormais à « ${st.storeName} ».`,
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }
            json(st || { success: true });
          });
          return;
        }

        const vendorStoreReviewMatch = path.match(/^\/vendors\/stores\/([^/]+)\/review$/);
        if (vendorStoreReviewMatch && method === 'PATCH') {
          readBody().then((body) => {
            const st = stores.find((s) => s.id === vendorStoreReviewMatch[1]);
            if (st) {
              if (body.status) st.status = body.status;
              if (body.commissionRate !== undefined) st.commissionRate = Number(body.commissionRate);
            }
            json(st || { success: true });
          });
          return;
        }

        const vendorStoreMatch = path.match(/^\/vendors\/stores\/([^/]+)$/);
        if (vendorStoreMatch && method === 'GET') {
          const s = stores.find((st) => st.id === vendorStoreMatch[1]) || stores[0];
          return json(s);
        }
        if (vendorStoreMatch && method === 'PATCH') {
          readBody().then((body) => {
            const s = stores.find((st) => st.id === vendorStoreMatch[1]);
            if (s) {
              if (body.storeName !== undefined) s.storeName = body.storeName;
              if (body.description !== undefined) s.description = body.description;
              if (body.isTransportAgency !== undefined) s.isTransportAgency = Boolean(body.isTransportAgency);
              if (Array.isArray(body.transportDestinations)) {
                s.transportDestinations = body.transportDestinations;
              }
            }
            json(s || { success: true });
          });
          return;
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

        // --- PLATFORM PRICING (ADMIN CONFIGURABLE, ZERO HARDCODE) & FINANCE ---
        if ((path === '/platform/pricing' || path === '/finance/pricing') && method === 'GET') {
          return json(platformPricing);
        }
        if ((path === '/platform/pricing' || path === '/finance/pricing') && method === 'PUT') {
          readBody().then((body) => {
            platformPricing = {
              storeCreationFeeUsd:
                body.storeCreationFeeUsd !== undefined
                  ? Math.max(0, Number(body.storeCreationFeeUsd))
                  : platformPricing.storeCreationFeeUsd,
              servicePhysicalFeeUsd:
                body.servicePhysicalFeeUsd !== undefined
                  ? Math.max(0, Number(body.servicePhysicalFeeUsd))
                  : platformPricing.servicePhysicalFeeUsd,
              serviceDigitalFeeUsd:
                body.serviceDigitalFeeUsd !== undefined
                  ? Math.max(0, Number(body.serviceDigitalFeeUsd))
                  : platformPricing.serviceDigitalFeeUsd,
              servicePrestationFeeUsd:
                body.servicePrestationFeeUsd !== undefined
                  ? Math.max(0, Number(body.servicePrestationFeeUsd))
                  : platformPricing.servicePrestationFeeUsd,
              certificationMonthlyFeeUsd:
                body.certificationMonthlyFeeUsd !== undefined
                  ? Math.max(0, Number(body.certificationMonthlyFeeUsd))
                  : platformPricing.certificationMonthlyFeeUsd,
              certificationQuarterlyFeeUsd:
                body.certificationQuarterlyFeeUsd !== undefined
                  ? Math.max(0, Number(body.certificationQuarterlyFeeUsd))
                  : platformPricing.certificationQuarterlyFeeUsd,
              adEssentialMonthlyFeeUsd:
                body.adEssentialMonthlyFeeUsd !== undefined
                  ? Math.max(0, Number(body.adEssentialMonthlyFeeUsd))
                  : platformPricing.adEssentialMonthlyFeeUsd,
              adProCarouselMonthlyFeeUsd:
                body.adProCarouselMonthlyFeeUsd !== undefined
                  ? Math.max(0, Number(body.adProCarouselMonthlyFeeUsd))
                  : platformPricing.adProCarouselMonthlyFeeUsd,
              defaultCommissionPercent:
                body.defaultCommissionPercent !== undefined
                  ? Math.min(50, Math.max(0, Number(body.defaultCommissionPercent)))
                  : platformPricing.defaultCommissionPercent,
              paymentTransactionFeePercent:
                body.paymentTransactionFeePercent !== undefined
                  ? Math.min(20, Math.max(0, Number(body.paymentTransactionFeePercent)))
                  : platformPricing.paymentTransactionFeePercent,
              allowImmediateVendorWithdrawal:
                body.allowImmediateVendorWithdrawal !== undefined
                  ? Boolean(body.allowImmediateVendorWithdrawal)
                  : platformPricing.allowImmediateVendorWithdrawal,
              updatedAt: new Date().toISOString(),
            };
            stores.forEach((st) => {
              if (st.commissionRate === undefined) st.commissionRate = platformPricing.defaultCommissionPercent;
            });
            json(platformPricing);
          });
          return;
        }

        // --- ANALYTICS (DIAGRAMMES VENDEUR & SUPER ADMIN) ---
        const vendorAnalyticsMatch = path.match(/^\/analytics\/vendor\/([^/]+)$/);
        if (vendorAnalyticsMatch && method === 'GET') {
          const storeId = vendorAnalyticsMatch[1];
          const targetStore = stores.find((s) => s.id === storeId) || stores[0];
          const storeSubOrders = orders.flatMap((o) =>
            (o.subOrders || [])
              .filter((so: any) => so.storeId === targetStore.id)
              .map((so: any) => ({ ...so, order: o })),
          );
          const storeProducts = products.filter((p) => p.store?.id === targetStore.id);
          const commPct = Number(targetStore.commissionRate ?? platformPricing.defaultCommissionPercent ?? 5) / 100;
          const grossOrderRevenue = storeSubOrders.reduce(
            (s, so) =>
              s +
              (so.items || []).reduce(
                (isum: number, it: any) => isum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
                0,
              ),
            0,
          );
          const baselineGross = Number(Math.max(grossOrderRevenue, Number(targetStore.balanceUsd || 0) * 1.15).toFixed(2));
          const platformComm = Number((baselineGross * commPct).toFixed(2));
          const netVendor = Number((baselineGross - platformComm).toFixed(2));

          const revenueSeries = [
            { label: 'Lun', revenueUsd: Math.round(baselineGross * 0.11), ordersCount: 4 },
            { label: 'Mar', revenueUsd: Math.round(baselineGross * 0.14), ordersCount: 6 },
            { label: 'Mer', revenueUsd: Math.round(baselineGross * 0.12), ordersCount: 5 },
            { label: 'Jeu', revenueUsd: Math.round(baselineGross * 0.16), ordersCount: 7 },
            { label: 'Ven', revenueUsd: Math.round(baselineGross * 0.18), ordersCount: 8 },
            { label: 'Sam', revenueUsd: Math.round(baselineGross * 0.17), ordersCount: 9 },
            { label: 'Dim', revenueUsd: Math.round(baselineGross * 0.12), ordersCount: 5 },
          ];

          const typeCounts: Record<string, number> = { PHYSICAL: 0, DIGITAL: 0, SERVICE: 0 };
          storeProducts.forEach((p) => {
            typeCounts[p.productType || 'PHYSICAL'] = (typeCounts[p.productType || 'PHYSICAL'] || 0) + 1;
          });
          const productTypeBreakdown = [
            { label: 'Biens Physiques', value: Math.max(typeCounts.PHYSICAL, targetStore.enabledServices?.includes('PHYSICAL') ? 3 : 0), color: '#26735B' },
            { label: 'Livres & PDF', value: Math.max(typeCounts.DIGITAL, targetStore.enabledServices?.includes('DIGITAL') ? 2 : 0), color: '#F2B84B' },
            { label: 'Services & Transport', value: Math.max(typeCounts.SERVICE, targetStore.enabledServices?.includes('SERVICE') ? 2 : 0), color: '#172320' },
          ].filter((x) => x.value > 0);

          const statusMap: Record<string, number> = { Payées: 0, Expédiées: 0, Livrées: 0 };
          storeSubOrders.forEach((so) => {
            if (so.status === 'DELIVERED') statusMap['Livrées'] += 1;
            else if (so.status === 'SHIPPED') statusMap['Expédiées'] += 1;
            else statusMap['Payées'] += 1;
          });
          const statusBreakdown = [
            { label: 'Livrées / Terminées', value: Math.max(12, statusMap['Livrées']), color: '#26735B' },
            { label: 'En livraison', value: Math.max(4, statusMap['Expédiées']), color: '#F2B84B' },
            { label: 'En préparation', value: Math.max(3, statusMap['Payées']), color: '#172320' },
          ];

          const topProducts = storeProducts.slice(0, 5).map((p, idx) => ({
            title: p.title,
            qty: Math.max(4, 24 - idx * 4),
            revenueUsd: Number((Number(p.basePriceUsd || 25) * Math.max(4, 24 - idx * 4)).toFixed(2)),
          }));

          return json({
            storeId: targetStore.id,
            storeName: targetStore.storeName,
            kpis: {
              grossRevenueUsd: baselineGross,
              netVendorUsd: netVendor,
              platformCommissionUsd: platformComm,
              totalOrders: Math.max(storeSubOrders.length, Number(targetStore.totalOrders || 44)),
              paidOrders: Math.max(storeSubOrders.filter((s) => s.order?.isPaid).length, Math.round(Number(targetStore.totalOrders || 44) * 0.92)),
              averageBasketUsd: Number((baselineGross / Math.max(1, Number(targetStore.totalOrders || 18))).toFixed(2)),
            },
            revenueSeries,
            productTypeBreakdown,
            statusBreakdown,
            topProducts,
          });
        }

        if (path === '/analytics/admin' && method === 'GET') {
          const feePct = Number(platformPricing.paymentTransactionFeePercent ?? 3.5);
          const totalStoreVolume = stores.reduce((s, st) => s + Number(st.balanceUsd || 0), 0);
          const grossVolumeUsd = Number((totalStoreVolume + orders.reduce((s, o) => s + Number(o.total || 0), 0)).toFixed(2));
          const totalTransactionFeesUsd = Number((grossVolumeUsd * (feePct / 100)).toFixed(2));
          const platformCommissionEarnedUsd = Number((grossVolumeUsd * (Number(platformPricing.defaultCommissionPercent || 5) / 100)).toFixed(2));

          const revenueSeries = [
            { label: 'Lun', revenueUsd: Math.round(grossVolumeUsd * 0.12), ordersCount: 18 },
            { label: 'Mar', revenueUsd: Math.round(grossVolumeUsd * 0.15), ordersCount: 24 },
            { label: 'Mer', revenueUsd: Math.round(grossVolumeUsd * 0.13), ordersCount: 21 },
            { label: 'Jeu', revenueUsd: Math.round(grossVolumeUsd * 0.17), ordersCount: 29 },
            { label: 'Ven', revenueUsd: Math.round(grossVolumeUsd * 0.16), ordersCount: 27 },
            { label: 'Sam', revenueUsd: Math.round(grossVolumeUsd * 0.18), ordersCount: 34 },
            { label: 'Dim', revenueUsd: Math.round(grossVolumeUsd * 0.09), ordersCount: 15 },
          ];

          const paymentMethods = [
            { label: 'Airtel Money', count: 64, volumeUsd: Number((grossVolumeUsd * 0.34).toFixed(2)), color: '#B84C43' },
            { label: 'M-Pesa Vodacom', count: 52, volumeUsd: Number((grossVolumeUsd * 0.31).toFixed(2)), color: '#26735B' },
            { label: 'Orange Money', count: 31, volumeUsd: Number((grossVolumeUsd * 0.18).toFixed(2)), color: '#F2B84B' },
            { label: 'MTN MoMo', count: 14, volumeUsd: Number((grossVolumeUsd * 0.09).toFixed(2)), color: '#172320' },
            { label: 'Visa / Mastercard', count: 9, volumeUsd: Number((grossVolumeUsd * 0.08).toFixed(2)), color: '#4A5568' },
          ];

          const storeRevenueSeries = stores
            .slice()
            .sort((a, b) => Number(b.balanceUsd || 0) - Number(a.balanceUsd || 0))
            .slice(0, 6)
            .map((st) => ({
              label: st.storeName.length > 16 ? `${st.storeName.slice(0, 15)}…` : st.storeName,
              revenueUsd: Number(st.balanceUsd || 0),
              ordersCount: Number(st.totalOrders || 0),
            }));

          const regionalBreakdown = [
            { label: 'Goma & Nord-Kivu', value: 46, color: '#26735B' },
            { label: 'Kinshasa', value: 24, color: '#F2B84B' },
            { label: 'Lubumbashi & Katanga', value: 15, color: '#172320' },
            { label: 'Bukavu & Sud-Kivu', value: 9, color: '#B84C43' },
            { label: 'Rwanda / Burundi / Ouganda', value: 6, color: '#5A7D7C' },
          ];

          return json({
            kpis: {
              grossVolumeUsd,
              totalOrders: stores.reduce((s, st) => s + Number(st.totalOrders || 0), 0) + orders.length,
              activeStores: stores.filter((s) => s.status === 'ACTIVE').length,
              totalStores: stores.length,
              openDisputes: disputes.filter((d) => d.status === 'OPEN').length,
              paymentTransactionFeePercent: feePct,
              totalTransactionFeesUsd,
              platformCommissionEarnedUsd,
              allowImmediateVendorWithdrawal: Boolean(platformPricing.allowImmediateVendorWithdrawal),
            },
            revenueSeries,
            paymentMethods,
            storeRevenueSeries,
            regionalBreakdown,
          });
        }

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

        // --- DISPUTES + PAYOUT FREEZE ---
        if (path === '/disputes' && method === 'GET') {
          return json(
            disputes.map((d) => {
              const st = stores.find((s) => s.id === d.storeId);
              return {
                ...d,
                storePayoutBlocked: Boolean(st?.payoutBlocked) || Boolean(d.payoutFrozen),
              };
            }),
          );
        }
        if (path === '/disputes' && method === 'POST') {
          readBody().then((body) => {
            const ord = orders.find((o) => o.id === body.orderId);
            const storeId = ord?.subOrders?.[0]?.storeId || 'store-1';
            const storeName = ord?.subOrders?.[0]?.store?.storeName || 'Boutique Partenaire';
            const severity = body.severity === 'HIGH' ? 'HIGH' : body.severity === 'LOW' ? 'LOW' : 'MEDIUM';
            const autoFreeze = severity === 'HIGH';

            const newDispute = {
              id: `disp-${Date.now()}`,
              orderId: body.orderId,
              orderNumber: ord?.orderNumber || body.orderNumber || 'ZGO-2026',
              buyerName: currentUser.fullName,
              storeId,
              storeName,
              amountUsd: Number(ord?.total || 0),
              status: 'OPEN',
              severity,
              payoutFrozen: autoFreeze,
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
            if (autoFreeze) {
              const st = stores.find((s) => s.id === storeId);
              if (st) {
                st.payoutBlocked = true;
                st.payoutBlockReason = `Retraits bloqués suite au litige pertinent sur la commande ${newDispute.orderNumber}.`;
              }
            }
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Litige ouvert pour ${newDispute.orderNumber}`,
              body: autoFreeze
                ? 'Litige critique signalé : fonds sous séquestre ET retraits de la boutique bloqués jusqu’à arbitrage.'
                : 'Les fonds restent bloqués sous séquestre pendant l’arbitrage (délai max 48h).',
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json({ ...newDispute, storePayoutBlocked: autoFreeze }, 201);
          });
          return;
        }
        const disputePayoutBlockMatch = path.match(/^\/disputes\/([^/]+)\/payout-block$/);
        if (disputePayoutBlockMatch && method === 'PATCH') {
          readBody().then((body) => {
            const d = disputes.find((x) => x.id === disputePayoutBlockMatch[1]);
            if (d) {
              const blocked = Boolean(body.blocked);
              d.payoutFrozen = blocked;
              const st = stores.find((s) => s.id === d.storeId);
              if (st) {
                st.payoutBlocked = blocked;
                st.payoutBlockReason = blocked
                  ? body.reason || `Retraits bloqués suite au litige pertinent (${d.orderNumber}).`
                  : null;
              }
              notifications.unshift({
                id: `notif-${Date.now()}`,
                title: blocked
                  ? `Retraits bloqués sur ${d.storeName}`
                  : `Retraits débloqués sur ${d.storeName}`,
                body: blocked
                  ? `Mesure conservatoire appliquée pour le litige ${d.orderNumber}.`
                  : `Le blocage des retraits lié à ${d.orderNumber} a été levé.`,
                isRead: false,
                createdAt: new Date().toISOString(),
              });
              return json({
                disputeId: d.id,
                storeId: d.storeId,
                payoutBlocked: blocked,
                reason: st?.payoutBlockReason || null,
              });
            }
            json({ success: true });
          });
          return;
        }
        const disputeResolveMatch = path.match(/^\/disputes\/([^/]+)\/resolve$/);
        if (disputeResolveMatch && method === 'PATCH') {
          readBody().then((body) => {
            const d = disputes.find((x) => x.id === disputeResolveMatch[1]);
            if (d) {
              d.status = body.status || 'RESOLVED_REFUND';
              d.payoutFrozen = false;
              const ord = orders.find((o) => o.id === d.orderId || o.orderNumber === d.orderNumber);
              if (ord) {
                ord.status = body.status === 'RESOLVED_REFUND' ? 'REFUNDED' : 'COMPLETED';
                ord.escrowStatus = body.status === 'RESOLVED_REFUND' ? 'REFUNDED_TO_BUYER' : 'RELEASED_TO_VENDOR';
              }
              const st = stores.find((s) => s.id === d.storeId);
              if (st) {
                const otherFrozen = disputes.some(
                  (other) => other.id !== d.id && other.storeId === d.storeId && other.payoutFrozen && other.status === 'OPEN',
                );
                if (!otherFrozen) {
                  st.payoutBlocked = false;
                  st.payoutBlockReason = null;
                }
              }
            }
            disputes = disputes.filter((x) => x.id !== disputeResolveMatch[1]);
            json({ success: true });
          });
          return;
        }

        // --- CHAT + GOOGLE MAPS SHARING + DELIVERY NEGOTIATION ---
        if (path === '/chat/conversations' && method === 'GET') {
          return json(conversations);
        }
        if (path === '/chat/conversations' && method === 'POST') {
          readBody().then((body) => {
            const existing = conversations.find(
              (c) =>
                (body.orderId && c.orderId === body.orderId && c.type === (body.type || 'CUSTOMER_DELIVERY')) ||
                (!body.orderId && c.storeId === body.storeId && c.productId === body.productId),
            );
            if (existing) return json(existing);
            const conv = {
              id: `conv-${Date.now()}`,
              type: body.type || 'CUSTOMER_VENDOR',
              orderId: body.orderId,
              orderNumber: body.orderNumber,
              storeId: body.storeId || 'store-1',
              storeName: body.storeName || 'Boutique Partenaire ZandoGo',
              city: body.city || 'Goma (Nord-Kivu)',
              productId: body.productId,
              productTitle: body.productTitle || 'Demande d’information produit',
              productImage: body.productImage || '/src/assets/images/marketplace_parcel_default_1794567970796.jpg',
              productPriceUsd: body.productPriceUsd,
              messages: [
                {
                  id: `m-${Date.now()}`,
                  conversationId: `conv-${Date.now()}`,
                  senderId: body.type === 'CUSTOMER_DELIVERY' ? 'usr-driver-1' : 'usr-vendor-1',
                  content:
                    body.type === 'CUSTOMER_DELIVERY'
                      ? 'Bonjour ! Partagez votre lien Google Maps à Goma et proposons un tarif juste pour votre livraison.'
                      : 'Bonjour ! Comment pouvons-nous vous aider concernant cette offre ?',
                  createdAt: new Date().toISOString(),
                },
              ],
            };
            conversations.unshift(conv);
            json(conv, 201);
          });
          return;
        }

        const chatLocationMatch = path.match(/^\/chat\/conversations\/([^/]+)\/location$/);
        if (chatLocationMatch && method === 'POST') {
          readBody().then((body) => {
            const conv = conversations.find((c) => c.id === chatLocationMatch[1]);
            const lat = Number(body.lat) || -1.6741;
            const lng = Number(body.lng) || 29.2285;
            const googleMapsUrl = body.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            const distKm = haversineKm(-1.6741, 29.2285, lat, lng);
            const locPayload = {
              lat,
              lng,
              label: body.label || 'Position Google Maps partagée',
              googleMapsUrl,
              distanceKm: distKm,
            };
            const msg = {
              id: `m-${Date.now()}`,
              conversationId: chatLocationMatch[1],
              senderId: currentUser.id,
              content: `Position Google Maps partagée (${locPayload.label}) — Distance estimée : ${distKm} km.`,
              location: locPayload,
              createdAt: new Date().toISOString(),
            };
            if (conv) {
              conv.clientLocation = locPayload;
              conv.distanceKm = distKm;
              conv.messages.push(msg);
              if (conv.deliveryNegotiation) conv.deliveryNegotiation.distanceKm = distKm;
              if (conv.orderId) {
                const job = deliveryJobs.find((j) => j.subOrder?.order?.id === conv.orderId);
                if (job) {
                  job.dropoffLat = lat;
                  job.dropoffLng = lng;
                  job.distanceKm = distKm;
                  job.clientGoogleMapsUrl = googleMapsUrl;
                }
              }
            }
            json({ message: msg, location: locPayload, distanceKm: distKm }, 201);
          });
          return;
        }

        const chatDeliveryOfferMatch = path.match(/^\/chat\/conversations\/([^/]+)\/delivery-offer$/);
        if (chatDeliveryOfferMatch && method === 'POST') {
          readBody().then((body) => {
            const conv = conversations.find((c) => c.id === chatDeliveryOfferMatch[1]);
            const action = body.action || 'PROPOSE';
            const feeUsd = Number(body.feeUsd ?? conv?.deliveryNegotiation?.proposedFeeUsd ?? 5.0);
            const agreed = action === 'ACCEPT';
            const nextStatus = agreed ? 'AGREED' : 'PENDING_DRIVER';

            const msg = {
              id: `m-${Date.now()}`,
              conversationId: chatDeliveryOfferMatch[1],
              senderId: currentUser.id,
              content: agreed
                ? `Tarif de livraison accepté à $${feeUsd.toFixed(2)}. Commande prête pour règlement Mobile Money ou Carte !`
                : `Proposition de tarif livraison : $${feeUsd.toFixed(2)} (${conv?.distanceKm || 3.4} km).`,
              deliveryProposal: {
                feeUsd,
                originalFeeUsd: conv?.deliveryNegotiation?.originalFeeUsd ?? 6.5,
                distanceKm: conv?.distanceKm || 5.2,
                status: agreed ? 'ACCEPTED' : 'PROPOSED',
                proposedBy: 'CUSTOMER',
                orderId: conv?.orderId,
              },
              createdAt: new Date().toISOString(),
            };

            let updatedOrder: any = null;
            if (conv) {
              conv.messages.push(msg);
              conv.deliveryNegotiation = {
                orderId: conv.orderId,
                originalFeeUsd: conv.deliveryNegotiation?.originalFeeUsd ?? 6.5,
                proposedFeeUsd: feeUsd,
                agreedFeeUsd: agreed ? feeUsd : null,
                status: nextStatus,
                proposedBy: 'CUSTOMER',
                distanceKm: conv.distanceKm,
              };

              if (conv.orderId) {
                const ord = orders.find((o) => o.id === conv.orderId);
                const job = deliveryJobs.find((j) => j.subOrder?.order?.id === conv.orderId);
                if (job) {
                  job.negotiatedFeeUsd = feeUsd;
                  job.feeNegotiationStatus = nextStatus;
                  if (agreed) job.estimatedFee = feeUsd;
                }
                if (ord) {
                  ord.deliveryNegotiationStatus = nextStatus;
                  if (agreed) {
                    const itemsSubtotal = Math.max(0, Number(ord.total) - Number(ord.deliveryFee || 0));
                    ord.deliveryFee = feeUsd;
                    ord.total = Number((itemsSubtotal + feeUsd).toFixed(2));
                    if (job?.subOrder?.order) job.subOrder.order.total = ord.total;
                  }
                  updatedOrder = ord;
                }
              }
            }

            json({ message: msg, deliveryNegotiation: conv?.deliveryNegotiation, order: updatedOrder }, 201);
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
  plugins: [
    react(),
    mockApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'ZandoGo — Place de Marché RDC & Environs',
        short_name: 'ZandoGo',
        description:
          'Place de marché B2B & B2C en RDC : Mobile Money, cartes bancaires, agences de transport, livres numériques et séquestre garanti.',
        theme_color: '#172320',
        background_color: '#F5F2EB',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});
