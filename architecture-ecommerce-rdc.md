# Architecture Technique Complète — Plateforme E-commerce Multi-Acteurs (RDC)

## 0. Résumé du cadrage

| Paramètre | Décision |
|---|---|
| Marché cible | Afrique de l'Ouest/Centrale, priorité RDC (Kinshasa) |
| Devises | USD + CDF (Franc congolais), taux de change géré en interne |
| Paiements | Mobile Money (Vodacom M-Pesa, Orange Money, Airtel Money), Cash à la livraison, Carte bancaire (Stripe) |
| Modèle vendeurs | Commission % par vente |
| Livraison | Hybride : pool de livreurs de la plateforme + livraison gérée par le vendeur |
| Flux produit | Hybride : expédition directe vendeur→client OU entrepôt central selon vendeur |
| Temps réel | Suivi GPS livreur, notifications instantanées, chat client↔vendeur↔livreur |
| Budget hébergement | Petit budget au démarrage (VPS unique), architecture prévue pour scaler ensuite |

---

## 1. Stack technique retenue et justification

### 1.1 Vue d'ensemble

```
Frontend        : React 18 + TypeScript + Vite + TailwindCSS + Zustand (state) + React Query
Backend API     : Node.js + TypeScript + NestJS (structure modulaire, DI native, idéal pour RBAC multi-rôles)
Base de données : PostgreSQL 16
ORM             : Prisma (migrations versionnées, typage automatique bout-en-bout avec TS)
Cache/Files     : Redis (sessions, files d'attente BullMQ, cache catalogue, pub/sub temps réel)
Temps réel      : Socket.io (namespaces séparés : /tracking, /chat, /notifications)
Stockage médias : S3-compatible (Backblaze B2 ou DigitalOcean Spaces — coût très inférieur à AWS S3)
Paiement        : CinetPay (agrégateur — couvre RDC en CDF/USD, Orange/Airtel/M-Pesa + cartes) + Stripe (cartes internationales) + module Cash-on-Delivery interne
Recherche       : PostgreSQL full-text search au départ (extension pg_trgm), migration vers Meilisearch si le catalogue grossit
Conteneurisation: Docker + docker-compose (portabilité, un seul VPS au départ, migration facile vers K8s plus tard)
Reverse proxy   : Caddy ou Nginx (HTTPS automatique, faible coût de configuration)
Monitoring      : Grafana + Prometheus (léger) ou simplement Sentry + Uptime Kuma au démarrage
```

### 1.2 Pourquoi ce choix plutôt qu'un autre ?

- **Node.js/TypeScript de bout en bout** (frontend + backend) : un seul langage, courbe d'apprentissage réduite, écosystème immense, très bonne compatibilité avec le temps réel (WebSockets natifs), et coût d'hébergement faible (pas besoin de JVM ou de runtime lourd).
- **NestJS plutôt qu'Express brut** : Express est trop permissif pour un projet avec autant de rôles et de modules (admin/vendeur/client/livreur/pub). NestJS impose une architecture modulaire (modules, guards, interceptors) qui rend la sécurité et la scalabilité beaucoup plus faciles à maintenir dans la durée.
- **PostgreSQL** : le seul SGBD relationnel qui gère nativement tout ce dont on a besoin ici : transactions ACID strictes (indispensable pour l'argent), JSONB (flexibilité pour les attributs produits variables), extensions géospatiales PostGIS (suivi livreur), full-text search, et `LISTEN/NOTIFY` (on peut s'en servir comme bus d'événements léger en complément de Redis).
- **Prisma** : migrations versionnées obligatoires = traçabilité du schéma dans le temps, un des piliers de votre demande de "traçabilité maximale".
- **Coût d'hébergement** : cette stack tourne intégralement sur **un seul VPS de 4 à 8 Go RAM** (ex. Hetzner, Contabo, ou un fournisseur local) au démarrage : PostgreSQL + Redis + API + reverse proxy, le tout en conteneurs Docker. Le frontend React est buildé statiquement et servi par le même Nginx/Caddy ou par un CDN gratuit (Cloudflare Pages). Coût de départ réaliste : 15 à 30 USD/mois.

---

## 2. Rôles et permissions (RBAC)

### 2.1 Rôles principaux

| Rôle | Description |
|---|---|
| `SUPER_ADMIN` | Contrôle total de la plateforme, gestion des admins, paramètres globaux, taux de change, commissions |
| `ADMIN` | Modération produits/vendeurs, gestion des litiges, support client, validation KYC vendeurs/livreurs |
| `VENDOR_OWNER` | Propriétaire d'une boutique vendeur, gère son catalogue, ses employés, ses finances |
| `VENDOR_STAFF` | Employé d'un vendeur avec permissions limitées (ex: gérer stock, répondre au chat) |
| `DELIVERY_AGENT` | Livreur (interne au pool plateforme ou affilié à un vendeur) |
| `CUSTOMER` | Client final |
| `ADVERTISER` | Peut être un vendeur ou un tiers qui achète de la visibilité publicitaire |

### 2.2 Table de permissions (extrait)

Chaque action sensible est vérifiée via des **Guards** NestJS + une table `permissions` en base pour permettre des rôles personnalisés futurs (ex: "modérateur junior") sans redéploiement de code.

```
permissions: id, code (ex: "product.delete"), description
role_permissions: role_id, permission_id
user_roles: user_id, role_id, scope_id (nullable — ex: boutique_id pour un VENDOR_STAFF)
```

---

## 3. Schéma de base de données PostgreSQL (tables principales)

### 3.1 Identité & utilisateurs

```sql
users (
  id UUID PK,
  email VARCHAR UNIQUE,
  phone VARCHAR UNIQUE,
  password_hash TEXT,
  full_name VARCHAR,
  status ENUM('active','suspended','banned','pending_verification'),
  preferred_currency ENUM('USD','CDF'),
  preferred_language VARCHAR DEFAULT 'fr',
  created_at, updated_at
)

user_roles (id, user_id FK, role VARCHAR, scope_id UUID NULL, created_at)

addresses (
  id, user_id FK, label, commune, quartier, ville, reference_point,
  latitude, longitude, is_default, created_at
)
-- en RDC l'adressage postal classique n'existe pas partout : on privilégie
-- point GPS + repère textuel ("après le rond-point X, 2ème rue à droite")

kyc_documents (
  id, user_id FK, type ENUM('id_card','vendor_license','driver_license'),
  file_url, status ENUM('pending','approved','rejected'), reviewed_by, reviewed_at
)
```

### 3.2 Vendeurs & catalogue

```sql
vendor_stores (
  id, owner_id FK users, store_name, slug UNIQUE, description,
  logo_url, banner_url, status ENUM('pending','active','suspended'),
  commission_rate DECIMAL(5,2), -- override possible par vendeur
  fulfillment_mode ENUM('self_ship','platform_warehouse'),
  created_at
)

categories (id, parent_id NULL, name, slug, icon)

products (
  id, store_id FK, category_id FK, title, slug, description,
  base_price_usd DECIMAL, base_price_cdf DECIMAL,
  status ENUM('draft','active','out_of_stock','archived'),
  is_featured BOOLEAN, boosted_until TIMESTAMP NULL, -- lié au module pub
  created_at, updated_at
)

product_variants (id, product_id FK, sku, attributes JSONB, price_override, stock_qty)
product_images (id, product_id FK, url, position, alt_text)
reviews (id, product_id FK, customer_id FK, order_item_id FK, rating, comment, created_at)
```

### 3.3 Commandes & panier

```sql
carts (id, customer_id FK, currency, created_at, updated_at)
cart_items (id, cart_id FK, product_variant_id FK, quantity, unit_price_snapshot)

orders (
  id, order_number VARCHAR UNIQUE, customer_id FK,
  status ENUM('pending_payment','paid','processing','shipped',
              'out_for_delivery','delivered','cancelled','refunded','disputed'),
  currency, subtotal, shipping_fee, platform_fee, total,
  delivery_address_id FK, created_at, updated_at
)
-- Une commande peut contenir des produits de plusieurs vendeurs :
order_sub_orders (id, order_id FK, store_id FK, status, subtotal, commission_amount)
order_items (id, sub_order_id FK, product_variant_id FK, quantity, unit_price, total_price)

order_status_history (
  id, order_id FK, from_status, to_status, changed_by_user_id, note, created_at
) -- TRAÇABILITÉ : chaque changement d'état est journalisé, jamais écrasé
```

### 3.4 Paiements & finance (cœur de la traçabilité)

```sql
payment_methods (id, code ENUM('mobile_money_orange','mobile_money_airtel',
                                'mobile_money_mpesa','card_stripe','cash_on_delivery'))

payment_transactions (
  id, order_id FK, method_id FK, provider_reference VARCHAR, -- ID renvoyé par CinetPay/Stripe
  amount, currency, exchange_rate_applied DECIMAL,
  status ENUM('initiated','pending','success','failed','refunded'),
  raw_provider_payload JSONB, -- on garde TOUTE la réponse brute du fournisseur = preuve légale
  created_at, confirmed_at
)

wallets (id, owner_type ENUM('vendor','delivery_agent','platform'), owner_id, balance, currency)

wallet_transactions (
  id, wallet_id FK, type ENUM('credit','debit'), amount, currency,
  reference_type ENUM('order_payout','commission','delivery_fee','ad_purchase','withdrawal','refund'),
  reference_id UUID, balance_after DECIMAL, created_at
) -- Grand livre comptable immuable (append-only) : jamais d'UPDATE ni de DELETE,
  -- seulement des insertions. C'est la garantie de traçabilité maximale.

payout_requests (id, wallet_id FK, amount, method, status, processed_by, processed_at)
```

> **Principe clé de traçabilité** : `wallet_transactions` est une table **append-only** (write-once). On ne modifie jamais un solde directement — on calcule toujours le solde comme la somme des transactions, ou on le dénormalise dans `balance_after` à chaque écriture pour un audit instantané. C'est le même principe qu'un grand livre comptable en partie double.

### 3.5 Livraison

```sql
delivery_agents (
  id, user_id FK, affiliation ENUM('platform_pool','vendor_dedicated'),
  vendor_store_id FK NULL, vehicle_type, status ENUM('available','busy','offline'),
  current_lat, current_lng, last_ping_at
)

deliveries (
  id, sub_order_id FK, agent_id FK NULL,
  pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
  status ENUM('awaiting_assignment','assigned','picked_up','in_transit','delivered','failed'),
  estimated_fee, final_fee, distance_km,
  created_at, assigned_at, picked_up_at, delivered_at
)

delivery_tracking_pings (
  id, delivery_id FK, agent_id FK, lat, lng, recorded_at
) -- historique complet du trajet, pas juste la dernière position → traçabilité GPS totale

delivery_proof (
  id, delivery_id FK, type ENUM('signature','photo','otp_code'),
  file_url NULL, otp_value NULL, verified_at
)
```

### 3.6 Publicité (module monétisable)

```sql
ad_campaigns (
  id, advertiser_id FK users, store_id FK NULL, product_id FK NULL,
  type ENUM('featured_homepage','category_boost','search_priority'),
  budget_amount, currency, cost_model ENUM('cpc','cpm','flat_fee'),
  start_at, end_at, status ENUM('draft','pending_payment','active','paused','completed','rejected')
)

ad_impressions (id, campaign_id FK, viewer_user_id NULL, viewed_at, page_context)
ad_clicks (id, campaign_id FK, viewer_user_id NULL, clicked_at)
ad_invoices (id, campaign_id FK, amount, currency, payment_transaction_id FK, issued_at)
```

### 3.7 Messagerie & notifications temps réel

```sql
conversations (id, type ENUM('customer_vendor','customer_delivery','support'), order_id FK NULL)
conversation_participants (conversation_id FK, user_id FK)
messages (id, conversation_id FK, sender_id FK, content, attachment_url, sent_at, read_at)

notifications (
  id, user_id FK, type, title, body, data JSONB,
  is_read BOOLEAN, created_at
)
```

### 3.8 Journal d'audit global (sécurité + conformité)

```sql
audit_logs (
  id, actor_user_id FK NULL, action VARCHAR, entity_type, entity_id,
  before_state JSONB, after_state JSONB, ip_address, user_agent, created_at
)
```
Toute action sensible (changement de prix, suppression produit, modification de commission, remboursement, changement de rôle) passe par un middleware qui écrit automatiquement ici. C'est votre "boîte noire" en cas de litige.

---

## 4. Logique de paiement détaillée

### 4.1 Flux pour Mobile Money (Orange/Airtel/M-Pesa via CinetPay)

1. Le client choisit Mobile Money au checkout → sélection de l'opérateur.
2. Le backend crée une ligne `payment_transactions(status='initiated')`.
3. Appel API CinetPay → déclenche un **push USSD/STK** vers le téléphone du client.
4. Le client valide avec son code PIN sur son téléphone.
5. CinetPay envoie un **webhook** de confirmation → le backend vérifie la signature du webhook (obligatoire pour la sécurité), met à jour `payment_transactions(status='success')`, stocke la réponse brute dans `raw_provider_payload`.
6. Une transaction `wallet_transactions` de type `commission` crédite le vendeur (moins la commission plateforme) et une autre crédite le wallet plateforme.
7. La commande passe automatiquement à `paid` → notification temps réel au vendeur.

**Point de vigilance que je vous signale** (vous avez indiqué ne pas être très informé sur ce sujet) : il faut absolument gérer le cas où le push USSD échoue silencieusement (mauvais réseau, téléphone éteint) — prévoir un **timeout automatique** (ex: 3 minutes) qui repasse la transaction en `failed` pour ne pas bloquer le stock indéfiniment, avec libération automatique du panier réservé.

### 4.2 Flux pour paiement à la livraison (cash)

1. Commande créée directement en `status='processing'` sans `payment_transactions` immédiate.
2. À la livraison, le livreur confirme la réception du cash dans l'app livreur → crée une `payment_transactions(method='cash_on_delivery', status='success')` **horodatée et géolocalisée** (lat/lng du point de livraison au moment de la confirmation).
3. Le livreur devient redevable de cette somme envers la plateforme/vendeur jusqu'à sa remise réelle → on peut suivre un solde "cash en main" par livreur (`wallet` de type spécial) pour éviter les pertes.

### 4.3 Flux carte bancaire (Stripe)

Standard : Payment Intent Stripe, webhook de confirmation, 3D Secure activé par défaut pour la conformité.

### 4.4 Répartition financière automatique (split payment)

Chaque commande payée déclenche un calcul :
```
montant_vendeur = sous_total - (sous_total × commission_rate)
montant_plateforme = sous_total × commission_rate
frais_livraison → crédité au livreur ou au vendeur selon qui a géré la livraison
```
Ce calcul est journalisé ligne par ligne dans `wallet_transactions`, jamais recalculé "à la volée" — ce qui garantit qu'un audit six mois plus tard retrouve exactement les mêmes chiffres qu'au moment de la transaction.

**Règle de gestion validée — délai de rétention** : les fonds d'une commande sont crédités sur le wallet vendeur en statut `on_hold` dès la livraison confirmée, puis basculent automatiquement en `available` (retirable) **48h après** `delivered_at`, via un job planifié (BullMQ + cron). Si un litige est ouvert par le client dans cette fenêtre de 48h, le solde reste bloqué en `on_hold` jusqu'à résolution (voir 4.5).

### 4.5 Gestion des litiges (disputes)

```sql
disputes (
  id, order_item_id FK, opened_by_user_id FK, reason, description,
  status ENUM('open','under_review','resolved_favor_customer','resolved_favor_vendor','resolved_partial'),
  resolution_note, resolved_by_user_id FK NULL, -- doit être un SUPER_ADMIN
  amount_refunded DECIMAL NULL,
  opened_at, deadline_at, resolved_at
)
dispute_messages (id, dispute_id FK, sender_id FK, content, attachment_url, sent_at)
```

**Règle de gestion validée** : tout litige déclenche automatiquement `deadline_at = opened_at + 48h`. Le `SUPER_ADMIN` est seul habilité à trancher (`resolved_by_user_id` doit avoir le rôle `SUPER_ADMIN`), après consultation du vendeur via `dispute_messages` (fil de discussion dédié, distinct du chat client-vendeur classique pour garder une trace juridique séparée). À l'échéance des 48h, une notification d'escalade est envoyée automatiquement au super admin si aucune décision n'a été prise. La décision finale (`resolved_favor_customer` / `resolved_favor_vendor` / `resolved_partial`) déclenche automatiquement les écritures `wallet_transactions` correspondantes (remboursement client, déblocage ou annulation du solde vendeur `on_hold`).

### 4.6 Commission variable par catégorie

```sql
commission_rules (
  id, category_id FK categories, commission_rate DECIMAL(5,2),
  effective_from, effective_to NULL, created_by ADMIN
)
```

**Règle de gestion validée** : chaque catégorie de produit a son propre taux de commission (ex: électronique 5%, mode 10%, alimentaire 7%). Le taux appliqué à une sous-commande est celui en vigueur sur `commission_rules` pour la catégorie du produit **au moment de la commande** — on ne recalcule jamais rétroactivement même si le taux change ensuite (cohérent avec le principe de traçabilité immuable : la ligne `order_sub_orders.commission_amount` fige le calcul fait à l'instant T). Le champ `vendor_stores.commission_rate` sert uniquement de taux par défaut/négocié pour un vendeur si aucune règle de catégorie ne s'applique, ou de remise spéciale négociée par le `SUPER_ADMIN` pour un vendeur donné (dans ce cas il prévaut sur la règle de catégorie — à confirmer si c'est bien le comportement souhaité).

### 4.7 Taux de change (gestion manuelle)

```sql
exchange_rates (
  id, from_currency ENUM('USD','CDF'), to_currency ENUM('USD','CDF'),
  rate DECIMAL(12,4), set_by_admin_id FK users, effective_from, created_at
)
```

**Règle de gestion validée** : le taux USD↔CDF est mis à jour manuellement par un `ADMIN`/`SUPER_ADMIN` via un formulaire dédié dans le back-office (pas d'appel à une API externe de change). Chaque mise à jour crée une **nouvelle ligne** (jamais d'UPDATE) pour garder l'historique complet des taux appliqués dans le temps — essentiel pour justifier `exchange_rate_applied` figé dans chaque `payment_transactions` au moment du paiement. Une alerte interne peut être configurée pour rappeler à l'admin de vérifier le taux si aucune mise à jour n'a eu lieu depuis X jours.

---

## 5. Logique de livraison détaillée

1. Commande payée → sous-commande vendeur passe en `processing`.
2. Le vendeur choisit : livraison **interne** (son propre livreur) ou **délégation au pool plateforme**.
3. Si pool plateforme : un algorithme d'assignation propose la course aux livreurs disponibles les plus proches (calcul de distance via PostGIS `ST_Distance`), avec un système d'acceptation dans une fenêtre de temps (ex: 60 secondes), sinon proposition au suivant.
4. Le livreur scanne/valide le retrait chez le vendeur (`picked_up_at`) → statut temps réel diffusé au client via Socket.io.
5. Pings GPS every ~10-15s pendant le trajet → stockés dans `delivery_tracking_pings`, diffusés en direct au client sur sa page de suivi.
6. À l'arrivée, preuve de livraison obligatoire : signature électronique, photo, ou code OTP envoyé par SMS au client et saisi par le livreur.
7. Statut `delivered` → déclenche la libération des fonds vers le vendeur (selon le délai choisi au point 4.4).

---

## 6. Système de publicité (monétisation future)

- Trois formats prévus : mise en avant page d'accueil, priorité dans une catégorie, priorité dans les résultats de recherche.
- Modèle de coût flexible dès la conception (`cost_model`) : CPC, CPM, ou forfait — pour ne pas devoir refaire le schéma quand vous activerez la monétisation.
- Le module est **actif dans l'architecture dès le départ mais désactivable via un feature flag** (`platform_settings.ads_enabled = false`) pour l'activer uniquement quand vous serez prêt commercialement.
- Chaque impression/clic est journalisé individuellement (`ad_impressions`, `ad_clicks`) pour calculer un ROI réel par vendeur et justifier la facturation.

---

## 7. Temps réel (architecture Socket.io)

```
Namespace /tracking     → événements: delivery:location_update, delivery:status_change
Namespace /chat         → événements: message:new, message:read
Namespace /notifications→ événements: notification:new
```
Redis Pub/Sub est utilisé en interne comme adaptateur Socket.io (`@socket.io/redis-adapter`) pour permettre plus tard de scaler horizontalement sur plusieurs instances backend sans perdre la synchronisation des évènements — important pour préparer la croissance sans réécrire le module.

---

## 8. Sécurité (points non négociables)

- Authentification : JWT access token (courte durée) + refresh token en cookie `httpOnly` `secure`.
- 2FA obligatoire pour `SUPER_ADMIN` et `ADMIN` (OTP par SMS ou app authenticator).
- Toutes les routes financières protégées par vérification de signature webhook (CinetPay/Stripe) — jamais de confiance aveugle dans un webhook entrant.
- Rate limiting (par IP + par utilisateur) sur les endpoints sensibles (login, paiement).
- Validation stricte des inputs (class-validator côté NestJS) + protection CSRF pour les formulaires.
- Chiffrement au repos des documents KYC (bucket privé, URLs signées à durée limitée).
- Séparation stricte des permissions par `scope_id` : un `VENDOR_STAFF` ne peut jamais accéder aux données d'une autre boutique, vérifié à la fois par un Guard applicatif ET par des policies au niveau des requêtes (défense en profondeur).
- Sauvegardes PostgreSQL automatiques quotidiennes + réplication vers un stockage externe (indispensable avant tout lancement en production).

---

## 9. Plan d'hébergement progressif (petit budget)

| Phase | Infrastructure | Coût estimé/mois |
|---|---|---|
| MVP / démarrage | 1 VPS (4-8 Go RAM) : Docker Compose (API+DB+Redis+Nginx), frontend sur Cloudflare Pages (gratuit) | ~15-30 USD |
| Croissance | Séparation DB sur un service managé (ex: DigitalOcean Managed Postgres) + VPS dédié à l'API | ~60-100 USD |
| Scale | Plusieurs instances API derrière un load balancer, Redis managé, CDN pour médias, PostgreSQL avec réplicas de lecture | Variable selon trafic |

L'architecture en conteneurs Docker dès le départ garantit qu'on peut migrer d'une phase à l'autre **sans réécrire de code**, seulement en changeant la configuration de déploiement.

---

## 10. Différenciation design (ne ressembler à aucune autre plateforme)

Ce point sera traité en détail avec le skill de design frontend au moment de construire les interfaces, mais les grandes lignes :
- Palette de couleurs et typographie propres à votre marque, évitant les codes visuels de Jumia/Amazon/Alibaba (pas de bleu-orange générique).
- Layout de fiche produit et de checkout repensé (pas de simple copie du grid Amazon).
- Une identité visuelle forte pour l'espace livreur (souvent négligé chez les concurrents) et pour le tracking temps réel, qui peut devenir un vrai argument différenciant.

---

## 11. Roadmap de développement par phases

1. **Fondations** : setup monorepo (Turborepo), schéma Prisma complet, authentification + RBAC, design system de base.
2. **Cœur e-commerce** : catalogue, panier, checkout, intégration paiement (Mobile Money + Cash + Carte).
3. **Espace vendeur** : dashboard, gestion produits/stock, finances/wallet.
4. **Espace livreur** : app de gestion des courses, tracking GPS, preuve de livraison.
5. **Temps réel** : notifications, chat, tracking live.
6. **Espace admin** : modération, KYC, litiges, audit logs.
7. **Module publicité** : campagnes, facturation (activable plus tard).
8. **Durcissement** : tests de charge, audit sécurité, mise en place des sauvegardes, déploiement production.

---

## 12. Récapitulatif des règles de gestion validées

1. **Rétention des fonds** : les fonds passent en `on_hold` jusqu'à `delivered_at + 48h`, puis `available` automatiquement (job planifié) — sauf litige ouvert entretemps, qui les gèle en `held_for_dispute` (voir 4.4/4.5).
2. **Litiges** : tranchés uniquement par le `SUPER_ADMIN` après consultation du vendeur, avec `sla_deadline = opened_at + 48h` et escalade automatique (voir 4.5).
3. **Commission** : taux par défaut par catégorie (`commission_rules`), avec override possible par vendeur négocié par le `SUPER_ADMIN` (voir 4.6).
4. **Taux de change USD/CDF** : saisie manuelle par un admin, historisée en table append-only, jamais recalculée rétroactivement (voir 4.7).

Le schéma de données est maintenant complet et cohérent avec ces règles. Prochaine étape : génération du schéma Prisma exécutable et de la structure du monorepo.
