import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function mockApiPlugin(): Plugin {
  let exchangeRate = 2850;
  const rateHistory = [
    { id: 'rate-2', rate: 2850, effectiveFrom: new Date().toISOString() },
    { id: 'rate-1', rate: 2800, effectiveFrom: '2026-02-15T08:00:00Z' },
  ];

  let platformPricing = {
    storeCreationFeeUsd: 25,
    certificationMonthlyFeeUsd: 15,
    certificationQuarterlyFeeUsd: 39,
    adEssentialMonthlyFeeUsd: 29,
    adProCarouselMonthlyFeeUsd: 59,
    defaultCommissionPercent: 5,
    updatedAt: new Date().toISOString(),
  };

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
      '(Paiement valide via agregateur MaishaPay RDC & confirmation SMS Africas Talking.) Tj',
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
      providerName: 'Kota Express Moto',
      code: 'EXPRESS_MOTO',
      name: 'Coursier Moto Express (Tarif négociable + GPS)',
      estimatedTime: 'Moins de 2 heures',
      feeUsd: 6.5,
      feeCdf: 18525,
      description: 'Livraison express à Kinshasa, Lubumbashi et Goma. Partagez votre point Google Maps et négociez le tarif avec le livreur.',
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
      store: { id: 'store-1', storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
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
      store: { id: 'store-1', storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[2],
    },
    {
      id: 'prod-9',
      title: 'Robe Portefeuille Wax Contemporaine — Femme',
      description: 'Coupe cintrée élégante réalisée à Kinshasa avec véritable pagne Wax et finitions tailleur. Idéale bureau et cérémonies.',
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
      store: { id: 'store-1', storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
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
      store: { id: 'store-1', storeName: 'Boutique Victoire Wax', slug: 'victoire-wax', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[2],
    },
    {
      id: 'prod-3',
      title: 'Guide d’Investissement & Stratégie PME RDC (Livre PDF)',
      description: 'Livre numérique de 142 pages rédigé par des experts fiduciaires de Kinshasa : fiscalité OHADA, grille salariale locale et modèles de contrats. Téléchargement direct après paiement.',
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
      store: { id: 'store-digital', storeName: 'Kinshasa Business Insights', slug: 'kin-insights', ownerId: 'usr-1', rating: 5.0, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[4],
    },
    {
      id: 'prod-4',
      title: 'Abonnement Internet Fibre Pro 100 Mbps (30 Jours)',
      description: 'Connexion très haut débit illimitée avec routeur Wi-Fi 6 offert en prêt. Installation et configuration par technicien certifié sous 24h à Gombe, Ngaliema ou Limete.',
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
        { id: 'img-fiber', url: '/src/assets/images/internet_fiber_service_1794397997131.jpg', altText: 'Internet Fibre Pro Kinshasa' },
      ],
      variants: [
        { id: 'var-fiber-100', sku: 'SRV-FIBER-100', name: 'Forfait 100 Mbps Illimité', attributes: { capacity: '100 Mbps' }, priceOverride: 75, stockQty: 50 },
      ],
      store: { id: 'store-telecom', storeName: 'KinConnect Télécoms', slug: 'kin-connect', ownerId: 'usr-2', rating: 4.8, city: 'Kinshasa', verifiedSupplier: true },
      category: categories[5],
    },
    {
      id: 'prod-5',
      title: 'Transport & Course Express Moto Dédiée (Tarif au km)',
      description: 'Prestation de transport urbain et livraison de colis à la demande dans le Grand Kinshasa. Tarif calculé au kilomètre réel via Google Maps avec suivi GPS du coursier.',
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
      store: { id: 'store-logistics', storeName: 'Kota Express Logistique', slug: 'kota-express', ownerId: 'usr-1', rating: 4.9, city: 'Kinshasa', verifiedSupplier: true },
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
      store: { id: 'store-2', storeName: 'Kin Digital Gombe', slug: 'kin-digital', ownerId: 'usr-1', rating: 4.7, city: 'Lubumbashi', verifiedSupplier: true },
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
      store: { id: 'store-kivu', storeName: 'Coopérative Kivu Terroir', slug: 'kivu-terroir', ownerId: 'usr-3', rating: 4.9, city: 'Goma', verifiedSupplier: true },
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
          title: 'Guide d’Investissement & Stratégie PME RDC (Livre PDF)',
          downloadUrl: '/api/downloads/prod-3/ord-1002',
          fileName: 'guide-strategie-pme-rdc-2026.pdf',
        },
      ],
      paymentGateway: 'MAISHAPAY',
      maishaPayRef: 'MP-RDC-2026-88421',
      noDeliveryNeeded: true,
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
      deliveryNegotiationStatus: 'PENDING_DRIVER',
      createdAt: '2026-03-11T08:10:00Z',
      total: 386.5,
      deliveryFee: 6.5,
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
      ownerId: 'usr-1',
      storeName: 'Boutique Victoire Wax',
      slug: 'victoire-wax',
      storeType: 'RETAIL',
      description: 'Maison de couture et grossiste de pagnes et tissus haut de gamme à Kinshasa.',
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
      storeName: 'Kin Digital Gombe',
      slug: 'kin-digital',
      storeType: 'RETAIL',
      description: 'Importateur officiel smartphones, informatique et accessoires high-tech à Kinshasa & Lubumbashi.',
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
      storeName: 'Kinshasa Business Insights',
      slug: 'kin-insights',
      storeType: 'DIGITAL',
      description: 'Vente d’études sectorielles, templates contractuels et e-books pour entrepreneurs en RDC.',
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
      storeName: 'KinConnect Télécoms',
      slug: 'kin-connect',
      storeType: 'SERVICES',
      description: 'Opérateur télécom agréé : forfaits data, fibre optique professionnelle et assistance réseau.',
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
      storeName: 'Kota Express Logistique',
      slug: 'kota-express',
      storeType: 'LOGISTICS',
      description: 'Flotte de 45 coursiers motos et camionnettes pour livraison express dans tout Kinshasa.',
      status: 'ACTIVE',
      fulfillmentMode: 'LOGISTICS_PROVIDER',
      commissionRate: 5,
      balanceUsd: 2180.0,
      totalOrders: 310,
      payoutBlocked: false,
      payoutBlockReason: null,
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
      description: 'Producteurs de café Arabica et produits agroalimentaires du Sud-Kivu.',
      status: 'ACTIVE',
      fulfillmentMode: 'PLATFORM_DELIVERY',
      commissionRate: 5,
      balanceUsd: 920.0,
      totalOrders: 41,
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
      storeName: 'Kin Digital Gombe',
      amountUsd: 380,
      status: 'OPEN',
      severity: 'HIGH',
      payoutFrozen: false,
      reasonCategory: 'PRODUCT_NOT_RECEIVED',
      reason: 'Retard de livraison supérieur à 48h sur smartphone vers Lubumbashi — demande de blocage des retraits vendeur.',
      description: 'Retard de livraison supérieur à 48h sur smartphone vers Lubumbashi — demande de blocage des retraits vendeur.',
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
      negotiatedFeeUsd: 6.5,
      feeNegotiationStatus: 'AGREED',
      distanceKm: 4.8,
      pickupLat: -4.321,
      pickupLng: 15.312,
      dropoffLat: -4.3015,
      dropoffLng: 15.3052,
      clientGoogleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-4.3015,15.3052',
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
    {
      id: 'del-2',
      status: 'ASSIGNED',
      estimatedFee: 6.5,
      negotiatedFeeUsd: 5.0,
      feeNegotiationStatus: 'PENDING_DRIVER',
      distanceKm: 7.4,
      pickupLat: -4.308,
      pickupLng: 15.312,
      dropoffLat: -4.3412,
      dropoffLng: 15.2654,
      clientGoogleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-4.3412,15.2654',
      otpCode: '7194',
      agent: {
        id: 'agent-1',
        vehicleType: 'Moto Express Yamaha',
        user: { fullName: 'Patrick Bolamba', phone: '+243 81 988 22 33' },
      },
      trackingPings: [
        { lat: -4.308, lng: 15.312, recordedAt: new Date(Date.now() - 400000).toISOString() },
      ],
      subOrder: {
        store: { storeName: 'Kin Digital Gombe', city: 'Kinshasa (Gombe)' },
        order: {
          id: 'ord-1004',
          orderNumber: 'ZGO-2026-1004',
          total: 386.5,
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
      storeName: 'Patrick Bolamba · Coursier Moto (Avant paiement)',
      city: 'Kinshasa (Ngaliema)',
      productId: 'prod-6',
      productTitle: 'Livraison Commande ZGO-2026-1004 (Avant paiement)',
      productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
      productPriceUsd: 6.5,
      distanceKm: 7.4,
      clientLocation: {
        lat: -4.3412,
        lng: 15.2654,
        label: 'Ngaliema · Macampagne',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-4.3412,15.2654',
        distanceKm: 7.4,
      },
      deliveryNegotiation: {
        orderId: 'ord-1004',
        originalFeeUsd: 6.5,
        proposedFeeUsd: 5.0,
        agreedFeeUsd: null,
        status: 'PENDING_DRIVER',
        proposedBy: 'CUSTOMER',
        distanceKm: 7.4,
      },
      messages: [
        {
          id: 'm-40',
          conversationId: 'conv-4',
          senderId: 'usr-driver-1',
          content:
            'Bonjour M. Kitenge ! Avant de régler votre commande ZGO-2026-1004, partagez votre point Google Maps exact afin que nous fixions un tarif de course juste.',
          createdAt: new Date(Date.now() - 1200000).toISOString(),
        },
        {
          id: 'm-41',
          conversationId: 'conv-4',
          senderId: 'usr-1',
          content: 'Voici ma position Google Maps à Macampagne (Ngaliema). Je propose $5.00 pour la course.',
          location: {
            lat: -4.3412,
            lng: 15.2654,
            label: 'Ngaliema · Macampagne (7.4 km)',
            googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-4.3412,15.2654',
            distanceKm: 7.4,
          },
          deliveryProposal: {
            feeUsd: 5.0,
            originalFeeUsd: 6.5,
            distanceKm: 7.4,
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
      orderId: 'ord-1001',
      orderNumber: 'ZGO-2026-1001',
      storeId: 'store-logistics',
      storeName: 'Patrick Bolamba · Kota Express Moto',
      city: 'Kinshasa',
      productId: 'prod-2',
      productTitle: 'Livraison Commande ZGO-2026-1001',
      productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
      productPriceUsd: 6.5,
      distanceKm: 4.8,
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
          return json(enrichProduct(prod));
        }

        // --- REAL DIGITAL PDF DOWNLOAD ---
        const downloadMatch = path.match(/^\/downloads\/([^/]+)\/([^/]+)$/);
        if (downloadMatch && method === 'GET') {
          const [, prodId, ordId] = downloadMatch;
          const prod = products.find((p) => p.id === prodId) || products.find((p) => p.productType === 'DIGITAL');
          const ord = orders.find((o) => o.id === ordId);
          const fileName = prod?.digitalFileName || 'document-zandogo.pdf';
          const pdfBytes = buildRealPdfBuffer(
            prod?.title || 'Document Numerique ZandoGo',
            ord?.orderNumber || 'ZGO-2026',
            fileName,
          );
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
            const foundProd = products.find((p) => p.variants.some((v: any) => v.id === body.productVariantId)) || products[0];
            const foundVar = foundProd.variants.find((v: any) => v.id === body.productVariantId) || foundProd.variants[0];
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
                    ? `Tarif de livraison accepté à $${nextFee.toFixed(2)} pour ${ord?.orderNumber || ''}. Vous pouvez procéder au paiement MaishaPay.`
                    : `Contre-proposition du livreur : $${nextFee.toFixed(2)} pour parcourir les ${job.distanceKm || 5} km jusqu’à votre point Google Maps.`,
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
                body: `Livreur Patrick Bolamba — Commande ${ord?.orderNumber || ''}.`,
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
            const hasDigital = cart.items.some((i: any) => i.variant?.product?.productType === 'DIGITAL');
            const onlyDigital = cart.items.length > 0 && cart.items.every((i: any) => i.variant?.product?.productType === 'DIGITAL');
            const selectedDel = onlyDigital
              ? {
                  id: 'del-opt-digital',
                  providerName: 'ZandoGo Instant Cloud',
                  code: 'CLICK_AND_COLLECT',
                  name: 'Livraison Numérique Immédiate (Sans frais)',
                  estimatedTime: 'Instantané après paiement',
                  feeUsd: 0,
                  feeCdf: 0,
                  description: 'Téléchargement direct du fichier PDF sans livreur ni adresse requise.',
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
              .map((i: any) => {
                const prod = products.find((p) => p.id === i.variant?.product?.id);
                return {
                  productId: i.variant?.product?.id || 'prod-3',
                  title: i.variant?.product?.title || 'Document Numérique PDF',
                  downloadUrl: `/api/downloads/${i.variant?.product?.id || 'prod-3'}/${newOrderId}`,
                  fileName: prod?.digitalFileName || 'document-zandogo.pdf',
                };
              });

            const chosenAddr = onlyDigital ? undefined : addresses.find((a) => a.id === body.deliveryAddressId) || addresses[0];
            const distKm = chosenAddr ? haversineKm(-4.321, 15.312, chosenAddr.latitude, chosenAddr.longitude) : 0;

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
              deliveryNegotiationStatus: onlyDigital ? 'NONE' : 'NONE',
              deliveryAddress: chosenAddr,
              currency: body.currency || 'USD',
              deliveryOption: selectedDel,
              hasDigitalItems: digitalDownloads.length > 0,
              digitalDownloads: digitalDownloads.length > 0 ? digitalDownloads : undefined,
              smsDispatches: [],
              subOrders: [
                {
                  id: `sub-${Date.now()}`,
                  storeId: 'store-1',
                  status: 'PENDING',
                  buyerName: currentUser.fullName,
                  destinationCity: onlyDigital
                    ? 'Téléchargement numérique immédiat'
                    : chosenAddr
                    ? `Kinshasa (${chosenAddr.commune})`
                    : 'Kinshasa',
                  store: { storeName: onlyDigital ? 'Kinshasa Business Insights' : 'Boutique Victoire Wax' },
                  items: cart.items.map((it: any) => ({
                    id: it.id,
                    quantity: it.quantity,
                    productTitle: it.variant?.product?.title,
                    unitPrice: Number(it.unitPriceSnapshot),
                    productType: it.variant?.product?.productType || 'PHYSICAL',
                    pricingUnit: it.variant?.product?.pricingUnit || 'UNIT',
                    variantName: it.variant?.name,
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

            let deliveryConversationId: string | undefined;

            if (!onlyDigital && deliveryFee >= 0 && selectedDel.code !== 'CLICK_AND_COLLECT') {
              const jobId = `del-${Date.now()}`;
              const dropLat = chosenAddr?.latitude || -4.3015;
              const dropLng = chosenAddr?.longitude || 15.3052;
              const mapsLink = `https://www.google.com/maps/search/?api=1&query=${dropLat},${dropLng}`;

              deliveryJobs.unshift({
                id: jobId,
                status: 'ASSIGNED',
                estimatedFee: deliveryFee,
                negotiatedFeeUsd: deliveryFee,
                feeNegotiationStatus: 'NONE',
                distanceKm: distKm || 5.2,
                pickupLat: -4.321,
                pickupLng: 15.312,
                dropoffLat: dropLat,
                dropoffLng: dropLng,
                clientGoogleMapsUrl: mapsLink,
                otpCode: String(1000 + Math.floor(Math.random() * 8999)),
                agent: {
                  id: 'agent-1',
                  vehicleType: 'Moto Express Yamaha',
                  user: { fullName: 'Patrick Bolamba', phone: '+243 81 988 22 33' },
                },
                trackingPings: [{ lat: -4.321, lng: 15.312, recordedAt: new Date().toISOString() }],
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

              const convId = `conv-del-${Date.now()}`;
              deliveryConversationId = convId;
              conversations.unshift({
                id: convId,
                type: 'CUSTOMER_DELIVERY',
                orderId: newOrderId,
                orderNumber,
                storeId: 'store-logistics',
                storeName: 'Patrick Bolamba · Coursier Moto (Avant paiement)',
                city: chosenAddr?.commune ? `Kinshasa (${chosenAddr.commune})` : 'Kinshasa',
                productTitle: `Livraison ${orderNumber}`,
                productImage: '/src/assets/images/express_courier_moto_1794397998233.jpg',
                productPriceUsd: deliveryFee,
                distanceKm: distKm || 5.2,
                clientLocation: {
                  lat: dropLat,
                  lng: dropLng,
                  label: `${chosenAddr?.commune || 'Kinshasa'} · ${chosenAddr?.quartier || ''}`,
                  googleMapsUrl: mapsLink,
                  distanceKm: distKm || 5.2,
                },
                deliveryNegotiation: {
                  orderId: newOrderId,
                  originalFeeUsd: deliveryFee,
                  proposedFeeUsd: deliveryFee,
                  agreedFeeUsd: null,
                  status: 'NONE',
                  distanceKm: distKm || 5.2,
                },
                messages: [
                  {
                    id: `m-${Date.now()}`,
                    conversationId: convId,
                    senderId: 'usr-driver-1',
                    content: `Bonjour ! Course prête pour ${orderNumber} (${distKm || 5.2} km, tarif initial $${deliveryFee.toFixed(2)}). Vous pouvez partager votre position Google Maps ou proposer un tarif avant de payer.`,
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
                ? `Montant : $${grandTotal.toFixed(2)}. Aucune livraison requise — lien de téléchargement PDF activé dès paiement.`
                : `Montant total : $${grandTotal.toFixed(2)}. Discutez le tarif coursier ou réglez via MaishaPay.`,
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

        if (path === '/payments/initiate' && method === 'POST') {
          readBody().then((body) => {
            const ord = orders.find((o) => o.id === body.orderId);
            const maishaPayRef = `MP-RDC-${Date.now().toString().slice(-6)}`;
            const smsTarget = body.phoneNumber || currentUser.phone || '+243820001122';

            if (ord) {
              if (body.methodCode === 'CASH_ON_DELIVERY') {
                ord.status = 'PROCESSING';
                ord.isPaid = false;
                ord.paymentStatus = 'UNPAID';
                ord.paymentGateway = 'CASH_ON_DELIVERY';
              } else {
                ord.status = ord.noDeliveryNeeded ? 'COMPLETED' : 'ESCROW_HELD';
                ord.isPaid = true;
                ord.paymentStatus = 'PAID';
                ord.paymentGateway = 'MAISHAPAY';
                ord.maishaPayRef = maishaPayRef;
                ord.escrowStatus = ord.noDeliveryNeeded ? 'RELEASED_TO_VENDOR' : 'HELD';
              }

              const smsBody = ord.digitalDownloads?.length
                ? `[Africa's Talking SMS] ZandoGo : Paiement $${Number(ord.total).toFixed(2)} confirmé via MaishaPay (${maishaPayRef}). Téléchargez votre livre : ${ord.digitalDownloads[0].fileName}`
                : `[Africa's Talking SMS] ZandoGo : Commande ${ord.orderNumber} confirmée via MaishaPay (${maishaPayRef}). Séquestre actif.`;

              const smsRecord = {
                id: `sms-${Date.now()}`,
                provider: 'AFRICASTALKING',
                to: smsTarget,
                message: smsBody,
                sentAt: new Date().toISOString(),
              };
              ord.smsDispatches = [smsRecord, ...(ord.smsDispatches || [])];

              notifications.unshift({
                id: `notif-${Date.now()}`,
                title:
                  body.methodCode === 'CASH_ON_DELIVERY'
                    ? 'Commande confirmée + SMS Africa’s Talking envoyé'
                    : `Paiement MaishaPay confirmé (${maishaPayRef})`,
                body: smsBody,
                channel: 'SMS_AFRICASTALKING',
                smsRecipient: smsTarget,
                isRead: false,
                createdAt: new Date().toISOString(),
              });
            }

            json({
              status: 'SUCCESS',
              aggregator: 'MAISHAPAY',
              maishaPayRef: body.methodCode === 'CASH_ON_DELIVERY' ? undefined : maishaPayRef,
              smsProvider: 'AFRICASTALKING',
              smsRecipient: smsTarget,
              digitalDownloads: ord?.digitalDownloads || [],
              noDeliveryNeeded: Boolean(ord?.noDeliveryNeeded),
              order: ord,
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
          const maishaPayRef = `MP-RDC-${Date.now().toString().slice(-6)}`;
          if (ord) {
            ord.status = ord.noDeliveryNeeded ? 'COMPLETED' : 'ESCROW_HELD';
            ord.isPaid = true;
            ord.paymentStatus = 'PAID';
            ord.paymentGateway = 'MAISHAPAY';
            ord.maishaPayRef = maishaPayRef;
            ord.escrowStatus = ord.noDeliveryNeeded ? 'RELEASED_TO_VENDOR' : 'HELD';
            const smsMsg = `[Africa's Talking SMS] ZandoGo : Paiement MaishaPay (${maishaPayRef}) validé pour ${ord.orderNumber}.`;
            ord.smsDispatches = [
              { id: `sms-${Date.now()}`, provider: 'AFRICASTALKING', to: currentUser.phone, message: smsMsg, sentAt: new Date().toISOString() },
              ...(ord.smsDispatches || []),
            ];
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Règlement MaishaPay (${maishaPayRef})`,
              body: smsMsg,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: currentUser.phone,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
          }
          return json({
            success: true,
            aggregator: 'MAISHAPAY',
            maishaPayRef,
            message: `Commande réglée via MaishaPay (${maishaPayRef}) et notification SMS Africa's Talking envoyée.`,
          });
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
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const requestedStoreId = searchParams.get('storeId') || 'store-1';
          const targetStore = stores.find((s) => s.id === requestedStoreId) || stores[0];
          const blockingDisputes = disputes
            .filter((d) => d.storeId === targetStore.id && d.payoutFrozen && d.status === 'OPEN')
            .map((d) => ({ id: d.id, orderNumber: d.orderNumber, reason: d.reason }));
          const isBlocked = Boolean(targetStore?.payoutBlocked) || blockingDisputes.length > 0;

          const lockedEscrowUsd = orders
            .filter((o) => o.escrowStatus === 'HELD')
            .reduce((s, o) => s + Number(o.total || 0), 0);
          const availableBalanceUsd = Number(targetStore?.balanceUsd ?? 1840.5);
          return json({
            storeId: targetStore.id,
            storeName: targetStore.storeName,
            availableBalanceUsd,
            lockedEscrowUsd,
            totalEarnedUsd: availableBalanceUsd + 420.0,
            currency: 'USD',
            payoutBlocked: isBlocked,
            payoutBlockReason: isBlocked
              ? targetStore?.payoutBlockReason ||
                `Retraits bloqués suite au litige pertinent (${blockingDisputes[0]?.orderNumber || 'en cours'}).`
              : null,
            blockingDisputes,
            payouts,
          });
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

            const amount = Number(body.amountUsd ?? body.amount ?? 0);
            if (amount <= 0) {
              return json({ statusCode: 400, message: 'Montant de retrait invalide.' }, 400);
            }

            const newPayout = {
              id: `pay-out-${Date.now()}`,
              amountUsd: amount,
              method: body.method || 'Mobile Money',
              destination: body.destination || '+243820001122',
              status: 'REQUESTED',
              createdAt: new Date().toISOString(),
            };
            payouts.unshift(newPayout);
            if (targetStore && typeof targetStore.balanceUsd === 'number') {
              targetStore.balanceUsd = Math.max(0, Number((targetStore.balanceUsd - amount).toFixed(2)));
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

            const feeUsd = Number(platformPricing.storeCreationFeeUsd || 0);
            const maishaRef = `MP-STORE-${Math.floor(100000 + Math.random() * 900000)}`;
            const smsTarget = body.customerPhone || currentUser.phone || '+243820001122';

            const newStore = {
              id: `store-${Date.now()}`,
              ownerId: currentUser.id,
              storeName: body.storeName,
              slug: body.slug,
              storeType: body.storeType || 'RETAIL',
              description: body.description,
              status: 'ACTIVE' as const,
              fulfillmentMode: body.fulfillmentMode || 'PLATFORM_DELIVERY',
              commissionRate: platformPricing.defaultCommissionPercent,
              balanceUsd: 0,
              totalOrders: 0,
              payoutBlocked: false,
              payoutBlockReason: null,
              creationFeePaidUsd: feeUsd,
              maishaPayRef: maishaRef,
              isCertified: false,
              certificationStatus: 'NONE',
              hasMonthlyAd: false,
              monthlyAdPlan: 'NONE',
              createdAt: new Date().toISOString(),
            };
            stores.push(newStore);

            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Boutique achetée & activée (${feeUsd}$ via MaishaPay)`,
              body: `[Africa's Talking SMS] Boutique "${newStore.storeName}" créée (Réf MaishaPay : ${maishaRef}). Vous pouvez maintenant publier vos produits.`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: smsTarget,
              isRead: false,
              createdAt: new Date().toISOString(),
            });

            json({ ...newStore, creationFeeUsd: feeUsd, maishaPayRef: maishaRef }, 201);
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
            const fallbackImg =
              pType === 'DIGITAL'
                ? '/src/assets/images/digital_business_guide_1794397996870.jpg'
                : pType === 'SERVICE'
                ? '/src/assets/images/internet_fiber_service_1794397997131.jpg'
                : '/src/assets/images/marketplace_parcel_default_1794567970796.jpg';
            const store = stores.find((s) => s.id === vendorStoreProductsMatch[1]) || stores[0];
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

            const newProd = {
              id: `prod-${Date.now()}`,
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
                city: 'Kinshasa',
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
            const maishaRef = `MP-AD-${Math.floor(100000 + Math.random() * 900000)}`;
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Publicité mensuelle activée (${feeUsd}$ via MaishaPay)`,
              body: `Les offres de ${st.storeName} apparaissent désormais dans le carrousel d’accueil et en tête du catalogue. Réf : ${maishaRef}.`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: currentUser.phone,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json({ store: st, maishaPayRef: maishaRef, feeUsd, plan });
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
            const maishaRef = `MP-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
            notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Certification Vendeur activée (${feeUsd}$ via MaishaPay)`,
              body: `Le badge « Vendeur Certifié » est maintenant affiché sur tous les produits de ${st.storeName}. Réf : ${maishaRef}.`,
              channel: 'SMS_AFRICASTALKING',
              smsRecipient: currentUser.phone,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
            json({ store: st, maishaPayRef: maishaRef, feeUsd });
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
              updatedAt: new Date().toISOString(),
            };
            stores.forEach((st) => {
              if (st.commissionRate === undefined) st.commissionRate = platformPricing.defaultCommissionPercent;
            });
            json(platformPricing);
          });
          return;
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
              city: body.city || 'Kinshasa',
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
                      ? 'Bonjour ! Partagez votre lien Google Maps et proposons un tarif juste pour votre livraison.'
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
            const lat = Number(body.lat) || -4.325;
            const lng = Number(body.lng) || 15.322;
            const googleMapsUrl = body.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            const distKm = haversineKm(-4.321, 15.312, lat, lng);
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
                ? `Tarif de livraison accepté à $${feeUsd.toFixed(2)}. Commande prête pour règlement MaishaPay !`
                : `Proposition de tarif livraison : $${feeUsd.toFixed(2)} (${conv?.distanceKm || 5.2} km).`,
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
  plugins: [react(), mockApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});
