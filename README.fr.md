# TetrisFlip

[🇬🇧 English](README.md) · 🇫🇷 Français

Un Tetris 3D qui tourne dans le navigateur, où la **caméra tourne autour du plateau** et où le **plateau se retourne comme un sablier**.

## Le jeu

- Règles classiques : tirage « 7-bag », rotations SRS avec wall kicks, réserve (hold), niveaux.
- **Deux difficultés, choisies avant de jouer** : *Facile* affiche une pièce fantôme (là où la pièce va atterrir), *Difficile* non. Chacune a son propre classement.
- Pièces et plateau en 3D (Three.js). Deux thèmes : couleurs modernes, ou le **vert d'origine de la Game Boy**.
- **Bullet time** : après un délai aléatoire (10 à 60 s, `bulletEveryMs`) les pièces ralentissent presque à l'arrêt pendant que la caméra fait un demi-tour autour du plateau avec inclinaison et traînées, façon Matrix. Tu joues ensuite de l'autre côté avec **gauche/droite (et rotations) inversés**, à moitié vitesse, pendant 6 à 10 s en début de partie puis 10 à 20 s. Un second bullet time te ramène au contrôle normal. En mode *Facile*, un petit compte à rebours indique l'arrivée du prochain bullet time.
- **Bullet time en rotation** : à partir du niveau 5 (`spinFromLevel`), le bullet time ne fait plus un demi-tour puis retour. Il arrive à la même fréquence, mais la caméra tourne en continu autour du plateau pendant une durée aléatoire (mêmes bornes que la phase inversée), de plus en plus vite à chaque niveau (`spinDegPerSecond`), puis ralentit et s'arrête devant le plateau. Les pièces tombent à la vitesse normale du niveau et gauche/droite restent inversés dès que la caméra est derrière le plateau. La bordure du plateau est bleue devant et devient rouge quand la caméra est derrière. Le sens de rotation alterne d'un bullet time à l'autre (horaire, puis antihoraire, etc.), pour le demi-tour comme pour la rotation continue.
- **Flip vertical** : tous les 1 000 points, ou dès que tu fais quatre lignes d'un coup (un Tetris), le plateau se retourne et les blocs tombent comme du sable dans un sablier, ce qui libère aussi les lignes avec trous.
- **Son** : une version chiptune du chant folklorique russe *Korobeiniki* (domaine public) avec notre propre synthèse et ligne de basse, plus des effets sonores, tous synthétisés dans le navigateur (aucun fichier audio). La musique démarre après ton premier clic ou appui sur une touche et a un bouton muet (mémorisé). Elle n'utilise volontairement aucun enregistrement ni partition de Nintendo / The Tetris Company : le dépôt est public et ils sont protégés par le droit d'auteur. La mélodie est le chant folklorique que tout le monde connaît, donc elle sonne familière ; aucune garantie juridique absolue n'est possible, à remplacer si le projet devient commercial.
- **Comptes et mode invité** : un invité peut essayer le jeu pendant une minute au total (`GUEST_TRIAL_MS` dans `frontend/src/guest.ts`), puis doit créer un compte ou se connecter. Seuls les joueurs connectés peuvent enregistrer un score.
- Clavier, pad tactile façon Game Boy (croix, A, B, Select, Start) ou commandes au swipe en option sur mobile (un carré de swipe arrondi sous le plateau, pour garder les doigts hors du jeu).

| Touche | Action |
| --- | --- |
| ← → | Déplacer |
| ↑ / X, Z | Tourner dans le sens horaire / antihoraire |
| ↓ | Descente douce |
| Espace | Chute immédiate |
| C | Réserve (hold) |
| P / Échap | Pause |

**Mobile** : la croix déplace (haut = chute immédiate, bas = descente douce), A tourne, B tourne dans l'autre sens, Select met en réserve, Start lance ou met en pause. Le swipe est le mode par défaut sur téléphone (le pad disparaît), et le menu burger (en haut à droite, il met le jeu en pause) bascule entre swipe et pad avec *Controls* : toucher pour tourner, glisser à gauche/droite pour déplacer, glisser vers le bas pour descendre, d'un coup sec vers le bas pour la chute immédiate, vers le haut pour changer de pièce (réserve).

Les règles sont dans `frontend/src/game/config.ts` (taille du plateau, fréquence du flip et de la caméra, durées).

## Architecture

| Partie | Technologies | Rôle |
| --- | --- | --- |
| `frontend/` | TypeScript, Vite, Three.js, servi par nginx | Tout le jeu tourne dans le navigateur |
| `backend/` | Spring Boot 4, Java 25 | API du classement uniquement (`GET /api/scores?difficulty=easy\|hard`, `POST /api/scores`) |
| MongoDB 9 | | Stocke les scores |
| `e2e/` | Playwright | Tests de bout en bout (écran de bureau et mobile) |

La logique du jeu est un module TypeScript pur (`frontend/src/game`), sans DOM ni WebGL : elle est testée directement. Le backend valide et stocke seulement les scores, donc il consomme très peu. Les scores sont envoyés par le client : le classement est ludique, pas à l'épreuve de la triche.

## Lancer en local

Il faut Docker avec Compose.

```bash
cp .env.example .env        # puis remplis les deux mots de passe (openssl rand -hex 24)
docker compose up --build
```

Ouvre <http://localhost:8080>. Le conteneur nginx sert le jeu et redirige `/api` vers le backend : le navigateur ne parle qu'à une seule origine.

### Développer sans Docker

```bash
docker compose up tetrisflip-mongo      # MongoDB seul (publié sur 127.0.0.1:27017)
cd backend && MONGODB_URI='mongodb://tetrisflip:MONGO_APP_PASSWORD@localhost:27017/tetrisflip' mvn spring-boot:run
cd frontend && npm ci && npm run dev    # http://localhost:5173, redirige /api vers :8080
```

(`docker-compose.local.yml`, chargé via `COMPOSE_FILE` dans ton `.env`, publie les ports 8080 et 27017 sur `127.0.0.1`. Le `docker-compose.yml` de base ne publie rien.)

## Tests

```bash
cd frontend && npm test          # logique du jeu (Vitest)
cd frontend && npm run lint      # ESLint + Prettier
cd backend && mvn verify         # API (Spring MockMvc)
cd e2e && npm ci && npx playwright install chromium
docker compose up --build -d && npm test     # bout en bout, la stack doit tourner
```

La CI (`.github/workflows/ci.yml`) lance les vérifications frontend et backend à chaque pull request ; le seul check à exiger dans le ruleset de la branche est `ci-ok`.

**Les tests de bout en bout sont désactivés dans la CI pour gagner du temps. Lance-les en local et vérifie qu'ils passent avant chaque merge.** Pour les réactiver, décommente le job `e2e` du workflow et remets-le dans les `needs` de `ci-ok`.

## Déployer sur Coolify

Chaque service est sa **propre ressource Coolify**, construite à partir de son Dockerfile dans ce dépôt : MongoDB, l'API et le frontend. Il n'y a pas de ressource Docker Compose. `docker-compose.yml` sert uniquement au développement local.

Crée-les dans cet ordre, et attends que chacune soit **healthy** avant de créer la suivante :

1. `tetrisflip-mongo` (dossier `/mongo`)
2. `tetrisflip-api` (dossier `/backend`)
3. `tetrisflip` (le frontend, dossier `/frontend`)

Coolify nomme chaque conteneur d'après sa ressource, avec un suffixe. Le nom n'est pas `tetrisflip-mongo` : note les deux noms de conteneurs (visibles dans les logs de la ressource, ou avec `docker ps` sur le serveur). Tu en as besoin pour `MONGODB_URI` et `BACKEND_URL`.

### Réglages communs aux trois ressources

- Source : ce dépôt, branche `main`, build pack **Dockerfile**, dossier de base comme indiqué ci-dessus.
- **Connect to Predefined Network** : activé sur les trois, pour que les conteneurs se joignent par leur nom et que Traefik atteigne le frontend.
- Ne mets **jamais** `COMPOSE_FILE` sur Coolify : `docker-compose.local.yml` publie des ports sur l'hôte et sert uniquement à ton poste.
- Les mots de passe sont des **secrets d'exécution uniquement**, saisis dans l'interface Coolify. Génère-les avec `openssl rand -hex 24` (hexadécimal uniquement : le mot de passe est dans une URI).

> **Compromis réseau.** Le réseau prédéfini est partagé avec les autres applications Coolify de ce serveur. Avec le compose, MongoDB et l'API étaient sur un réseau privé sans route entrante ni sortante. Ici, n'importe quel conteneur du réseau partagé peut ouvrir une connexion vers MongoDB et vers l'API. MongoDB exige toujours une authentification avec l'utilisateur applicatif le moins privilégié, ce qui limite les dégâts, mais l'isolation est plus faible qu'avant. Si une autre application du serveur n'est pas de confiance, n'utilise pas ce mode.

### 1. MongoDB (`tetrisflip-mongo`)

- Variables d'exécution :
  - `MONGO_INITDB_ROOT_USERNAME` = `root`
  - `MONGO_INITDB_ROOT_PASSWORD` = un nouveau secret
  - `MONGO_APP_USER` = `tetrisflip`
  - `MONGO_APP_PASSWORD` = un secret, **la même valeur que sur l'API**
- L'image officielle n'active l'authentification que si les variables `MONGO_INITDB_ROOT_*` sont définies. Ne la démarre jamais sans elles.
- Stockage persistant : volume `tetrisflip-mongo-data` sur `/data/db` (la base), et volume `tetrisflip-mongo-backup` sur `/backup` (les sauvegardes).
- Commande de démarrage, si Coolify propose un champ : `mongod --wiredTigerCacheSizeGB 0.25`. Options Docker personnalisées : `--memory 512m --pids-limit 200`.
- Pas de domaine, pas de port publié.
- Healthcheck : intégré à l'image (ping avec `mongosh`). L'utilisateur `tetrisflip` est créé par le script d'initialisation de l'image, **uniquement sur un volume de données vide**.

### 2. API (`tetrisflip-api`)

- Port : `8080`. Pas de domaine.
- Variables d'exécution :
  - `MONGODB_URI` = `mongodb://tetrisflip:<MONGO_APP_PASSWORD>@<nom du conteneur MongoDB>:27017/tetrisflip?serverSelectionTimeoutMS=3000`
- Healthcheck : `GET /actuator/health/readiness` sur le port `8080` (l'image a le même test).
- Options Docker personnalisées, l'équivalent du durcissement du compose : `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true --memory 768m --pids-limit 200`.

### 3. Frontend (`tetrisflip`)

- Port : `8080`. Domaine : `https://ton-domaine`, avec la redirection HTTPS activée. C'est la seule ressource avec un domaine.
- Variables d'exécution :
  - `BACKEND_URL` = `http://<nom du conteneur API>:8080`. Obligatoire : la valeur par défaut de l'image (`tetrisflip-api`) n'est que le nom du service dans le compose.
- Healthcheck : `GET /` sur le port `8080`.
- Options Docker personnalisées : `--read-only --tmpfs /tmp --tmpfs /var/cache/nginx:uid=101,gid=101 --tmpfs /etc/nginx/conf.d:uid=101,gid=101 --cap-drop ALL --security-opt no-new-privileges:true --memory 128m --pids-limit 100`.

Coolify n'applique pas le durcissement du compose tout seul : ce sont les options Docker ci-dessus qui gardent les conteneurs en lecture seule, sans capabilities et avec des limites de mémoire. Vérifie qu'elles apparaissent sur chaque ressource.

### Vérifications après le premier déploiement

1. `https://ton-domaine/` affiche le jeu, et `http://` redirige vers HTTPS.
2. `https://ton-domaine/api/scores?difficulty=easy` renvoie du JSON (l'API passe par le frontend).
3. En HTTPS : inscription, rechargement (tu restes connecté), déconnexion, connexion, une partie et l'enregistrement du score. Le cookie de session est `Secure` : il ne fonctionne qu'en HTTPS.
4. Les limites de débit utilisent l'adresse visiteur vue par nginx. Fais 6 mauvais mots de passe d'affilée sur un compte (tu obtiens un 429), puis vérifie depuis un autre appareil que tu n'es pas bloqué aussi. Si tous les visiteurs paraissent identiques, ajoute la plage du réseau Docker de Traefik dans `set_real_ip_from` de `frontend/nginx/default.conf.template`.

### Sauvegardes

Un MongoDB dans Coolify n'a pas de sauvegarde automatique. Ajoute une **Scheduled Task** sur `tetrisflip-mongo`, quotidienne, qui exporte la base applicative dans le volume de sauvegarde :

```bash
mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db tetrisflip --gzip --archive=/backup/tetrisflip-$(date +%F).archive.gz
find /backup -name 'tetrisflip-*.archive.gz' -mtime +14 -delete
```

Vérifie d'abord dans le Terminal que `mongodump --version` fonctionne dans l'image. Une sauvegarde restée sur le serveur n'en est pas une : copie régulièrement les fichiers du volume `tetrisflip-mongo-backup` hors du serveur.

### Réinitialiser les données

Ne lance **jamais** `dropDatabase`. Il supprime aussi l'utilisateur applicatif, qui n'est recréé que sur un volume vide : l'API ne pourrait plus se connecter à MongoDB. Pour vider seulement les comptes et les scores, ouvre le Terminal de `tetrisflip-mongo` et lance :

```bash
mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin tetrisflip --eval 'db.users.deleteMany({}); db.scores.deleteMany({})'
```

### Migrer depuis l'ancienne stack compose (une seule fois)

L'ancienne stack unique a son propre volume `mongo-data`. Garde-le tant que la nouvelle stack n'est pas vérifiée.

1. Dans l'ancienne ressource Compose, arrête le service `frontend` : plus rien n'atteint l'API. Laisse MongoDB tourner.
2. Dans le Terminal de l'ancien `tetrisflip-mongo`, lance la commande de sauvegarde ci-dessus avec `--archive=/tmp/tetrisflip.archive.gz`. Copie le fichier sur le serveur : `docker cp <conteneur MongoDB de l'ancienne stack>:/tmp/tetrisflip.archive.gz ~/`.
3. Arrête toute l'ancienne stack, et retire son domaine : le nouveau frontend le reprendra.
4. Crée les trois nouvelles ressources, avec le **même** `MONGO_APP_PASSWORD` qu'avant, et attends que MongoDB soit healthy. Copie le fichier dans le nouveau volume de sauvegarde : `docker cp ~/tetrisflip.archive.gz <nouveau conteneur MongoDB>:/backup/`.
5. Dans le Terminal du nouveau `tetrisflip-mongo`, restaure. **N'ajoute pas** `--drop` :
   ```bash
   mongorestore --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=/backup/tetrisflip.archive.gz --nsInclude 'tetrisflip.*'
   ```
6. Compare les compteurs des deux bases (`db.users.countDocuments({})` et `db.scores.countDocuments({})`), puis fais les vérifications ci-dessus.
7. Supprime l'ancienne ressource Compose, et **réponds non** quand Coolify demande s'il faut supprimer ses volumes. Supprime le volume `mongo-data` à la main seulement après un bon moment de fonctionnement de la nouvelle stack et des sauvegardes confirmées.

## Publier une version

Les versions se publient avec le workflow **Release** (`.github/workflows/release.yml`), lancé à la main depuis GitHub : **Actions > Release > Run workflow**. Il gère lui-même les numéros de version.

1. Lance d'abord les tests e2e en local (ils sont désactivés en CI, voir `CLAUDE.md`).
2. Renseigne **version** (`1.1.0`, sans `v` ; elle doit correspondre à la version `-SNAPSHOT` de `main`). Tu peux aussi renseigner **next_version** (prochaine version de développement, par défaut : patch + 1, donc `1.1.1-SNAPSHOT`).
3. Le workflow crée un commit de release (`-SNAPSHOT` retiré dans `backend/pom.xml`, `frontend` et `e2e`), puis un commit qui passe à la prochaine `-SNAPSHOT`, et ouvre une pull request avec les deux. Il lance la CI dessus, crée le tag `vX.Y.Z` sur le commit de release avec une release GitHub (notes générées), et active l'auto-merge. La pull request se merge toute seule quand `ci-ok` est vert (merge commit, pour que le tag reste dans l'historique de `main`).
4. Il refuse tout ce qui n'est pas un simple `X.Y.Z`, un tag ou une branche qui existe déjà, une SNAPSHOT qui n'est pas le dernier `main`, ou des versions qui diffèrent entre les fichiers.

Pour tagger un ancien commit de `main` qui contient déjà exactement `X.Y.Z` (par exemple `1.0.0`), renseigne **commit** avec son SHA : le workflow se contente de le tagger, sans toucher aux versions.

`main` est protégée (pull request et `ci-ok`), donc le changement de version passe par une pull request. Deux réglages du dépôt sont nécessaires : **Settings > Actions > General > Allow GitHub Actions to create and approve pull requests**, et **Settings > General > Allow auto-merge**. Si la pull request est fermée sans merge ou si la CI échoue après la création du tag, supprime le tag, la release et la branche `release/vX.Y.Z` sur GitHub avant de relancer. Merge à la main avec un merge commit, jamais squash ni rebase (le tag sortirait de l'historique de `main`). Sans le premier réglage, le workflow s'arrête avant de tagger quoi que ce soit ; sans le second, il publie quand même et laisse la pull request à merger à la main.

Le workflow n'utilise que le GitHub CLI du runner et le `GITHUB_TOKEN` automatique (`contents`, `pull-requests` et `actions` en écriture sur ce seul job, pour pousser la branche, ouvrir la pull request et lancer la CI) : aucune action tierce et aucun secret.

## Sécurité

- Seul le frontend (nginx) a un domaine public. Dans le fichier compose local, MongoDB et l'API sont sur un réseau Docker interne, sans route vers l'extérieur. Sur Coolify, ils partagent le réseau prédéfini : lis le compromis dans *Déployer sur Coolify*.
- L'application se connecte à MongoDB avec son propre utilisateur (`readWrite` sur `tetrisflip` uniquement) ; le compte root n'est jamais utilisé par l'application. L'utilisateur est créé au premier démarrage d'un volume vide : sur un volume existant, crée-le une fois avec `mongosh` ou recrée le volume.
- Les conteneurs tournent sans root, avec un système de fichiers en lecture seule, sans capabilities, `no-new-privileges`, des limites mémoire et processus, et des logs tournants. Le fichier compose applique tout cela ; sur Coolify, cela vient des options Docker personnalisées listées dans les étapes de déploiement.
- nginx pose les en-têtes de sécurité (CSP, HSTS, `nosniff`, ...), limite la taille et le débit des requêtes (requêtes POST : 20 par minute et par adresse), et ne transmet que `GET` et `POST` sur `/api/`.

### Comptes et anti-triche : ce qui est protégé, et ce qui ne l'est pas

- Inscription avec un pseudo et un mot de passe (10 à 128 caractères). Les mots de passe sont hachés en **Argon2id**, jamais stockés ni journalisés en clair. Les erreurs de connexion sont génériques, et les échecs sont limités par compte (5 par 15 minutes) et par adresse.
- La session est un cookie `HttpOnly`, `SameSite=Lax`, `Secure` (12 h). Les requêtes qui modifient l'état exigent un jeton CSRF (double-submit cookie). Les sessions sont en mémoire dans l'API : un redémarrage déconnecte tout le monde.
- Un score est rattaché au compte connecté (le nom n'est jamais lu dans la requête). Le serveur ne l'accepte que pour une partie qu'il a vue démarrer (`POST /api/games`, usage unique, même difficulté) et applique des contrôles de vraisemblance peu coûteux (durée minimale, lignes et score bornés par le temps écoulé, niveau cohérent avec les lignes), plus une limite de débit par compte.
- **Ce que ça bloque** : scores anonymes ou forgés, usurpation, spam, valeurs absurdes envoyées avec `curl`.
- **Ce que ça ne bloque pas** : le jeu tourne dans le navigateur, donc un tricheur déterminé peut scripter une partie *vraisemblable* ou modifier le client. Seul un rejeu de la partie côté serveur l'empêcherait.
- Compromis connus : on peut verrouiller 15 minutes un pseudo *connu* avec 5 mauvaises tentatives (prix de la protection anti force brute). Les limites se basent sur l'adresse client vue par nginx : après le premier déploiement, vérifie que c'est bien l'adresse réelle du visiteur (sinon ajoute le réseau de Traefik dans `set_real_ip_from`). Le cookie CSRF n'est pas lié à la session : n'héberge pas d'applications non fiables sur des sous-domaines voisins.
- Le **mode invité** est un confort, pas un verrou : le minuteur d'une minute est dans le navigateur (vider les données du site le remet à zéro). Ce que le serveur impose : un invité ne peut jamais enregistrer de score.

## Secrets

Le dépôt est public et ne contient **aucun secret**. Les mots de passe MongoDB sont lus dans `.env` en local (ignoré par git, voir `.env.example`) et dans les variables d'environnement Coolify en production. La CI génère un mot de passe jetable à chaque exécution.
