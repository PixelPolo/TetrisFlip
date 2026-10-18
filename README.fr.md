# TetrisFlip

[🇬🇧 English](README.md) · 🇫🇷 Français

Un Tetris 3D qui tourne dans le navigateur, où la **caméra tourne autour du plateau** et où le **plateau se retourne comme un sablier**.

## Le jeu

- Règles classiques : tirage « 7-bag », rotations SRS avec wall kicks, réserve (hold), niveaux.
- **Deux difficultés, choisies avant de jouer** : *Facile* affiche une pièce fantôme (là où la pièce va atterrir), *Difficile* non. Chacune a son propre classement.
- Pièces et plateau en 3D (Three.js). Deux thèmes : couleurs modernes, ou le **vert d'origine de la Game Boy**.
- **Bullet time** : après un délai aléatoire (10 à 60 s, `bulletEveryMs`) les pièces ralentissent presque à l'arrêt pendant que la caméra fait un demi-tour autour du plateau avec inclinaison et traînées, façon Matrix. Tu joues ensuite de l'autre côté avec **gauche/droite (et rotations) inversés**, à moitié vitesse, pendant 6 à 10 s en début de partie puis 10 à 20 s. Un second bullet time te ramène au contrôle normal. En mode *Facile*, un petit compte à rebours indique l'arrivée du prochain bullet time.
- **Bullet time constant** : à partir du niveau 5 (`constantCameraFromLevel`), le bullet time aléatoire laisse place à un mode constant. La caméra tourne en permanence autour du plateau, de plus en plus vite à chaque niveau (`constantSpinDegPerSecond`), les pièces tombent à la vitesse normale du niveau (plus de ralenti), et gauche/droite restent inversés dès que la caméra est derrière le plateau. La bordure du plateau est bleue devant et devient rouge quand la caméra est derrière.
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

Crée **une seule ressource Docker Compose** sur ce dépôt (`docker-compose.yml`, aucun autre fichier).

1. Ne mets **pas** `COMPOSE_FILE` dans Coolify : `docker-compose.local.yml` publie des ports sur l'hôte, il est réservé à ton poste.
2. Définis le domaine du service `frontend` dans l'interface Coolify, port `8080`, et active la redirection HTTPS. Traefik atteint le conteneur sur son port interne ; rien n'est publié sur l'hôte.
3. Définis `MONGO_ROOT_PASSWORD` et `MONGO_APP_PASSWORD` comme **secrets d'exécution uniquement** (`openssl rand -hex 24`, en hexadécimal car le mot de passe est dans une URI). Ne donne jamais de domaine à la base ni à l'API.
4. Conserve le volume `mongo-data` quand tu supprimes ou redéploies la ressource, et planifie un `mongodump` quotidien (*Scheduled Task* Coolify sur le service `tetrisflip-mongo`) copié hors du serveur : un Mongo dans une ressource Compose n'a pas de sauvegarde automatique.
5. Après le premier déploiement, vérifie que `https://ton-domaine/` répond, que `http://` redirige, et que `https://ton-domaine/actuator/health` affiche la page du jeu (pas le JSON de santé).
6. Teste ensuite les comptes en HTTPS : inscription, rechargement (tu restes connecté), déconnexion, connexion, une partie et l'enregistrement du score. Le cookie de session est `Secure`, il ne fonctionne qu'en HTTPS.
7. Les limites de débit utilisent l'adresse visiteur vue par nginx. Fais 6 mauvais mots de passe d'affilée sur un compte (tu obtiens un 429), puis vérifie depuis un autre appareil que tu n'es pas bloqué aussi. Si tous les visiteurs paraissent identiques, ajoute la plage du réseau Docker de Traefik dans `set_real_ip_from` de `frontend/nginx/default.conf.template`.

Les noms de services sont préfixés (`tetrisflip-api`, `tetrisflip-mongo`) pour ne pas entrer en collision avec d'autres applications sur le réseau Docker partagé de Coolify.

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

- Seul le conteneur nginx est joignable. MongoDB et l'API sont sur un réseau Docker interne, sans route vers l'extérieur.
- L'application se connecte à MongoDB avec son propre utilisateur (`readWrite` sur `tetrisflip` uniquement) ; le compte root n'est jamais utilisé par l'application. L'utilisateur est créé au premier démarrage d'un volume vide : sur un volume existant, crée-le une fois avec `mongosh` ou recrée le volume.
- Les conteneurs tournent sans root, avec un système de fichiers en lecture seule, sans capabilities, `no-new-privileges`, des limites mémoire et processus, et des logs tournants.
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
