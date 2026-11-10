# Plateforme E-commerce Multi-Acteurs — Monorepo

Voir `architecture-ecommerce-rdc.md` (fourni séparément) pour la documentation complète : rôles, logique de paiement, livraison, litiges, commissions, sécurité.

## Structure

```
project/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   └── src/
│   │       ├── common/{access,audit,geo,realtime}/
│   │       ├── modules/{ads,auth,catalog,delivery,disputes,finance,kyc,orders,payments,realtime,uploads,users,vendors,wallets}/
│   │       ├── prisma/
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/
│       └── src/
│           ├── components/
│           ├── lib/
│           ├── pages/{admin,delivery,vendor}/
│           └── App.tsx
├── architecture-ecommerce-rdc.md
├── docker-compose.yml
└── README.md
```

Cette arborescence décrit l'organisation du monorepo. Les dépendances sont déclarées par application, et `apps/api` et `apps/web` sont installés ensemble depuis la racine via npm workspaces.

## État réel du dépôt

L'API NestJS et le frontend React/Vite sont configurés avec leurs dépendances verrouillées. Le build production et le typecheck passent pour l'API; le build frontend inclut son contrôle TypeScript. Les parcours principaux sont raccordés aux routes API. La disponibilité opérationnelle complète reste à vérifier avec PostgreSQL, Redis, les fournisseurs de paiement et le stockage configurés.

La liste d'avancement plus bas décrit la conception prévue; elle ne signifie pas que chaque parcours métier est vérifié de bout en bout. Docker n'est pas installé dans l'environnement de travail, donc les fichiers Compose/Caddy n'ont pas pu être exécutés ici.

## Démarrage local

```bash
# 1. Préparer l'environnement (à faire une seule fois)
cp apps/api/.env.example apps/api/.env
# → éditer les secrets (JWT, CinetPay, Stripe) avant d'aller plus loin

# 2. Installer les dépendances de toutes les applications (à faire une seule fois)
npm ci
cd apps/api
npm run prisma:generate
cd ../..
```

```bash
# 3. Appliquer les migrations sur une base PostgreSQL existante
cd apps/api
npm run prisma:deploy
cd ../..
```

Une fois cette préparation terminée et PostgreSQL démarré, lancer depuis la racine du dépôt `npm run dev` pour démarrer l'API et le frontend ensemble. Arrêter les applications avec `Ctrl+C`.

Pour lancer les services de base avec Docker Compose à la place du PostgreSQL local, exécuter d'abord `docker compose up -d postgres redis`. Le mode local fonctionne sans Redis pour une seule instance de l'API ; les notifications temps réel entre plusieurs instances nécessitent Redis. En production, `REDIS_URL` est obligatoire. Le mot de passe PostgreSQL Compose par défaut est `postgres`; si `POSTGRES_PASSWORD` est défini, utiliser la même valeur dans `DATABASE_URL` de `apps/api/.env`. Le frontend utilise `VITE_API_PROXY_TARGET` (par défaut `http://localhost:3000`) pour joindre l'API. Si nécessaire, copier `apps/web/.env.example` vers `apps/web/.env.local` et configurer `VITE_STRIPE_PUBLISHABLE_KEY`.

Pour les essais locaux sans stockage S3, régler `UPLOADS_DRIVER=local` dans `apps/api/.env`. Les documents KYC sont alors conservés dans `apps/api/uploads/` et ne sont pas publiés par le serveur web. Ce mode est réservé au développement; en production, utiliser un stockage S3 privé.

Pour préparer les fichiers statiques utilisés par Caddy dans Compose, exécuter `npm run build` depuis `apps/web`.

## Avancement

- ✅ Module `auth` : inscription, connexion, JWT access+refresh, guards RBAC (`JwtAuthGuard`, `RolesGuard`, `@Roles`).
- ✅ Module `vendors` : demande de boutique, validation KYC + activation par admin, création automatique des wallets USD/CDF, commission négociée par vendeur.
- ✅ Module `catalog` : catégories, commission par catégorie (append-only), produits + variantes, prix USD/CDF auto-calculé via le dernier taux de change admin.
- ✅ Module `finance` : saisie manuelle du taux de change USD/CDF par un admin (append-only, historisé).
- ✅ Module `orders` : panier, checkout multi-vendeur, commission figée par sous-commande au moment de la commande, historique de statut, progression vendeur limitée (le passage à `DELIVERED` est réservé au module `delivery`).
- ✅ Module `payments` : CinetPay (Mobile Money Orange/Airtel/M-Pesa, contre-vérification systématique des webhooks), Stripe (cartes, signature vérifiée sur raw body), Cash à la livraison (confirmation différée par le livreur). Échec de paiement → restock automatique + commande annulée.
- ✅ Module `wallets` : grand livre append-only, rétention 48h (`LOCKED` → `AVAILABLE`), gel automatique en cas de litige (`HELD_FOR_DISPUTE`), demandes de retrait.
- ✅ Module `kyc` : soumission de documents, validation admin (comble une dépendance manquante des modules vendors/delivery).
- ✅ Module `delivery` : candidature livreur (approuvée seulement après KYC permis/pièce d'identité), création de course avec calcul de frais par distance (haversine), assignation automatique au livreur du pool le plus proche ou à un livreur dédié vendeur, tracking GPS (pings horodatés), preuve de livraison obligatoire (signature/photo/OTP). **C'est ce module qui déclenche enfin `WalletsService.creditOrderFundsOnDelivery`, bouclant tout le cycle commande → paiement → livraison → argent.**
- ✅ Module `disputes` : ouverture par client ou vendeur, gel immédiat des fonds (`HELD_FOR_DISPUTE`), SLA 48h avec file triée par échéance, **résolution exclusivement réservée au SUPER_ADMIN** (vérifié deux fois : guard + contrôle explicite dans le service), écritures comptables compensatoires append-only en cas de remboursement (jamais de modification des écritures d'origine).
- ✅ Module `ads` : campagnes (CPC/CPM/forfait), paiement CinetPay/Stripe (jamais en cash), activation du boost catalogue (`isFeatured`/`boostedUntil`, déjà utilisés par le tri de `catalog`), pause automatique dès budget atteint, **désactivable via `ADS_ENABLED=false`** en attendant que vous soyez prêt commercialement.
- ✅ Module `realtime` : trois namespaces Socket.io (`/notifications`, `/chat`, `/tracking`), authentifiés par JWT (`WsJwtGuard`, le socket ne peut pas porter de header `Authorization`), adaptateur Redis pub/sub branché dès le démarrage pour scaler horizontalement sans réécriture. `NotificationsGateway` centralise désormais la persistance + diffusion live pour `vendors`, `kyc` et `disputes` ; `TrackingGateway` diffuse en direct les pings GPS et changements de statut de `delivery`, sans polling côté client.

## Backend : les 14 modules prévus sont maintenant en place

## Frontend React (`apps/web`)

- ✅ Design system (palette Nuit/Sève/Safran/Wax, Space Grotesk + IBM Plex Sans), authentification en mémoire + refresh par cookie httpOnly, garde de route `RequireAuth` avec contrôle de rôle.
- ✅ Parcours client : accueil, catalogue filtrable, produit, panier, checkout (adresse GPS + paiement).
- ✅ Espace vendeur : boutiques, création de boutique, KYC, gestion du catalogue et publication/désactivation des produits.
- ✅ Espace admin : validation KYC, validation des boutiques, candidatures livreurs, litiges (décision réservée au SUPER_ADMIN), taux de change.
- ✅ Espace livreur : candidature, statut disponible/hors-ligne avec envoi de position (`watchPosition`), liste des courses en cours et historique, actions de statut, ping GPS périodique pendant une course active, confirmation avec preuve obligatoire.
- ✅ Client Socket.io pour notifications, chat et suivi de livraison en direct; la position est proposée sous forme de lien cartographique, sans carte embarquée.
- ✅ Paiement carte via Stripe Elements, avec `VITE_STRIPE_PUBLISHABLE_KEY` à renseigner dans l'environnement frontend.
- ✅ Upload de fichiers par URL signée : documents KYC dans un bucket privé et images produit dans le bucket public.
- ⬜ La preuve photo/signature de livraison attend encore un lien de fichier; l'upload direct depuis ce parcours reste à raccorder.

Les contrôles de rôle côté React sont un confort d'affichage : la vérification qui fait foi est toujours faite par l'API. Les builds ne remplacent pas les tests d'intégration; les services Compose et les flux de paiement réels n'ont pas encore été exécutés dans cet environnement.

Chaque module suivant respecte strictement les règles de gestion validées dans le document d'architecture (rétention 48h, litiges tranchés par le SUPER_ADMIN, commission par catégorie, taux de change manuel).
# ZandoGo
