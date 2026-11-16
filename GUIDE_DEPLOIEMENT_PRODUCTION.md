# Guide Détaillé de Mise en Production — ZandoGo (RDC)

Ce document regroupe toutes les étapes exactes pour déployer la plateforme sur un serveur réel (VPS) avec nom de domaine HTTPS, base de données PostgreSQL, cache temps réel Redis, paiements Mobile Money / Carte Bancaire et notifications SMS.

---

## 1. Prérequis Serveur & Nom de Domaine

1. **Serveur (VPS Ubuntu 22.04 / 24.04 recommandé)** :
   - Minimum : **2 vCPU**, **4 Go RAM**, **40 Go SSD**.
   - Logiciels à installer : **Docker**, **Docker Compose v2**, **Node.js 22** (ou Bun).
2. **Nom de domaine & DNS** :
   - Créez un enregistrement DNS de type **A** pointant `votredomaine.cd` (et `www.votredomaine.cd`) vers l'adresse IP publique du VPS.
3. **Pare-feu (UFW)** :
   - Ouvrez uniquement les ports `22` (SSH), `80` (HTTP) et `443` (HTTPS).

---

## 2. Configurer les Variables d'Environnement

### A. Fichier `.env` à la racine du projet (utilisé par Docker Compose & Caddy)

Créez le fichier `.env` à la racine avec :

```env
SITE_ADDRESS=votredomaine.cd
POSTGRES_PASSWORD=ChoisissezUnMotDePasseTresRobuste123!
```

### B. Fichier `apps/api/.env` (utilisé par le serveur API)

Générez d'abord deux secrets aléatoires de 64 caractères pour l'authentification :

```bash
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

# Sécurité Authentification JWT (collez les 2 clés générées ci-dessus)
JWT_ACCESS_SECRET=collez_votre_premier_secret_64_caracteres
JWT_REFRESH_SECRET=collez_votre_deuxieme_secret_64_caracteres
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Agrégateur de paiement (commencez en sandbox pour valider, puis passez à production)
MAISHAPAY_GATEWAY_MODE=sandbox
MAISHAPAY_API_KEY=votre_cle_publique
MAISHAPAY_SECRET_KEY=votre_cle_secrete
# Optionnel : laissez vide si votre espace marchand ne fournit pas de secret webhook
MAISHAPAY_WEBHOOK_SECRET=

# Notifications SMS (Africa's Talking)
AFRICASTALKING_USERNAME=votre_username_africastalking
AFRICASTALKING_API_KEY=votre_cle_api_africastalking
AFRICASTALKING_SENDER_ID=ZandoGo

# Stockage des fichiers (images catalogue & livres PDF)
# "local" pour démarrer vite ; passez à "s3" (AWS S3 / Cloudflare R2) en forte charge
UPLOADS_DRIVER=local
UPLOADS_LOCAL_DIR=./uploads
```

> **Note concernant les 2 clés de paiement** : le serveur est configuré pour fonctionner avec uniquement `MAISHAPAY_API_KEY` et `MAISHAPAY_SECRET_KEY`. Lorsqu'un webhook arrive sans `MAISHAPAY_WEBHOOK_SECRET`, le serveur contre-vérifie automatiquement le statut de la transaction auprès de l'API avant de valider la commande.

---

## 3. Démarrer PostgreSQL + Redis & Synchroniser le Schéma

Depuis la racine du projet sur le serveur :

```bash
# 1. Démarrer PostgreSQL 16 et Redis 7
docker compose up -d postgres redis

# 2. Installer les dépendances et synchroniser toutes les tables en base
npm install
cd apps/api
npx prisma generate
DATABASE_URL="postgresql://ecommerce:ChoisissezUnMotDePasseTresRobuste123!@127.0.0.1:5432/ecommerce?schema=public" npx prisma db push
cd ../..
```

> `prisma db push` crée immédiatement toutes les tables et les derniers champs ajoutés (trajets d'agences de transport, date de paiement pour le décompte 48h, paramètres dynamiques des frais de transaction et retraits immédiats).

---

## 4. Compiler le Frontend & Lancer la Plateforme en HTTPS

```bash
# 1. Générer le fichier package-lock.json dans apps/api (requis par le Dockerfile)
cd apps/api && npm install --package-lock-only && cd ../..

# 2. Compiler l'interface web de production (génère apps/web/dist servi par Caddy)
npm run build

# 3. Construire et démarrer l'API et Caddy (HTTPS automatique Let's Encrypt)
docker compose up -d --build
```

Vérifiez que tous les conteneurs fonctionnent correctement :

```bash
docker compose ps
docker compose logs -f api
```

---

## 5. Créer et Promouvoir le Premier Compte `SUPER_ADMIN`

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

3. Déconnectez-vous puis reconnectez-vous sur le site : vous avez désormais accès complet à la **Console Super Admin**.

---

## 6. Configurer les URLs chez Votre Agrégateur & Africa's Talking

### A. Dans votre tableau de bord marchand de l'agrégateur de paiement
Configurez ces deux adresses publiques exactes :
- **Webhook Mobile Money (Collectes C2B & Décaissements B2C)** :  
  `https://votredomaine.cd/api/payments/callbacks/gateway`
- **URL de retour Carte Visa / Mastercard** :  
  `https://votredomaine.cd/api/payments/callbacks/card`

### B. Dans votre tableau de bord Africa's Talking
- Vérifiez que votre **Sender ID** (`ZandoGo` ou votre identifiant validé en RDC) est bien actif pour Vodacom, Airtel, Orange et Africell.
- Alimentez le crédit SMS pour assurer l'envoi instantané des confirmations de commande, des liens de téléchargement de livres et des notifications de retrait.

---

## 7. Checklist de Validation Avant Ouverture au Public

Effectuez ces tests dans l'ordre avant d'annoncer le lancement :

1. **Réglages Super Admin** :
   - Définissez le taux de change USD ↔ CDF du jour.
   - Vérifiez les frais de transaction (**3,5 %**), le pourcentage de commission (**0 % à 5 %** selon votre choix), les prix des boutiques/modules et le mode de retrait immédiat.
2. **Boutique, Produits, Livres & Agences de Transport** :
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
     - Pour un livre PDF, vérifiez que le **lien de téléchargement** est immédiatement utilisable sans action du vendeur.
     - Vérifiez dans le portefeuille vendeur que le décompte **48h** a commencé à l'heure du paiement.
5. **Test Retrait Vendeur (B2C)** :
   - Depuis le Super Admin, activez le retrait immédiat (ou cliquez sur **Débloquer fonds maintenant**) pour la boutique test.
   - Demandez un retrait vers votre propre numéro Mobile Money et vérifiez la réception des fonds sans frais plateforme ajoutés.
6. **Test Litige & Blocage de Retrait** :
   - Ouvrez un litige sur une commande test et vérifiez que le retrait du vendeur concerné est bloqué jusqu'à résolution par le Super Admin.

---

## 8. Maintenance & Sauvegardes Recommandées

### Sauvegarde manuelle ou cron quotidienne de la base PostgreSQL

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U ecommerce ecommerce > backups/zandogo_$(date +%F_%H%M).sql
```

### Passage futur au stockage Cloud S3 / Cloudflare R2 (recommandé dès forte croissance)
Dans `apps/api/.env`, passez `UPLOADS_DRIVER=s3` et renseignez `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_BUCKET`, `S3_PRIVATE_BUCKET`, `S3_PUBLIC_BASE_URL`, `S3_ACCESS_KEY` et `S3_SECRET_KEY`, puis redémarrez avec `docker compose up -d api`. Cela protège vos livres PDF dans un bucket privé accessible uniquement par liens signés temporaires.
