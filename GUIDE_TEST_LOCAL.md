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

Cette méthode lance l’interface complète sur le port `3000` avec la passerelle API intégrée en mémoire (aucun PostgreSQL requis).

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

### 1. Préparer les variables d’environnement
À la racine du projet, créez le fichier `.env` à partir de `.env.example` :
```bash
cp .env.example .env
```

Renseignez au minimum les variables suivantes dans `.env` :
```env
PORT=3001
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zandogo?schema=public
JWT_ACCESS_SECRET=cle_secrete_access_locale_tres_longue_32_caracteres_minimum
JWT_REFRESH_SECRET=cle_secrete_refresh_locale_tres_longue_32_caracteres_differente
UPLOADS_DRIVER=local
UPLOADS_LOCAL_DIR=./uploads
MAISHAPAY_GATEWAY_MODE=sandbox
```

> **Important (port 3000 vs 3001)** : l’interface web démarre sur le port **`3000`**. Utiliser `PORT=3001` pour l’API NestJS évite tout conflit de port.

Créez ensuite le fichier `apps/web/.env.local` pour connecter le frontend à l’API NestJS locale :
```env
VITE_API_URL=http://localhost:3001/api
```

### 2. Démarrer PostgreSQL (et Redis en option)
- **Avec Docker Compose** :
  ```bash
  docker compose up -d postgres redis
  ```
- **Ou avec votre PostgreSQL local** : vérifiez que la base `zandogo` existe et correspond à `DATABASE_URL`.

### 3. Installer, migrer et initialiser la base de données
```bash
npm install
npm run prisma:generate --workspace=@ecommerce/api
npm run prisma:deploy --workspace=@ecommerce/api
npm run prisma:seed --workspace=@ecommerce/api
```

### 4. Lancer l’API et le Frontend (dans 2 terminaux séparés)

- **Terminal 1 — Démarrer l’API NestJS** :
  ```bash
  npm run start:dev --workspace=@ecommerce/api
  ```
  *(L’API est accessible sur `http://localhost:3001/api`)*

- **Terminal 2 — Démarrer le Frontend React/Vite** :
  ```bash
  npm run dev
  ```
  *(Le site est accessible sur `http://localhost:3000`)*

### 5. Compte Super Admin créé par le seed
- **Email** : `admin@zandogo.cd`
- **Mot de passe initial** : `ZandoGoAdmin2026!`

Vous pouvez également créer de nouveaux comptes clients ou vendeurs directement depuis `/register`.

---

## Liste de contrôle pour vos tests locaux

1. **Page d’accueil** :
   - Panneau principal en vert clair et léger.
   - Carrousel droit alimenté dynamiquement par la vitrine produits.
   - Section *« Offres mises en avant sur ZandoGo »* affichant 4 cartes à la fois avec défilement automatique/manuel lorsqu’il y a plus de 4 offres éligibles.
2. **Cartes produits & Catalogue** :
   - Images agrandies (`5:4`), espace interne resserré, pastilles de couleurs affichées juste à côté du prix.
   - 5 produits par ligne sur grand écran dans le catalogue.
3. **Navigation** :
   - Chaque clic de redirection (accueil, catalogue, panier, fiche produit, espace vendeur, admin) ouvre la nouvelle page tout en haut.
4. **Commandes, Factures & Règle de litige 48h** :
   - Téléchargement de la facture détaillée après achat.
   - Bouton *Litige* masqué/bloqué après **48h** si le client et le vendeur sont dans la **même ville**, mais conservé ouvert si les villes sont différentes.

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
5. **Si vous aviez créé `apps/web/.env.local` (Option 2)** :
   - Assurez-vous que l’API NestJS tourne bien sur le port `3001` (`VITE_API_URL=http://localhost:3001/api`), ou supprimez `apps/web/.env.local` pour utiliser l’Option 1 autonome.

---

## Commandes de vérification technique (optionnel)
```bash
npm run lint
npm run build
npm test --workspace=@ecommerce/api
npm run typecheck --workspace=@ecommerce/api
```
