/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'Électronique & High-Tech', slug: 'electronique-high-tech', icon: 'smartphone' },
  { name: 'Habits & Mode — Femme', slug: 'habits-mode-femme', icon: 'sparkles' },
  { name: 'Habits & Mode — Homme', slug: 'habits-mode-homme', icon: 'shirt' },
  { name: 'Alimentation & Terroir Kivu', slug: 'alimentation-terroir-kivu', icon: 'coffee' },
  { name: 'Livres & Documents PDF', slug: 'livres-documents-pdf', icon: 'book-open' },
  { name: 'Services & Télécoms', slug: 'services-telecoms', icon: 'wifi' },
  { name: 'Transport & Coursiers (au km)', slug: 'transport-coursiers-km', icon: 'truck' },
];

async function main() {
  console.log('Initialisation de la base de données ZandoGo...');

  // 1. Catégories de base (idempotent)
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon },
      create: cat,
    });
  }
  console.log(`✓ ${DEFAULT_CATEGORIES.length} catégories vérifiées.`);

  // 2. Compte Super Admin initial (idempotent)
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@zandogo.cd').trim().toLowerCase();
  const adminPhone = (process.env.SEED_ADMIN_PHONE || '+243810000001').trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ZandoGoAdmin2026!';

  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        fullName: 'Super Admin ZandoGo',
        status: 'ACTIVE',
        preferredCurrency: 'USD',
        preferredLanguage: 'fr',
      },
    });
    console.log(`✓ Compte Super Admin créé : ${adminEmail} (mot de passe initial : ${adminPassword})`);
  } else {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { status: 'ACTIVE' },
    });
    console.log(`✓ Compte Super Admin existant vérifié : ${adminEmail}`);
  }

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: adminUser.id, role: 'SUPER_ADMIN' },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, role: 'SUPER_ADMIN' },
    });
    console.log(`✓ Rôle SUPER_ADMIN attribué à ${adminEmail}.`);
  }

  // 3. Paramètres plateforme par défaut (tarifs vendeurs + paramètres IA)
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

  // 4. Taux de change initial USD -> CDF si absent
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
