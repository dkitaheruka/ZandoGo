/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

if (process.env.NODE_ENV === 'production') {
  console.error('Le seed de démonstration est interdit en production.');
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/zandogo?schema=public',
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES = [
  { name: 'Électronique & High-Tech', slug: 'electronique-high-tech', icon: 'smartphone' },
  { name: 'Habits & Mode — Femme', slug: 'habits-mode-femme', icon: 'sparkles' },
  { name: 'Habits & Mode — Homme', slug: 'habits-mode-homme', icon: 'shirt' },
  { name: 'Alimentation & Terroir Kivu', slug: 'alimentation-terroir-kivu', icon: 'coffee' },
  { name: 'Livres & Documents PDF', slug: 'livres-documents-pdf', icon: 'book-open' },
  { name: 'Services & Télécoms', slug: 'services-telecoms', icon: 'wifi' },
  { name: 'Transport & Coursiers (au km)', slug: 'transport-coursiers-km', icon: 'truck' },
];

async function upsertUserWithRole({ email, phone, password, fullName, role, scopeId = null }) {
  const normalizedEmail = email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        phone: phone.trim(),
        passwordHash,
        fullName,
        status: 'ACTIVE',
        preferredCurrency: 'USD',
        preferredLanguage: 'fr',
      },
    });
    console.log(`✓ Compte ${role} créé : ${normalizedEmail}`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });
    console.log(`✓ Compte ${role} existant vérifié : ${normalizedEmail}`);
  }

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: user.id, role, scopeId },
    });
  }
  return user;
}

async function main() {
  console.log('Initialisation de la base de données ZandoGo...');

  // 1. Catégories de base (idempotent)
  const categoryMap = new Map();
  for (const cat of DEFAULT_CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon },
      create: cat,
    });
    categoryMap.set(cat.slug, saved);
  }
  console.log(`✓ ${DEFAULT_CATEGORIES.length} catégories vérifiées.`);

  // 2. Comptes de test & administration (idempotent)
  const adminUser = await upsertUserWithRole({
    email: process.env.SEED_ADMIN_EMAIL || 'admin@demo.zandogo.local',
    phone: process.env.SEED_ADMIN_PHONE || '+243810000001',
    password: process.env.SEED_ADMIN_PASSWORD || 'DemoZandoGo2026!',
    fullName: 'Super Admin Démo',
    role: 'SUPER_ADMIN',
  });

  const vendorUser = await upsertUserWithRole({
    email: 'vendeur@demo.zandogo.local',
    phone: '+243810000002',
    password: 'DemoZandoGo2026!',
    fullName: 'Vendeur Démo',
    role: 'VENDOR_OWNER',
  });

  const buyerUser = await upsertUserWithRole({
    email: 'client@demo.zandogo.local',
    phone: '+243810000003',
    password: 'DemoZandoGo2026!',
    fullName: 'Client Démo',
    role: 'CUSTOMER',
  });

  const driverUser = await upsertUserWithRole({
    email: 'livreur@demo.zandogo.local',
    phone: '+243810000004',
    password: 'DemoZandoGo2026!',
    fullName: 'Livreur Démo',
    role: 'DELIVERY_AGENT',
  });

  const terroirVendor = await upsertUserWithRole({
    email: 'terroir@demo.zandogo.local',
    phone: '+243810000005',
    password: 'DemoZandoGo2026!',
    fullName: 'Vendeur Terroir Kivu',
    role: 'VENDOR_OWNER',
  });

  const techVendor = await upsertUserWithRole({
    email: 'tech@demo.zandogo.local',
    phone: '+243810000006',
    password: 'DemoZandoGo2026!',
    fullName: 'Vendeur Goma Tech',
    role: 'VENDOR_OWNER',
  });

  const atelierVendor = await upsertUserWithRole({
    email: 'atelier@demo.zandogo.local',
    phone: '+243810000007',
    password: 'DemoZandoGo2026!',
    fullName: 'Vendeur Atelier Umoja',
    role: 'VENDOR_OWNER',
  });

  const transportVendor = await upsertUserWithRole({
    email: 'transport@demo.zandogo.local',
    phone: '+243810000008',
    password: 'DemoZandoGo2026!',
    fullName: 'Vendeur Kivu Express',
    role: 'VENDOR_OWNER',
  });

  // 3. Adresse par défaut de l'acheteur (Goma)
  const buyerAddrCount = await prisma.address.count({ where: { userId: buyerUser.id } });
  if (buyerAddrCount === 0) {
    await prisma.address.create({
      data: {
        userId: buyerUser.id,
        label: 'Bureau Centre-Ville (Goma)',
        commune: 'Goma',
        quartier: 'Les Volcans',
        ville: 'Goma',
        referencePoint: 'Avenue du Lac, face à la station Total Les Volcans',
        latitude: -1.6789,
        longitude: 29.2218,
        isDefault: true,
      },
    });
  }

  // 4. Profil coursier actif
  const existingAgent = await prisma.deliveryAgent.findUnique({ where: { userId: driverUser.id } });
  if (!existingAgent) {
    await prisma.deliveryAgent.create({
      data: {
        userId: driverUser.id,
        affiliation: 'PLATFORM_POOL',
        vehicleType: 'Moto Express Haojue (Goma)',
        status: 'AVAILABLE',
        currentLat: -1.6775,
        currentLng: 29.2285,
        lastPingAt: new Date(),
      },
    });
  }

  // 5. Boutique vendeur démo active
  const demoStore = await prisma.vendorStore.upsert({
    where: { slug: 'boutique-virunga-wax' },
    update: {},
    create: {
      ownerId: vendorUser.id,
      storeName: 'Boutique Virunga Wax',
      slug: 'boutique-virunga-wax',
      description: 'Pagnes Wax authentiques, kits solaires domestiques et manuels professionnels à Goma & RDC.',
      city: 'Goma',
      status: 'ACTIVE',
      isCertified: true,
      hasMonthlyAd: true,
      monthlyAdPlan: 'PRO_CAROUSEL',
    },
  });

  const terroirStore = await prisma.vendorStore.upsert({
    where: { slug: 'marche-kivu-nature' },
    update: {},
    create: {
      ownerId: terroirVendor.id,
      storeName: 'Marché Kivu Nature',
      slug: 'marche-kivu-nature',
      description: 'Café, miel, thé et produits du terroir issus des coopératives du Nord-Kivu.',
      city: 'Goma',
      status: 'ACTIVE',
      isCertified: true,
    },
  });

  const techStore = await prisma.vendorStore.upsert({
    where: { slug: 'goma-tech-energie' },
    update: {},
    create: {
      ownerId: techVendor.id,
      storeName: 'Goma Tech & Énergie',
      slug: 'goma-tech-energie',
      description: 'Équipements électroniques, connectivité et solutions solaires pour les foyers et PME.',
      city: 'Goma',
      status: 'ACTIVE',
      hasMonthlyAd: true,
      monthlyAdPlan: 'PRO_CAROUSEL',
    },
  });

  const atelierStore = await prisma.vendorStore.upsert({
    where: { slug: 'atelier-umoja-bukavu' },
    update: {},
    create: {
      ownerId: atelierVendor.id,
      storeName: 'Atelier Umoja Bukavu',
      slug: 'atelier-umoja-bukavu',
      description: 'Confection et accessoires inspirés des tissus et du savoir-faire de la région des Grands Lacs.',
      city: 'Bukavu',
      status: 'ACTIVE',
    },
  });

  const transportStore = await prisma.vendorStore.upsert({
    where: { slug: 'kivu-express-goma' },
    update: {},
    create: {
      ownerId: transportVendor.id,
      storeName: 'Kivu Express',
      slug: 'kivu-express-goma',
      description: 'Courses urbaines et livraison de proximité à Goma, avec suivi de commande.',
      city: 'Goma',
      status: 'ACTIVE',
    },
  });

  // 6. Catalogue initial si la table products est vide
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    const modeCat = categoryMap.get('habits-mode-femme') || categoryMap.values().next().value;
    const elecCat = categoryMap.get('electronique-high-tech') || modeCat;
    const digitalCat = categoryMap.get('livres-documents-pdf') || modeCat;
    const serviceCat = categoryMap.get('services-telecoms') || modeCat;

    await prisma.product.create({
      data: {
        storeId: demoStore.id,
        categoryId: modeCat.id,
        title: 'Pagne Wax Hollandais Super Luxe — Édition Virunga (6 Yards)',
        slug: 'pagne-wax-hollandais-super-luxe-virunga',
        description: 'Tissu 100% coton Wax premium, couleurs inaltérables, idéal pour cérémonies et couture sur mesure à Goma, Bukavu et Kinshasa.',
        basePriceUsd: 38,
        basePriceCdf: 38 * 2850,
        productType: 'PHYSICAL',
        pricingUnit: 'UNIT',
        audience: 'BOTH',
        minOrderQty: 1,
        lowStockThreshold: 5,
        priceTiers: [
          { minQty: 1, maxQty: 4, unitPriceUsd: 38 },
          { minQty: 5, maxQty: 19, unitPriceUsd: 34 },
          { minQty: 20, maxQty: null, unitPriceUsd: 29 },
        ],
        status: 'ACTIVE',
        isFeatured: true,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?w=900&q=80',
              position: 0,
              altText: 'Safran & Vert Forêt',
            },
          ],
        },
        variants: {
          create: [
            {
              sku: 'VIR-WAX-SAF-01',
              attributes: { color: 'Safran & Vert', colorHex: '#E09F3E', size: '6 Yards' },
              stockQty: 32,
            },
            {
              sku: 'VIR-WAX-TER-02',
              attributes: { color: 'Terracotta Royal', colorHex: '#A63A2B', size: '6 Yards' },
              stockQty: 18,
            },
          ],
        },
      },
    });

    await prisma.product.create({
      data: {
        storeId: demoStore.id,
        categoryId: elecCat.id,
        title: 'Kit Solaire Domestique 300W + Batterie Lithium & 4 Ampoules',
        slug: 'kit-solaire-domestique-300w-lithium',
        description: 'Solution d’alimentation fiable pour foyers et boutiques en RDC : panneau monocristallin, onduleur USB/220V et autonomie 24h.',
        basePriceUsd: 165,
        basePriceCdf: 165 * 2850,
        productType: 'PHYSICAL',
        pricingUnit: 'UNIT',
        audience: 'BOTH',
        minOrderQty: 1,
        lowStockThreshold: 3,
        priceTiers: [
          { minQty: 1, maxQty: 2, unitPriceUsd: 165 },
          { minQty: 3, maxQty: 9, unitPriceUsd: 152 },
          { minQty: 10, maxQty: null, unitPriceUsd: 138 },
        ],
        status: 'ACTIVE',
        isFeatured: true,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=900&q=80',
              position: 0,
              altText: 'Kit Solaire 300W',
            },
          ],
        },
        variants: {
          create: [
            {
              sku: 'VIR-SOL-300W',
              attributes: { color: 'Noir Mat', colorHex: '#172320', size: '300W Standard' },
              stockQty: 14,
            },
          ],
        },
      },
    });

    await prisma.product.create({
      data: {
        storeId: demoStore.id,
        categoryId: digitalCat.id,
        title: 'Guide Pratique du Commerce & Import-Export en RDC (PDF 2026)',
        slug: 'guide-commerce-import-export-rdc-pdf',
        description: 'Manuel numérique complet (140 pages) : douanes Kasumbalesa & Goma, Mobile Money, comptabilité OHADA et logistique transfrontalière.',
        basePriceUsd: 12,
        basePriceCdf: 12 * 2850,
        productType: 'DIGITAL',
        pricingUnit: 'UNIT',
        audience: 'BOTH',
        minOrderQty: 1,
        digitalFileName: 'Guide-Commerce-Import-Export-RDC-2026.pdf',
        digitalFileSize: '8.4 Mo',
        status: 'ACTIVE',
        isFeatured: false,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=900&q=80',
              position: 0,
              altText: 'Edition Numérique PDF',
            },
          ],
        },
        variants: {
          create: [
            {
              sku: 'VIR-PDF-2026',
              attributes: { format: 'PDF Haute Définition' },
              stockQty: 9999,
            },
          ],
        },
      },
    });

    await prisma.product.create({
      data: {
        storeId: demoStore.id,
        categoryId: serviceCat.id,
        title: 'Installation & Configuration Kit Starlink Entreprise / Boutique',
        slug: 'installation-configuration-starlink-entreprise',
        description: 'Pose de mât sécurisé, câblage Ethernet blindé et configuration routeur Wi-Fi pro à Goma, Bukavu et environs.',
        basePriceUsd: 45,
        basePriceCdf: 45 * 2850,
        productType: 'SERVICE',
        pricingUnit: 'FIXED',
        audience: 'B2B',
        minOrderQty: 1,
        serviceDuration: 'Intervention sous 24h ouvrées',
        fulfillmentDetails: 'Technicien certifié avec garantie d’installation 6 mois et test de débit sur site.',
        status: 'ACTIVE',
        isFeatured: false,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=900&q=80',
              position: 0,
              altText: 'Installation Réseau Pro',
            },
          ],
        },
        variants: {
          create: [
            {
              sku: 'VIR-SRV-NET01',
              attributes: { formule: 'Site Unique' },
              stockQty: 999,
            },
          ],
        },
      },
    });
    console.log('✓ 4 produits initiaux (Physique, Solaire, PDF Numérique, Service) insérés.');
  }

  // Offres supplémentaires de démonstration, ajoutées par slug sans écraser le catalogue existant.
  const additionalProducts = [
    {
      storeId: demoStore.id,
      categorySlug: 'habits-mode-femme',
      title: 'Robe portefeuille en Wax — Collection Kivu',
      slug: 'robe-portefeuille-wax-collection-kivu',
      description: 'Robe portefeuille confectionnée en tissu imprimé, avec ceinture réglable. Disponible en plusieurs tailles.',
      priceUsd: 32,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'WOMEN',
      sku: 'DEMO-VIR-ROBE-01',
      stockQty: 16,
      attributes: { color: 'Bordeaux', colorHex: '#7A263A', size: 'M' },
      lowStockThreshold: 4,
      featured: true,
      imageUrl: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?w=900&q=80',
      altText: 'Robe portefeuille en tissu imprimé',
    },
    {
      storeId: demoStore.id,
      categorySlug: 'habits-mode-homme',
      title: 'Chemise homme en coton — Coupe classique',
      slug: 'chemise-homme-coton-coupe-classique',
      description: 'Chemise en coton à manches longues, adaptée au quotidien et aux occasions professionnelles.',
      priceUsd: 24,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'MEN',
      sku: 'DEMO-VIR-CHEMISE-01',
      stockQty: 22,
      attributes: { color: 'Bleu marine', colorHex: '#243B64', size: 'L' },
      lowStockThreshold: 5,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&q=80',
      altText: 'Chemise homme coupe classique',
    },
    {
      storeId: terroirStore.id,
      categorySlug: 'alimentation-terroir-kivu',
      title: 'Café Arabica du Kivu — Grains torréfiés 500 g',
      slug: 'cafe-arabica-kivu-grains-500g',
      description: 'Café Arabica en grains, torréfaction moyenne, conditionné en sachet refermable de 500 g.',
      priceUsd: 14,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-KIVU-CAFE-500',
      stockQty: 42,
      attributes: { format: 'Grains', weight: '500 g' },
      lowStockThreshold: 8,
      featured: true,
      imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=900&q=80',
      altText: 'Café en grains',
      priceTiers: [
        { minQty: 1, maxQty: 4, unitPriceUsd: 14 },
        { minQty: 5, maxQty: 19, unitPriceUsd: 12.5 },
        { minQty: 20, maxQty: null, unitPriceUsd: 11 },
      ],
    },
    {
      storeId: terroirStore.id,
      categorySlug: 'alimentation-terroir-kivu',
      title: 'Miel naturel du Nord-Kivu — Pot 1 kg',
      slug: 'miel-naturel-nord-kivu-1kg',
      description: 'Miel local conditionné en pot scellé de 1 kg. Produit de démonstration pour tester le catalogue alimentaire.',
      priceUsd: 11,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-KIVU-MIEL-1K',
      stockQty: 28,
      attributes: { format: 'Pot', weight: '1 kg' },
      lowStockThreshold: 6,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=900&q=80',
      altText: 'Pot de miel',
    },
    {
      storeId: terroirStore.id,
      categorySlug: 'alimentation-terroir-kivu',
      title: 'Thé noir des hautes terres — Boîte 100 sachets',
      slug: 'the-noir-hautes-terres-100-sachets',
      description: 'Thé noir en sachets individuels, boîte familiale de 100 portions.',
      priceUsd: 8.5,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-KIVU-THE-100',
      stockQty: 34,
      attributes: { format: '100 sachets' },
      lowStockThreshold: 6,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=900&q=80',
      altText: 'Tasse de thé',
    },
    {
      storeId: terroirStore.id,
      categorySlug: 'alimentation-terroir-kivu',
      title: 'Beurre d’arachide artisanal — Pot 500 g',
      slug: 'beurre-arachide-artisanal-500g',
      description: 'Pâte d’arachide onctueuse, sans huile de palme ajoutée, en pot de 500 g.',
      priceUsd: 6,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-KIVU-ARACHIDE-500',
      stockQty: 31,
      attributes: { format: 'Pot', weight: '500 g' },
      lowStockThreshold: 6,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1505576399274-565b52d4ac71?w=900&q=80',
      altText: 'Produits alimentaires emballés',
    },
    {
      storeId: terroirStore.id,
      categorySlug: 'alimentation-terroir-kivu',
      title: 'Haricots rouges — Sac 5 kg',
      slug: 'haricots-rouges-sac-5kg',
      description: 'Haricots rouges secs triés et emballés en sac de 5 kg, adaptés aux familles et restaurants.',
      priceUsd: 9,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-KIVU-HARICOTS-5K',
      stockQty: 25,
      attributes: { format: 'Sac', weight: '5 kg' },
      lowStockThreshold: 5,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=900&q=80',
      altText: 'Légumineuses sèches',
    },
    {
      storeId: techStore.id,
      categorySlug: 'electronique-high-tech',
      title: 'Smartphone Android 4G — 128 Go',
      slug: 'smartphone-android-4g-128go',
      description: 'Smartphone Android 4G avec 128 Go de stockage, double SIM et accessoires de base inclus.',
      priceUsd: 149,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-TECH-PHONE-128',
      stockQty: 12,
      attributes: { color: 'Noir', colorHex: '#202124', storage: '128 Go' },
      lowStockThreshold: 3,
      featured: true,
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900&q=80',
      altText: 'Smartphone',
      priceTiers: [
        { minQty: 1, maxQty: 2, unitPriceUsd: 149 },
        { minQty: 3, maxQty: 9, unitPriceUsd: 143 },
        { minQty: 10, maxQty: null, unitPriceUsd: 136 },
      ],
    },
    {
      storeId: techStore.id,
      categorySlug: 'electronique-high-tech',
      title: 'Batterie externe USB-C — 20 000 mAh',
      slug: 'batterie-externe-usbc-20000mah',
      description: 'Batterie portable 20 000 mAh avec sorties USB-A et USB-C pour recharger les appareils mobiles.',
      priceUsd: 27,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-TECH-POWER-20K',
      stockQty: 24,
      attributes: { color: 'Noir', capacity: '20 000 mAh' },
      lowStockThreshold: 5,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=900&q=80',
      altText: 'Batterie externe',
    },
    {
      storeId: techStore.id,
      categorySlug: 'electronique-high-tech',
      title: 'Routeur Wi-Fi 4G LTE — Double antenne',
      slug: 'routeur-wifi-4g-lte-double-antenne',
      description: 'Routeur 4G LTE avec Wi-Fi pour connecter une maison, un bureau ou une petite boutique.',
      priceUsd: 58,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-TECH-ROUTER-4G',
      stockQty: 15,
      attributes: { network: '4G LTE', antennas: '2' },
      lowStockThreshold: 3,
      featured: true,
      imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=900&q=80',
      altText: 'Équipement réseau Wi-Fi',
    },
    {
      storeId: techStore.id,
      categorySlug: 'electronique-high-tech',
      title: 'Lampe solaire rechargeable — Kit 3 points lumineux',
      slug: 'lampe-solaire-rechargeable-3-points',
      description: 'Kit solaire compact avec panneau, batterie rechargeable et trois points lumineux pour la maison.',
      priceUsd: 39,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-TECH-LAMPE-SOL',
      stockQty: 27,
      attributes: { color: 'Blanc', lightingPoints: '3' },
      lowStockThreshold: 5,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=900&q=80',
      altText: 'Panneau solaire',
    },
    {
      storeId: techStore.id,
      categorySlug: 'electronique-high-tech',
      title: 'Caméra de sécurité Wi-Fi — Vision nocturne',
      slug: 'camera-securite-wifi-vision-nocturne',
      description: 'Caméra de surveillance connectée avec détection de mouvement et vision nocturne.',
      priceUsd: 46,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-TECH-CAMERA-WIFI',
      stockQty: 18,
      attributes: { connection: 'Wi-Fi', nightVision: true },
      lowStockThreshold: 4,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?w=900&q=80',
      altText: 'Caméra de sécurité',
    },
    {
      storeId: techStore.id,
      categorySlug: 'electronique-high-tech',
      title: 'Écran LED 24 pouces — Full HD',
      slug: 'ecran-led-24-pouces-full-hd',
      description: 'Écran LED Full HD 24 pouces avec entrées HDMI et VGA pour poste de travail ou caisse.',
      priceUsd: 118,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'B2B',
      sku: 'DEMO-TECH-ECRAN-24',
      stockQty: 8,
      attributes: { size: '24 pouces', resolution: 'Full HD' },
      lowStockThreshold: 2,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=900&q=80',
      altText: 'Écran d’ordinateur',
    },
    {
      storeId: atelierStore.id,
      categorySlug: 'habits-mode-femme',
      title: 'Sac cabas en tissu Kitenge — Fait main',
      slug: 'sac-cabas-kitenge-fait-main',
      description: 'Sac cabas doublé, confectionné à la main avec des tissus colorés. Format pratique pour les courses.',
      priceUsd: 22,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'WOMEN',
      sku: 'DEMO-UMOJA-SAC-01',
      stockQty: 13,
      attributes: { color: 'Motifs multicolores', material: 'Tissu doublé' },
      lowStockThreshold: 3,
      featured: true,
      imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=80',
      altText: 'Sac cabas',
    },
    {
      storeId: atelierStore.id,
      categorySlug: 'habits-mode-homme',
      title: 'Sandales en cuir — Fabrication artisanale',
      slug: 'sandales-cuir-fabrication-artisanale',
      description: 'Sandales en cuir avec semelle résistante, disponibles en plusieurs pointures.',
      priceUsd: 29,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'MEN',
      sku: 'DEMO-UMOJA-SANDALES-01',
      stockQty: 17,
      attributes: { color: 'Brun', size: '42' },
      lowStockThreshold: 4,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=900&q=80',
      altText: 'Sandales en cuir',
    },
    {
      storeId: atelierStore.id,
      categorySlug: 'habits-mode-homme',
      title: 'Ensemble scolaire — Chemise et pantalon',
      slug: 'ensemble-scolaire-chemise-pantalon',
      description: 'Ensemble scolaire composé d’une chemise et d’un pantalon, tailles enfant et adolescent.',
      priceUsd: 27,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-UMOJA-UNIFORME-01',
      stockQty: 20,
      attributes: { color: 'Bleu et blanc', set: '2 pièces', size: '12 ans' },
      lowStockThreshold: 5,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1503919005314-30d93d07d823?w=900&q=80',
      altText: 'Vêtement scolaire',
    },
    {
      storeId: atelierStore.id,
      categorySlug: 'habits-mode-femme',
      title: 'Nappe imprimée — Format familial',
      slug: 'nappe-imprimee-format-familial',
      description: 'Nappe en tissu imprimé, facile à entretenir, pour table familiale ou espace de réception.',
      priceUsd: 19,
      productType: 'PHYSICAL',
      pricingUnit: 'UNIT',
      audience: 'BOTH',
      sku: 'DEMO-UMOJA-NAPPE-01',
      stockQty: 19,
      attributes: { color: 'Motifs colorés', size: '150 × 220 cm' },
      lowStockThreshold: 4,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&q=80',
      altText: 'Décoration textile',
    },
    {
      storeId: transportStore.id,
      categorySlug: 'services-telecoms',
      title: 'Installation et entretien de kit solaire',
      slug: 'installation-entretien-kit-solaire',
      description: 'Visite technique, vérification des connexions et conseils d’entretien pour une installation solaire domestique.',
      priceUsd: 35,
      productType: 'SERVICE',
      pricingUnit: 'FIXED',
      audience: 'BOTH',
      sku: 'DEMO-SRV-SOLAIRE-01',
      stockQty: 999,
      attributes: { intervention: 'Sur rendez-vous' },
      lowStockThreshold: 1,
      featured: true,
      imageUrl: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=900&q=80',
      altText: 'Installation solaire',
      serviceDuration: 'Environ 2 heures',
      fulfillmentDetails: 'Intervention à Goma. Le client confirme le lieu et la disponibilité avant la commande.',
    },
    {
      storeId: transportStore.id,
      categorySlug: 'transport-coursiers-km',
      title: 'Course urbaine à moto — Tarif au kilomètre',
      slug: 'course-urbaine-moto-tarif-kilometre',
      description: 'Course de proximité à Goma pour documents et petits colis. Le prix final dépend de la distance.',
      priceUsd: 1.5,
      productType: 'SERVICE',
      pricingUnit: 'KM',
      audience: 'BOTH',
      minOrderQty: 4,
      sku: 'DEMO-SRV-COURSE-KM',
      stockQty: 999,
      attributes: { vehicle: 'Moto', serviceArea: 'Goma' },
      lowStockThreshold: 1,
      featured: false,
      imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=900&q=80',
      altText: 'Moto de livraison',
      serviceDuration: 'Selon la distance et le trafic',
      fulfillmentDetails: 'Service de démonstration. La disponibilité et le tarif doivent être confirmés avant toute course.',
    },
  ];

  let addedProductCount = 0;
  for (const product of additionalProducts) {
    const existing = await prisma.product.findUnique({ where: { slug: product.slug } });
    if (existing) continue;

    const category = categoryMap.get(product.categorySlug);
    if (!category) throw new Error(`Catégorie introuvable pour le produit de démonstration : ${product.slug}`);

    const {
      categorySlug,
      priceUsd,
      sku,
      stockQty,
      attributes,
      featured,
      imageUrl,
      altText,
      ...details
    } = product;
    await prisma.product.create({
      data: {
        ...details,
        categoryId: category.id,
        basePriceUsd: priceUsd,
        basePriceCdf: Math.round(priceUsd * 2850),
        status: 'ACTIVE',
        isFeatured: featured,
        images: {
          create: [{ url: imageUrl, position: 0, altText }],
        },
        variants: {
          create: [{ sku, attributes, stockQty }],
        },
      },
    });
    addedProductCount += 1;
  }
  console.log(`✓ ${additionalProducts.length} offres de démonstration vérifiées (${addedProductCount} ajoutées).`);

  // 7. Paramètres plateforme par défaut (tarifs vendeurs + paramètres IA + pub active en dev)
  const existingPricing = await prisma.platformSetting.findUnique({
    where: { key: 'vendor_pricing' },
  });
  if (!existingPricing) {
    await prisma.platformSetting.create({
      data: {
        key: 'vendor_pricing',
        updatedBy: adminUser.id,
        value: {
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
        },
      },
    });
    console.log('✓ Grille tarifaire initiale créée.');
  }

  const existingAiSettings = await prisma.platformSetting.findUnique({
    where: { key: 'ai_settings' },
  });
  if (!existingAiSettings) {
    await prisma.platformSetting.create({
      data: {
        key: 'ai_settings',
        updatedBy: adminUser.id,
        value: {
          autoMessagesEnabled: true,
          autoMessagesTone: 'WARM',
        },
      },
    });
    console.log('✓ Paramètres IA initiaux créés.');
  }

  const existingAdsFlag = await prisma.platformSetting.findUnique({
    where: { key: 'ads_enabled' },
  });
  if (!existingAdsFlag) {
    await prisma.platformSetting.create({
      data: {
        key: 'ads_enabled',
        updatedBy: adminUser.id,
        value: true,
      },
    });
  }

  // 8. Taux de change initial USD -> CDF si absent
  const existingRate = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: 'USD', toCurrency: 'CDF' },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!existingRate) {
    await prisma.exchangeRate.create({
      data: {
        fromCurrency: 'USD',
        toCurrency: 'CDF',
        rate: 2850,
        setByAdminId: adminUser.id,
      },
    });
    console.log('✓ Taux de change initial enregistré : 1 USD = 2 850 CDF.');
  }

  console.log('Initialisation terminée avec succès.');
}

main()
  .catch((err) => {
    console.error('Erreur lors du seed PostgreSQL :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
