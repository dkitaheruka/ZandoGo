/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

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
    console.log(`✓ Compte ${role} créé : ${normalizedEmail} (mot de passe : ${password})`);
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
    email: process.env.SEED_ADMIN_EMAIL || 'dkitaheruka@gmail.com',
    phone: process.env.SEED_ADMIN_PHONE || '+243987489410',
    password: process.env.SEED_ADMIN_PASSWORD || 'Kit@heruka2006',
    fullName: 'David Kitaheruka (Super Admin)',
    role: 'SUPER_ADMIN',
  });

  const vendorUser = await upsertUserWithRole({
    email: 'sabuni@gmail.com',
    phone: '+243972343390',
    password: 'sabuni1234',
    fullName: 'Aristote SABUNI (Vendeur)',
    role: 'VENDOR_OWNER',
  });

  const buyerUser = await upsertUserWithRole({
    email: 'fidel@gmail.com',
    phone: '+243878410936',
    password: 'fidel1234',
    fullName: 'Fidel MUHAMIRIZA (Acheteur)',
    role: 'CUSTOMER',
  });

  const driverUser = await upsertUserWithRole({
    email: 'david@gmail.com',
    phone: '+243899999999',
    password: 'david1234',
    fullName: 'David (Coursier Moto)',
    role: 'DELIVERY_AGENT',
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
