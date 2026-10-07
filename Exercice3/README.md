# Apprentissages

## Exercice 3 – Persistance et hot-reloading

Deux améliorations du confort de dev :
1. **Persistance** : un volume Docker pour que Redis garde ses données après `docker compose down`.
2. **Hot-reloading** : avec [Air](https://github.com/air-verse/air), l'app Go est recompilée et relancée automatiquement à chaque modification, sans reconstruire l'image.

### Commandes utilisées

```bash
docker compose up -d --build                         # prod avec volume redis
docker compose down && docker compose up -d          # tester la persistance
docker volume ls                                     # voir le volume exercice3_redis_data
docker compose -f docker-compose.dev.yaml up --build # mode dev avec Air
docker compose -f docker-compose.dev.yaml logs -f guestbook  # voir Air recompiler
docker compose down -v                               # tout supprimer, volume compris
```

### Avant / après : persistance

**Avant** (exo 2, sans volume) :

```
$ curl localhost:3000/rpush/guestbook/Bonjour
$ docker compose down && docker compose up -d
$ curl localhost:3000/lrange/guestbook
[]                                  
```

**Après** (exo 3, volume `redis_data:/data`) :

```
$ curl localhost:3000/rpush/guestbook/Bonjour
$ curl localhost:3000/rpush/guestbook/Persistant
$ docker compose down
$ docker volume ls --filter name=redis_data
DRIVER    VOLUME NAME
local     exercice3_redis_data       
$ docker compose up -d
$ curl localhost:3000/lrange/guestbook
["Bonjour", "Persistant"]           
```

### Avant / après : hot-reloading

**Avant** : chaque modification de `main.go` demande `docker compose up --build` (reconstruction complète de l'image).

**Après** : j'ai ajouté temporairement une route `/hello` dans `main.go`, sans rien relancer.

```
$ curl localhost:3000/hello
404 page not found                   # avant la modif

# ... j'enregistre main.go ...

$ docker compose -f docker-compose.dev.yaml logs guestbook
[13:00:03] main.go has changed
[13:00:03] building...
[13:00:07] running...

$ curl localhost:3000/hello
Hello Mikhail, hot reload OK        
```

| | Avant | Après |
|---|---|---|
| Données après `down` / `up` | perdues | conservées (volume) |
| Modifier `main.go` | rebuild de l'image | recompilé automatiquement par Air (~4 s) |

### Problème rencontré et pourquoi il est survenu

- **Air ne détectait aucune modification** 
- **Le code est à la racine du dépôt**, pas dans `Exercice3/` : il faut monter tout le dépôt et dire à Air d'ignorer les autres dossiers.
- **Ne pas polluer le dépôt** 

### Solution appliquée et pourquoi cette solution fonctionne

- **Volume nommé** `redis_data:/data` 
- **Bind mount** `..:/app` : le dossier du dépôt sur mon PC **est** le dossier `/app` du conteneur. Une modification sur le PC est immédiatement visible dans le conteneur.
- **`poll = true`** dans `.air.toml` : Air vérifie lui-même les fichiers 
- **`exclude_dir`** pour les dossiers `Exercice*`, `public`, `datasets`, etc., et **`/tmp/air`** pour le binaire compilé (hors du dépôt).
- **Dépendances dans l'image** (`go mod download` dans `dockerfile.dev`) : pas de re-téléchargement à chaque démarrage.

### Comparaison avec la consigne

<details>
<summary>Ce qui a changé dans le docker-compose par rapport à l'exercice 2</summary>

```diff
  services:
    guestbook:
      build:
        context: ..
-       dockerfile: Exercice2/dockerfile
+       dockerfile: Exercice3/dockerfile
-     image: guestbook:v0.2.0
+     image: guestbook:v0.3.0
      ...
    redis:
      image: redis:7
      ports:
        - "6379:6379"
+     volumes:
+       - redis_data:/data
+
+ volumes:
+   redis_data:
```

- J'ai séparé **prod** (`docker-compose.yaml`, image `scratch` de 15 MB) et **dev** (`docker-compose.dev.yaml`, image `golang` + Air ~1 GB). L'image de dev est grosse mais elle n'est jamais déployée.
- Les deux fichiers utilisent le même volume `redis_data`, donc les messages sont partagés entre dev et prod.
- En dev, je n'expose pas le port de Redis : l'app y accède par le réseau interne.

</details>

### Ce que j'ai appris

- Différence **volume nommé** (géré par Docker, pour les données) / **bind mount** (dossier de mon PC, pour le code en dev).
- `docker compose down` garde les volumes, `down -v` les supprime.
- Avoir une config de dev et une config de prod séparées (`-f docker-compose.dev.yaml`).

### Docs

- [Volumes Docker](https://docs.docker.com/engine/storage/volumes/)
- [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [`volumes` dans Compose](https://docs.docker.com/reference/compose-file/volumes/)
- [Persistance Redis](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Air (hot reload Go)](https://github.com/air-verse/air)
- [Exemple de `.air.toml`](https://github.com/air-verse/air/blob/master/air_example.toml)
