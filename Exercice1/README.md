# Apprentissages

## Exercice 1 – Conteneuriser l'application guestbook

Faire tourner l'app Go en local, la mettre dans une image Docker légère (< 20 MB) grâce à un build multi-étapes, puis la lancer avec `docker compose up`.

### Commandes utilisées

```bash
go run main.go                                         # lancer l'app en local
docker build -t guestbook:v0.1.0 -f dockerfile ..      # construire l'image (depuis Exercice1/)
docker images guestbook                                # vérifier la taille
docker run --publish 3000:3000 guestbook:v0.1.0        # lancer le conteneur
docker compose up --build                              # lancer via compose
```

### Taille de l'image : avant / après

```bash
docker build --target builder -t guestbook:avant -f dockerfile ..   # image 1 étape (golang)
docker build -t guestbook:v0.1.0 -f dockerfile ..                   # image multi-étapes (scratch)
docker images guestbook
```

```
REPOSITORY   TAG          SIZE
guestbook    v0.1.0       15MB
guestbook    avant       1.03GB
```

| Image | Base | Contenu | Taille |
|---|---|---|---|
| Avant | `golang:1.27` | toolkit Go + sources + binaire | **1.03 GB** |
| Après | `scratch` | binaire + `public/` | **15 MB** |

➡️ Environ **70x plus petite**, et sous la limite des 20 MB.

### Problème rencontré et pourquoi il est survenu

- **Image trop grosse** S
- **Le binaire ne se lance pas dans `scratch`** 
- **Port 3000 déjà utilisé** : l'app lancée avec `go run` tournait encore sur ma machine, donc Docker ne pouvait pas publier le port.
- **Contexte de build** : le Dockerfile est dans `Exercice1/` mais le code est à la racine du dépôt.

### Solution appliquée et pourquoi cette solution fonctionne

- **Build multi-étapes** : une étape `builder` compile, et l'étape finale part de `scratch` et ne récupère que le binaire + le dossier `public`. Le toolkit Go reste dans l'étape jetée.
- **Binaire statique** avec `CGO_ENABLED=0 GOOS=linux go build` : le binaire contient tout ce dont il a besoin, il n'a donc besoin d'aucune lib système.
- **Cache Docker** : on copie `go.mod`/`go.sum` et on fait `go mod download` avant de copier le code, pour ne pas retélécharger les dépendances à chaque modification.
- **Port** : arrêter l'ancien process (ou publier sur un autre port, ex. `-p 3001:3000`).

### Comparaison avec la solution

<details>
<summary>Comparez votre travail à la solution avant de continuer. Y a-t-il des différences ? Votre approche est-elle meilleure ou pire ? Pourquoi ?</summary>

```diff
- version: '3'
  services:
    guestbook:
      build:
-       context: ./
-       dockerfile: Dockerfile
+       context: ..
+       dockerfile: Exercice1/dockerfile
+     image: guestbook:v0.1.0
      ports:
-     - 3000:3000
+       - "3000:3000"
```

- **`version: '3'` retiré** : ce champ est obsolète dans Compose v2, Docker l'ignore et affiche un warning.
- **`context: ..`** : mon Dockerfile est dans `Exercice1/` alors que le code est à la racine. Le chemin du `dockerfile` est relatif au contexte.
- **`image: guestbook:v0.1.0`** : l'image construite est taguée avec une version, au lieu d'un nom auto-généré (`exercice1-guestbook`).
- **Port entre guillemets** : évite que YAML interprète mal certaines valeurs `xx:yy`.

Même résultat que la solution, un peu plus propre (pas de champ obsolète, image versionnée).

</details>


### Ce que j'ai appris

- Écrire un Dockerfile (`FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`).
- La différence entre une image de build et une image d'exécution, et l'intérêt de `scratch` (taille + surface d'attaque réduite).
- Ce qu'est un binaire lié statiquement.
- `docker compose` permet de décrire de façon déclarative ce qu'on tapait en commandes (`build`, `ports`).

### Docs

- [Référence Dockerfile](https://docs.docker.com/reference/dockerfile/)
- [Builds multi-étapes](https://docs.docker.com/build/building/multi-stage/)
- [Construire une image Go](https://docs.docker.com/guides/golang/build-images/)
- [Image `scratch`](https://hub.docker.com/_/scratch)
- [Spécification Compose](https://docs.docker.com/reference/compose-file/)
- [`docker run --publish`](https://docs.docker.com/reference/cli/docker/container/run/#publish)
- [`Docker compose version`](https://forums.docker.com/t/docker-compose-yml-version-is-obsolete/141313)
