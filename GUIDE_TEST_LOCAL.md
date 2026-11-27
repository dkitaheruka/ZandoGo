# Guide de Test en Local — ZandoGo

Ce guide présente les **deux méthodes** pour lancer et tester l’application **ZandoGo** sur votre ordinateur :
1. **Option 1 — Lancement rapide en 1 commande** *(sans installer de base de données)*
2. **Option 2 — Lancement Full-Stack complet** *(Frontend React + API NestJS + PostgreSQL + Prisma)*

---

## Prérequis communs
- **Node.js** version **22 LTS** (ou **20.19+**, avec `npm`)
- Un terminal (PowerShell, CMD, Bash ou Terminal macOS/Linux)
- *(Option 2 uniquement)* **PostgreSQL** installé en local **ou** **Docker Desktop**

---

## Option 1 — Test rapide en 1 seule commande (recommandé pour tester rapidement)

Cette méthode lance l’interface sur le port `3000`. Le faux backend intégré est activé uniquement si `VITE_API_URL` n’est pas défini; si cette variable pointe vers `/api` ou l’API, PostgreSQL et l’API doivent aussi être démarrés.

### 1. Installer les dépendances (une seule fois)
```bash
npm install
```

### 2. Démarrer l’application
```bash
npm run dev
```

### 3. Ouvrir dans le navigateur
- URL : **`http://localhost:3000`**
- **Compte connecté automatiquement** : `David Kitenge` (`david.kitenge@example.cd`) avec tous les rôles actifs (`Client`, `Vendeur Pro`, `Livreur`, `Admin`, `Super Admin`) pour tester chaque espace sans ressaisir de mot de passe.

---

## Option 2 — Test Full-Stack complet (Frontend + API NestJS + PostgreSQL)

Cette méthode utilise la vraie base de données PostgreSQL, les migrations Prisma et le serveur NestJS complet.

### Démarrage en un clic sous Windows

Après avoir installé les dépendances, configuré `.env` et démarré PostgreSQL, double-cliquez sur `Lancer-ZandoGo.bat`. Le script vérifie les services, démarre ceux qui manquent et ouvre **`http://localhost:3002`**. Il ne lance pas les migrations ni le seed. Pour initialiser une nouvelle base, suivez d'abord les étapes ci-dessous.

### 1. Préparer les variables d’environnement
À la racine du projet, créez le fichier `.env` à partir de `.env.example` si nécessaire :
```bash
cp .env.example .env
```

Pour PostgreSQL lancé avec Compose, vérifiez ces valeurs dans `.env` :
```env
PORT=3001
APP_URL=http://localhost:3000,http://localhost:3002,http://localhost
DATABASE_URL=postgresql://ecommerce:postgres@localhost:5432/ecommerce?schema=public
JWT_ACCESS_SECRET=une-cle-locale-longue-et-unique-pour-access
JWT_REFRESH_SECRET=une-autre-cle-locale-longue-et-unique-pour-refresh
UPLOADS_DRIVER=local
UPLOADS_LOCAL_DIR=./uploads
```

Le frontend lit aussi `.env.local` à la racine; utilisez `VITE_API_URL=/api` et `VITE_API_PROXY_TARGET=http://localhost:3001`. Le port `3001` est réservé à l’API NestJS afin d’éviter le conflit avec Vite (`3000`). Si vous utilisez un PostgreSQL local différent, configurez le même `DATABASE_URL` pour les migrations et l’API.

### 2. Démarrer PostgreSQL et Redis
- **Avec Docker Compose** :
  ```bash
  docker compose up -d postgres redis
  ```
- **Ou avec votre PostgreSQL local** : vérifiez que la base `zandogo` existe et correspond à `DATABASE_URL`.

### 3. Installer et migrer la base de données
```bash
npm install
npm run prisma:generate --workspace=@ecommerce/api
npm run prisma:deploy --workspace=@ecommerce/api
```

Le seed crée des comptes de démonstration. Ne l’exécutez que sur une base de développement, jamais sur une base de production.

### 4. Lancer l’API et le Frontend (dans 2 terminaux séparés)

- **Terminal 1 — Démarrer l’API NestJS** :
  ```bash
  npm run dev:api
  ```
  *(L’API est accessible sur `http://localhost:3001/api`)*

- **Terminal 2 — Démarrer le Frontend React/Vite** :
  ```bash
  # PowerShell
  $env:VITE_API_URL = "/api"
  $env:VITE_API_PROXY_TARGET = "http://localhost:3001"
  npm run dev --workspace=@ecommerce/web -- --port 3002 --strictPort
  ```
  *(Le site est accessible sur `http://localhost:3002`)*

### 5. Comptes de test créés par le seed (`prisma:seed`)

Les comptes et leurs mots de passe sont définis dans [`apps/api/prisma/seed.cjs`](./apps/api/prisma/seed.cjs). Les emails par défaut sont `dkitaheruka@gmail.com` (Super Admin), `sabuni@gmail.com` (Vendeur), `fidel@gmail.com` (Acheteur) et `david@gmail.com` (Livreur). Pour le Super Admin, `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` dans `.env` remplacent les valeurs par défaut.

Après connexion, chaque compte dispose du rôle indiqué dans le seed. Réservez ces comptes de démonstration à une base locale de développement; n’exécutez pas le seed en production.

Vous pouvez également créer de nouveaux comptes depuis `/register` (vérification OTP intégrée) ou réinitialiser un mot de passe via `/forgot-password` (aperçu du code OTP affiché en mode développement local).

---

## Liste de contrôle pour vos tests locaux

1. **Authentification, OTP & Profil** :
   - Inscription avec activation OTP (`/register`) et activation depuis `/profile` si en attente.
   - Mot de passe oublié & réinitialisation par code OTP (`/forgot-password`).
2. **Catalogue, Médias & Produits Numériques** :
   - Création d’offre physique, numérique (upload PDF privé) ou service (`/vendor/:storeId/products/new`).
   - Publication / activation (`ACTIVE`) et ajustement des stocks (`/vendor/:storeId/products`).
3. **Négociations, Checkout & Livraison** :
   - Négociation produit directe B2B/B2C, choix du mode de livraison (`Express Moto`, `Transporteur`, `Retrait`), partage GPS et négociation du tarif de course dans le chat.
   - Paiement sandbox automatique (Mobile Money / Carte) ou Cash à la livraison, téléchargement PDF signé après paiement et facture officielle.
   - Signature tactile du client (`<canvas>`) ou preuve photo / OTP côté livreur (`/delivery`).
4. **Gestion Équipe, Publicités & Administration** :
   - Ajout/retrait d’un collaborateur `VENDOR_STAFF` (`/vendor/:storeId/team`) et campagnes sponsorisées ROI (`/vendor/:storeId/ads`).
   - Arbitrage litiges 48h (`/admin/disputes`), validation/rejet des retraits vendeurs (`/admin/payouts`), console SMS RDC (`/admin/sms`) et pages légales (`/cgu`, `/privacy`, `/escrow-policy`, `/support`).

---

## Dépannage Linux (page blanche à l’ouverture du lien `npm run dev`)

Si le lien affiché par `npm run dev` s’ouvre dans le navigateur sans rien afficher :

1. **Vérifier la version de Node.js** (très fréquent sur Ubuntu/Debian via `apt`) :
   ```bash
   node -v
   ```
   Il faut **Node 20.19+** ou **Node 22 LTS**. Si vous êtes en Node 18 ou inférieur, installez Node 22 :
   ```bash
   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.bashrc
   nvm install 22 && nvm use 22
   ```
2. **Ouvrir la bonne URL dans le navigateur** :
   - Utilisez **`http://localhost:3000`** ou **`http://127.0.0.1:3000`** (évitez `http://0.0.0.0:3000` si le navigateur le bloque ou redirige mal).
3. **Réinstaller proprement après une mise à jour de dépendances** :
   ```bash
   rm -rf node_modules apps/*/node_modules package-lock.json
   npm install
   npm run dev
   ```
4. **Vider l’ancien cache Service Worker sur `localhost:3000`** :
   - Ouvrez **DevTools (`F12`)** → onglet **Console** (vérifiez s’il y a un message rouge) puis **Application → Service Workers → Unregister** et rechargez avec `Ctrl + Shift + R`.
5. **Si le frontend utilise le mauvais mode** :
   - Pour le backend réel, configurez `.env.local` à la racine avec `VITE_API_URL=/api` et `VITE_API_PROXY_TARGET=http://localhost:3001`.
   - Pour le faux backend autonome, retirez `VITE_API_URL` de `.env` et `.env.local`.

---

## Commandes de vérification technique (optionnel)
```bash
npm run lint
npm run build
npm test --workspace=@ecommerce/api
npm run typecheck --workspace=@ecommerce/api
```
