# Guide Complet : Technologies, Test en Local & Mise en Production — ZandoGo (RDC)

Ce document présente **les technologies utilisées dans la plateforme**, puis détaille **les étapes pour tester sur votre ordinateur en local** et **les étapes exactes pour déployer en production** sur un serveur réel (VPS) avec nom de domaine HTTPS, PostgreSQL, Redis, stockage S3 privé, paiements Mobile Money / Carte Bancaire, IA hybride et notifications SMS.

---

## 0. Technologies Utilisées (Stack Technique Complète)

### A. Architecture & Monorepo
- **Monorepo** : **npm workspaces** (`apps/web` + `apps/api`)
- **Langage** : **TypeScript 5.9** (typage strict frontend & backend)
- **Runtimes** : **Node.js 22** (API & build production) et **Bun** (lockfile `bun.lock` et suite de tests `bun test`)

### B. Frontend Web & PWA (`apps/web`)
- **Framework UI** : **React 18.3** + **React DOM 18.3**
- **Routage** : **React Router DOM 6.30** (avec gardes de rôle `RequireAuth`)
- **Bundler & Serveur Dev** : **Vite 6.3** (`@vitejs/plugin-react` + passerelle démo locale intégrée)
- **Design & Icônes** : **Tailwind CSS 3.4** (+ PostCSS 8.5, Autoprefixer 10.4) et **Lucide React 1.72**
- **Client HTTP** : **Axios 1.11** (jeton d'accès JWT conservé en mémoire + renouvellement automatique via cookie `httpOnly`)
- **Temps Réel** : **Socket.IO Client 4.8** (`/notifications`, `/chat`, `/tracking`)
- **Paiement Carte UI** : **Stripe Elements** (`@stripe/stripe-js` 7.9 + `@stripe/react-stripe-js` 3.9)
- **Application Progressive (PWA)** : **vite-plugin-pwa 2.0** + **workbox-window 7.4** (installation mobile/desktop et mise en cache hors-ligne)

### C. Backend API & Temps Réel (`apps/api` — 16 modules NestJS)
- **Framework API** : **NestJS 11.2** (`@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/websockets`, `@nestjs/platform-socket.io`)
- **16 Modules Métier** :
  - Cœur e-commerce : `auth`, `users`, `vendors`, `catalog`, `finance`, `orders`, `payments`, `wallets`
  - Confiance, logistique & croissance : `kyc`, `delivery`, `disputes`, `ads`, `realtime`, `uploads`, `analytics`, `assistant`
- **WebSockets & Scalabilité** : **Socket.IO 4.8** + **`@socket.io/redis-adapter` 8.3** (3 namespaces authentifiés par JWT : `/notifications`, `/chat`, `/tracking`)
- **Validation des Entrées** : **class-validator 0.15** + **class-transformer 0.5** (`ValidationPipe` global avec `whitelist: true` et `forbidNonWhitelisted: true`)

### D. Base de Données, Comptabilité & Cache
- **Base Relationnelle** : **PostgreSQL 16** (`postgres:16-alpine`)
- **ORM & Migrations** : **Prisma 6.19** (`@prisma/client` — grand livre financier *append-only* `WalletTransaction`, journal d'audit immuable `AuditLog`)
- **Cache & Pub/Sub** : **Redis 7** (`redis:7-alpine`, client `redis` 6.3 — obligatoire en production pour l'adaptateur Socket.IO)

### E. Paiements & SMS (RDC & International)
- **Mobile Money RDC & Carte 3DS** : **MaishaPay** (API REST v2/v3 — M-Pesa Vodacom, Airtel Money, Orange Money, MTN MoMo, Africell, contre-vérification serveur `/transaction/rest/v2/check`, décaissements B2C vendeurs et webhooks HMAC-SHA256)
- **Cartes Internationales** : **Stripe SDK 23.1** + **Stripe Elements** (Visa / Mastercard, vérification cryptographique `stripe-signature` sur `rawBody`)
- **Paiement à la Livraison** : `CASH_ON_DELIVERY` avec confirmation par preuve livreur
- **SMS Transactionnels** : **Africa's Talking** (alertes commandes, liens PDF, codes/statuts et notifications retraits)

### F. IA Hybride & Traduction Multilingue (`assistant`)
- **Mode Cloud** : **Google Gemini** via **`@google/genai` 3.4** (`gemini-4-hydrogen`)
- **Mode Local** : **Ollama** (détection automatique en `AI_MODE=auto` pour `qwen2.5`, `llama3`, `mistral`, `gemma`, `deepseek`, `phi`)
- **Usages** : traduction instantanée dans le chat client ↔ vendeur (`fr`, `ln` Lingala, `sw` Swahili, `en`), rédaction chaleureuse des notifications/SMS, recherche intelligente, génération de fiches produits et synthèse d'aide aux litiges

### G. Stockage de Fichiers & Sécurité
- **Stockage Objet S3** : **`@aws-sdk/client-s3` 3.1165** + **`@aws-sdk/s3-request-presigner` 3.1165** (AWS S3, Cloudflare R2 ou MinIO). En production (`NODE_ENV=production`), `UPLOADS_DRIVER=s3` est **obligatoire** : bucket privé avec URLs pré-signées de **5 minutes** pour les pièces KYC et livres PDF, bucket public pour les images catalogue. (`UPLOADS_DRIVER=local` est strictement bloqué hors `development`).
- **Sécurité Applicative** :
  - Double JWT (`@nestjs/jwt` + `passport-jwt`), rafraîchissement par cookie `httpOnly`, hachage **bcrypt 6.0**
  - Validation stricte des secrets JWT au démarrage (`>= 32` caractères, aucun motif faible toléré en production)
  - Verrouillage anti-force-brute (`LoginAttemptTracker`), limitation de débit **`@nestjs/throttler` 6.7** (`120 req/min` global + limites renforcées par route)
  - Vérification des *magic bytes* réels lors des uploads KYC (`JPEG`, `PNG`, `PDF`), inspection documentaire via modale dédiée journalisée dans `AuditLog`
  - Protection XSS/Clickjacking/CORS stricte (en-têtes `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS`)

### H. Infrastructure & Reverse Proxy
- **Conteneurisation** : **Docker** & **Docker Compose v2** (`postgres`, `redis`, `api`, `caddy`)
- **Reverse Proxy & TLS** : **Caddy 2** (`caddy:2-alpine` — HTTPS Let's Encrypt automatique, compression `zstd`/`gzip`, proxy `/api/*` et `/socket.io/*`, en-têtes de sécurité HTTP, `trust proxy` configuré côté NestJS/Express)

---

## 1. Tester l'Application en Local (sur votre ordinateur)

Vous avez **deux modes** selon ce que vous voulez vérifier :

### Option A — Test rapide de l'interface (sans installer de base de données)

Idéal pour tester tout le design, le panier, la caisse, les boutiques, les agences de transport, l'inspection KYC, les graphiques et l'installation PWA en moins de 2 minutes.

1. Installez **Node.js 22** (ou **Bun**) sur votre ordinateur.
2. Ouvrez un terminal dans le dossier du projet et lancez :
   ```bash
   npm install
   npm run dev
   ```
3. Ouvrez votre navigateur sur **`http://localhost:3000`**.
4. **Connexion de test** : dans ce mode démo local, vous pouvez basculer ou vous connecter avec les comptes de démonstration (ex. `david.kitenge@example.cd`) et tester les espaces **Client**, **Vendeur**, **Livreur** et **Super Admin** directement.

---

### Option B — Test complet en local avec vraie base PostgreSQL, Redis, API NestJS & clés Sandbox

Idéal pour tester les vraies écritures en base de données, l'authentification réelle, le stockage local sécurisé, vos clés de test paiement (`sandbox` / Stripe Test) et l'envoi SMS avant de déployer sur un serveur.

1. **Démarrer PostgreSQL 16 et Redis 7 en local** (via Docker Desktop) :
   ```bash
   docker compose up -d postgres redis
   ```
2. **Créer `apps/api/.env`** (port `3001` pour éviter tout conflit avec le frontend sur `3000`) :
   ```env
   NODE_ENV=development
   PORT=3001
   APP_URL=http://localhost:3000

   DATABASE_URL=postgresql://ecommerce:postgres@127.0.0.1:5432/ecommerce?schema=public
   REDIS_URL=redis://127.0.0.1:6379

   JWT_ACCESS_SECRET=cle_locale_access_distincte_de_32_caracteres_minimum_01
   JWT_REFRESH_SECRET=cle_locale_refresh_distincte_de_32_caracteres_minimum_02
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Clés de test Mobile Money (Sandbox)
   MAISHAPAY_GATEWAY_MODE=sandbox
   MAISHAPAY_API_KEY=votre_cle_publique_test
   MAISHAPAY_BEARER_TOKEN=
   MAISHAPAY_SECRET_KEY=votre_cle_secrete_test
   # En local sans clés live, peut rester vide ; obligatoire dès que des clés live ou NODE_ENV=production sont actifs
   MAISHAPAY_WEBHOOK_SECRET=

   # Stripe (optionnel : gère les cartes Visa / Mastercard via Stripe Elements)
   STRIPE_SECRET_KEY=sk_test_votre_cle_secrete_stripe
   STRIPE_WEBHOOK_SECRET=whsec_votre_secret_webhook_stripe

   # SMS (optionnel en local : laissez vide pour voir les SMS dans le terminal API)
   AFRICASTALKING_USERNAME=
   AFRICASTALKING_API_KEY=
   AFRICASTALKING_SENDER_ID=ZandoGo
   AFRICASTALKING_ENQUEUE=1
   AFRICASTALKING_WEBHOOK_TOKEN=

   # Assistant IA Hybride (auto = détecte Ollama en local, sinon bascule sur Gemini Cloud)
   AI_MODE=auto
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   # Optionnel : laissez vide pour sélectionner automatiquement le meilleur modèle détecté
   OLLAMA_MODEL=
   # Optionnel en local si Ollama est actif ; requis en ligne pour le repli Cloud
   GEMINI_API_KEY=

   # Pilote local autorisé uniquement lorsque NODE_ENV=development
   UPLOADS_DRIVER=local
   UPLOADS_LOCAL_DIR=./uploads
   ```
3. **Créer `apps/web/.env.local`** pour relier l'interface à la vraie API locale :
   ```env
   VITE_API_URL=http://localhost:3001/api
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle_publique_stripe
   ```
4. **Installer les dépendances et créer les tables PostgreSQL** :
   ```bash
   npm install
   cd apps/api
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   cd ../..
   ```
5. **Lancer l'API et le Frontend dans deux terminaux** :
   - **Terminal 1 (API NestJS)** :
     ```bash
     cd apps/api && npm run start:dev
     ```
   - **Terminal 2 (Interface React/Vite)** :
     ```bash
     npm run dev
     ```
6. Ouvrez **`http://localhost:3000`**, créez un compte réel, puis passez-le en `SUPER_ADMIN` avec la commande de la section 6 ci-dessous (via `docker compose exec postgres ...`).

> Pour revenir ensuite au mode démo rapide sans base de données, supprimez simplement (ou renommez) le fichier `apps/web/.env.local` et relancez `npm run dev`.

---

## 2. Prérequis Serveur & Nom de Domaine (Mise en Production)

1. **Serveur (VPS Ubuntu 22.04 / 24.04 recommandé)** :
   - Minimum : **2 vCPU**, **4 Go RAM**, **40 Go SSD**.
   - Logiciels à installer : **Docker**, **Docker Compose v2**, **Node.js 22** (ou Bun).
2. **Nom de domaine & DNS** :
   - Créez un enregistrement DNS de type **A** pointant `votredomaine.cd` (et `www.votredomaine.cd`) vers l'adresse IP publique du VPS.
3. **Stockage Objet S3 (obligatoire en production)** :
   - Créez deux buckets sur **AWS S3**, **Cloudflare R2** ou **MinIO** :
     - Un **bucket privé** (aucun accès public) pour les justificatifs KYC et les livres numériques PDF.
     - Un **bucket public** (lecture seule publique) pour les images produits et visuels boutiques.
4. **Pare-feu (UFW)** :
   - Ouvrez uniquement les ports `22` (SSH), `80` (HTTP) et `443` (HTTPS).

---

## 3. Configurer les Variables d'Environnement de Production

### A. Fichier `.env` à la racine du projet (utilisé par Docker Compose & Caddy)

Créez le fichier `.env` à la racine avec :

```env
SITE_ADDRESS=votredomaine.cd
POSTGRES_PASSWORD=ChoisissezUnMotDePasseTresRobuste123!
```

### B. Fichier `apps/api/.env` (utilisé par le serveur API NestJS)

Générez d'abord trois secrets aléatoires de 64 caractères (deux pour les JWT et un pour vérifier les webhooks Mobile Money) :

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Créez ensuite `apps/api/.env` :

```env
NODE_ENV=production
PORT=3000
APP_URL=https://votredomaine.cd

# Base de données & Cache temps réel (doit correspondre à POSTGRES_PASSWORD)
DATABASE_URL=postgresql://ecommerce:ChoisissezUnMotDePasseTresRobuste123!@postgres:5432/ecommerce?schema=public
REDIS_URL=redis://redis:6379

# Sécurité Authentification JWT (collez 2 secrets distincts >= 32 caractères, sans mots faibles)
JWT_ACCESS_SECRET=collez_votre_premier_secret_64_caracteres
JWT_REFRESH_SECRET=collez_votre_deuxieme_secret_64_caracteres
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Agrégateur Mobile Money RDC (commencez en sandbox pour valider, puis passez à production)
MAISHAPAY_GATEWAY_MODE=sandbox
MAISHAPAY_API_KEY=votre_cle_publique
MAISHAPAY_BEARER_TOKEN=votre_bearer_token_si_different_de_la_cle_publique
MAISHAPAY_SECRET_KEY=votre_cle_secrete
# OBLIGATOIRE en production (vérification HMAC-SHA256 fail-closed sur X-MaishaPay-Signature)
MAISHAPAY_WEBHOOK_SECRET=collez_le_secret_webhook_marchand

# Stripe (Cartes Visa / Mastercard internationales — utilisez sk_live_ / rk_live_ en production)
STRIPE_SECRET_KEY=votre_cle_secrete_stripe
STRIPE_WEBHOOK_SECRET=whsec_votre_secret_webhook_stripe

# Notifications SMS & Bulk SMS (Africa's Talking Live / Sandbox)
AFRICASTALKING_USERNAME=votre_username_africastalking
AFRICASTALKING_API_KEY=votre_cle_api_africastalking
AFRICASTALKING_SENDER_ID=ZandoGo
AFRICASTALKING_ENQUEUE=1
# OBLIGATOIRE en production pour sécuriser les 4 URLs de callback SMS (?token=...)
AFRICASTALKING_WEBHOOK_TOKEN=collez_un_jeton_secret_sms_32_caracteres

# Callbacks à renseigner dans le Dashboard Africa's Talking (SMS -> SMS Callback URLs) :
# - Delivery Reports : https://votredomaine.cd/api/sms/callbacks/delivery-reports?token=VOTRE_JETON
# - Incoming Messages : https://votredomaine.cd/api/sms/callbacks/incoming-messages?token=VOTRE_JETON
# - Bulk SMS Opt Out : https://votredomaine.cd/api/sms/callbacks/opt-out?token=VOTRE_JETON
# - Subscription Notifications : https://votredomaine.cd/api/sms/callbacks/subscriptions?token=VOTRE_JETON

# Assistant IA Hybride (en production, utilise Gemini Cloud si Ollama n'est pas actif)
AI_MODE=auto
GEMINI_API_KEY=votre_cle_api_gemini_serveur

# Stockage des fichiers (OBLIGATOIRE en production : "s3" pour AWS S3 / Cloudflare R2 / MinIO)
UPLOADS_DRIVER=s3
S3_ENDPOINT=https://votre-compte.r2.cloudflarestorage.com
S3_REGION=auto
S3_PUBLIC_BUCKET=zandogo-public
S3_PRIVATE_BUCKET=zandogo-private
S3_PUBLIC_BASE_URL=https://cdn.votredomaine.cd
S3_ACCESS_KEY=votre_s3_access_key
S3_SECRET_KEY=votre_s3_secret_key
```

> **Important Sécurité (Comportement *Fail-Closed*)** :
> - L'API refuse de démarrer en production si `REDIS_URL` est absent, si les secrets JWT sont faibles/identiques (< 32 caractères), ou si `UPLOADS_DRIVER` vaut `local`.
> - Tout webhook Mobile Money arrivant sans signature HMAC-SHA256 valide (`MAISHAPAY_WEBHOOK_SECRET`) est rejeté en production, et toute transaction est contre-vérifiée auprès de l'API avant validation de commande.
> - Si vous placez un second proxy (ex. **Cloudflare**) devant Caddy, pensez à régler `app.set('trust proxy', 2)` dans `apps/api/src/main.ts` afin que la limitation de débit par IP reste exacte.

### C. Fichier `apps/web/.env.production` (pour compiler Stripe Elements dans le frontend)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_votre_cle_publique_stripe
```

---

## 4. Démarrer PostgreSQL + Redis & Synchroniser le Schéma Prisma

Depuis la racine du projet sur le serveur :

```bash
# 1. Démarrer PostgreSQL 16 et Redis 7
docker compose up -d postgres redis

# 2. Installer les dépendances et synchroniser toutes les tables en base
npm install
cd apps/api
npx prisma generate
DATABASE_URL="postgresql://ecommerce:ChoisissezUnMotDePasseTresRobuste123!@127.0.0.1:5432/ecommerce?schema=public" npx prisma db push
DATABASE_URL="postgresql://ecommerce:ChoisissezUnMotDePasseTresRobuste123!@127.0.0.1:5432/ecommerce?schema=public" npx prisma db seed
cd ../..
```

> `prisma db push` synchronise l'ensemble du schéma relationnel (utilisateurs, rôles, boutiques, catalogue, agences de transport, commandes multi-vendeurs, grand livre `WalletTransaction`, décompte 48h, paramètres dynamiques des frais et retraits immédiats, journal `AuditLog`).

---

## 5. Compiler le Frontend & Lancer la Plateforme en HTTPS

```bash
# 1. Générer le fichier package-lock.json dans apps/api (requis par le Dockerfile)
cd apps/api && npm install --package-lock-only && cd ../..

# 2. Compiler l'interface web React/PWA de production (génère apps/web/dist servi par Caddy)
npm run build

# 3. Construire et démarrer l'API NestJS et Caddy (HTTPS automatique Let's Encrypt)
docker compose up -d --build
```

Vérifiez que tous les conteneurs fonctionnent correctement :

```bash
docker compose ps
docker compose logs -f api
```

---

## 6. Créer et Promouvoir le Premier Compte `SUPER_ADMIN`

1. Ouvrez `https://votredomaine.cd` dans votre navigateur et créez votre compte utilisateur (e-mail + téléphone + mot de passe).
2. Exécutez cette commande sur le serveur (en remplaçant `votre_email@exemple.com` par votre e-mail) pour lui attribuer le rôle `SUPER_ADMIN` :

```bash
docker compose exec postgres psql -U ecommerce -d ecommerce -c "
INSERT INTO user_roles (id, \"userId\", role, \"createdAt\")
SELECT gen_random_uuid()::text, id, 'SUPER_ADMIN', NOW()
FROM users
WHERE email = 'votre_email@exemple.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.\"userId\" = users.id AND ur.role = 'SUPER_ADMIN'
  );
UPDATE users SET status = 'ACTIVE' WHERE email = 'votre_email@exemple.com';
"
```

3. Déconnectez-vous puis reconnectez-vous sur le site : vous avez désormais accès complet à la **Console Super Admin** (incluant la validation KYC avec inspection sécurisée des justificatifs).

---

## 7. Configurer les URLs chez Vos Agrégateurs & Africa's Talking

### A. Dans votre tableau de bord marchand Mobile Money & Stripe
Configurez ces adresses publiques exactes :
- **Webhook Mobile Money (Collectes C2B & Décaissements B2C)** :  
  `https://votredomaine.cd/api/payments/callbacks/gateway` *(alias : `/api/payments/webhooks/maishapay`)*
- **URL de retour Carte Visa / Mastercard (passerelle 3DS)** :  
  `https://votredomaine.cd/api/payments/callbacks/card`
- **Webhook Stripe (événements `payment_intent.succeeded` & `payment_intent.payment_failed`)** :  
  `https://votredomaine.cd/api/payments/webhooks/stripe`

### B. Dans votre tableau de bord Africa's Talking
- Vérifiez que votre **Sender ID** (`ZandoGo` ou votre identifiant validé en RDC) est bien actif pour Vodacom, Airtel, Orange et Africell.
- Alimentez le crédit SMS pour assurer l'envoi instantané des confirmations de commande, des liens de téléchargement de livres et des notifications de retrait.

---

## 8. Checklist de Validation Avant Ouverture au Public

Effectuez ces tests dans l'ordre avant d'annoncer le lancement :

1. **Réglages Super Admin** :
   - Définissez le taux de change USD ↔ CDF du jour.
   - Vérifiez les frais de transaction (**3,5 %**), le pourcentage de commission (**0 % à 5 %** selon votre choix), les prix des boutiques/modules et le mode de retrait immédiat.
2. **Boutique, KYC, Produits, Livres & Agences de Transport** :
   - Soumettez un justificatif KYC, inspectez-le dans la console Super Admin via le bouton **Inspecter le document justificatif** et vérifiez l'ouverture sécurisée dans la fenêtre modale.
   - Créez une boutique test, ajoutez un produit physique avec photo, un livre PDF, une prestation/trajet d'agence de transport, et testez l'ajout d'une nouvelle catégorie libre.
3. **Test Paiement en `sandbox`** :
   - Avec un second compte client, renseignez votre e-mail pour enregistrer/modifier une adresse de livraison, ajoutez au panier depuis le catalogue et vérifiez que le récapitulatif affiche bien les **3,5 %** et correspond au montant exact débité.
4. **Test Réel avec un petit montant (`production`)** :
   - Dans `apps/api/.env`, passez `MAISHAPAY_GATEWAY_MODE=production` puis redémarrez l'API :
     ```bash
     docker compose up -d api
     ```
   - Effectuez un achat test réel de **1 $** (ou **3 000 CDF**) par Airtel Money / M-Pesa / Orange Money :
     - Confirmez que la commande passe automatiquement à **Payée** via le webhook.
     - Confirmez la réception du **SMS** sur le téléphone.
     - Pour un livre PDF, vérifiez que le **lien de téléchargement signé** est immédiatement utilisable sans action du vendeur.
     - Vérifiez dans le portefeuille vendeur que le décompte **48h** a commencé à l'heure du paiement.
5. **Test Retrait Vendeur (B2C)** :
   - Depuis le Super Admin, activez le retrait immédiat (ou cliquez sur **Débloquer fonds maintenant**) pour la boutique test.
   - Demandez un retrait vers votre propre numéro Mobile Money et vérifiez la réception des fonds sans frais plateforme ajoutés.
6. **Test Litige & Traduction Chat** :
   - Ouvrez un litige sur une commande test et vérifiez que le retrait du vendeur concerné est bloqué jusqu'à résolution par le Super Admin.
   - Envoyez un message dans le chat en **Lingala / Swahili** et vérifiez la traduction automatique en **Français** côté vendeur (et inversement).

---

## 9. Maintenance & Sauvegardes Recommandées

### Sauvegarde manuelle ou cron quotidienne de la base PostgreSQL

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U ecommerce ecommerce > backups/zandogo_$(date +%F_%H%M).sql
```

### Vérification des tests automatisés et de la qualité du code
```bash
# Tests unitaires et règles de sécurité API (Bun)
cd apps/api && bun test && npm run typecheck

# Vérification TypeScript Frontend
cd ../.. && npm run lint
```
