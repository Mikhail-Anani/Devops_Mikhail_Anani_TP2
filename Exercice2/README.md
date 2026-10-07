# Apprentissages

## Exercice 2 – Ajouter une base de données (Redis)

L'application est sans état : elle a besoin d'un Redis pour enregistrer les messages. On ajoute un service `redis:7` dans le compose et on indique à l'app où le trouver via la variable `REDIS_HOST`.

### Commandes utilisées

```bash
docker compose up -d --build                              # lancer guestbook + redis
docker compose ps                                         # voir les 2 conteneurs
curl localhost:3000/healthz                               # l'app arrive-t-elle à joindre redis ?
curl localhost:3000/rpush/guestbook/Bonjour               # ajouter un message
curl localhost:3000/lrange/guestbook                      # lire les messages
docker compose exec redis redis-cli LRANGE guestbook 0 -1 # lire directement dans redis
docker compose logs guestbook                             # voir les erreurs de l'app
```

### Avant / après

**Avant** (compose de l'exercice 1, sans Redis) :

```
$ curl localhost:3000/healthz
dial tcp :6379: connect: connection refused [HTTP 500]

$ curl localhost:3000/rpush/guestbook/Bonjour
[HTTP 500]

$ docker compose logs guestbook
guestbook-1  | [negroni] PANIC: dial tcp :6379: connect: connection refused
```

Dans le navigateur : `⚠️ No database connection... ⚠️` et le message reste bloqué sur ⌛.

**Après** (avec Redis) :

```
$ docker compose ps
SERVICE     IMAGE              PORTS
guestbook   guestbook:v0.2.0   0.0.0.0:3000->3000/tcp
redis       redis:7            0.0.0.0:6379->6379/tcp

$ curl localhost:3000/healthz
[HTTP 200]

$ curl localhost:3000/rpush/guestbook/Bonjour
[
  "mika",
  "ko",
  "Bonjour"
]

$ curl localhost:3000/rpush/guestbook/Salut
[
  "mika",
  "ko",
  "Bonjour",
  "Salut"
]

$ docker compose restart guestbook && curl localhost:3000/lrange/guestbook
["Bonjour", "Salut"]       

$ docker compose exec redis redis-cli LRANGE guestbook 0 -1
Bonjour
Salut
```

| | Avant | Après |
|---|---|---|
| Conteneurs | `guestbook` | `guestbook` + `redis` |
| `/healthz` | 500 (connection refused) | 200 |
| Ajouter un message | bloqué, rien n'est enregistré | enregistré dans Redis |
| Après `docker compose down` puis `up` | – | messages perdus (pas de volume, voir exo 3) |

### Problème rencontré et pourquoi il est survenu

- **`dial tcp :6379: connection refused`** 
- **Données perdues après `docker compose down`** : `down` supprime les conteneurs, et les données de Redis étaient stockées dans le conteneur.

### Solution appliquée et pourquoi cette solution fonctionne


- **`REDIS_HOST=redis`** : Compose crée un réseau commun où chaque service est joignable par son **nom**. 
- **`depends_on: redis`** : Redis démarre avant l'app (par contre ça ne garantit pas qu'il soit prêt).


### Comparaison avec la consigne

<details>
<summary>Ce qui a changé dans le docker-compose par rapport à l'exercice 1</summary>

```diff
  services:
    guestbook:
      build:
        context: ..
-       dockerfile: Exercice1/dockerfile
+       dockerfile: Exercice2/dockerfile
-     image: guestbook:v0.1.0
+     image: guestbook:v0.2.0
      ports:
        - "3000:3000"
+     environment:
+       - REDIS_HOST=redis
+     depends_on:
+       - redis
+
+   redis:
+     image: redis:7
+     ports:
+       - "6379:6379"
```


</details>

### Ce que j'ai appris

- Une app peut être configurée par **variables d'environnement** (`environment:` dans Compose).
- Les services d'un même compose se joignent par leur **nom de service** 
- `depends_on` gère l'ordre de démarrage, pas la disponibilité réelle du service.
- Un conteneur est **éphémère** : sans volume, ses données disparaissent avec lui.

### Docs

- [Image officielle Redis](https://hub.docker.com/_/redis)
- [Networking dans Compose](https://docs.docker.com/compose/how-tos/networking/)
- [Variables d'environnement dans Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)
- [`depends_on`](https://docs.docker.com/reference/compose-file/services/#depends_on)
- [`redis-cli`](https://redis.io/docs/latest/develop/tools/cli/)
