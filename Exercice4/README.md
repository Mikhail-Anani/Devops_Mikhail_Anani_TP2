# Apprentissages

## Exercice 4 – Stacks avec hot-reloading

Appliquer le principe de l'exo 3 (code monté en volume + outil qui surveille les fichiers) à d'autres langages. J'ai fait **2 stacks sur 4** : **Node.js Express** et **Python Flask**.

### Fichiers

```
Exercice4/
├── docker-compose.yaml        # lance les 2 stacks
├── node-express/
│   ├── Dockerfile             # node:18-alpine
│   ├── .dockerignore
│   ├── package.json           # script "dev" = nodemon
│   └── server.js
└── python-flask/
    ├── Dockerfile             # python:3.11-slim
    ├── requirements.txt
    └── app.py
```

| Stack | Image | Outil de reload | URL |
|---|---|---|---|
| Node.js Express | `node:18-alpine` | `nodemon --legacy-watch` | http://localhost:3001 |
| Python Flask | `python:3.11-slim` | reloader intégré (`FLASK_DEBUG=1`) | http://localhost:5000 |

### Commandes utilisées

```bash
docker compose up -d --build          # lancer les 2 stacks
docker compose logs -f                # voir les redémarrages
curl localhost:3001                   # Node
curl localhost:5000                   # Flask
docker compose down
```

### Avant / après

Je modifie le texte renvoyé dans `server.js` et `app.py`, **sans relancer aucune commande Docker**.

**Avant la modification :**

```
$ curl localhost:3001
Hello depuis Node.js Express !

$ curl localhost:5000
Hello depuis Python Flask !
```

**Après avoir enregistré les fichiers :**

```
$ docker compose logs
node-express-1  | [nodemon] restarting due to changes...
python-flask-1  |  * Detected change in '/app/app.py', reloading
python-flask-1  |  * Restarting with stat

$ curl localhost:3001
Node modifié : hot reload OK !

$ curl localhost:5000
Flask modifié : hot reload OK !
```

| | Avant (sans hot reload) | Après |
|---|---|---|
| Modifier le code Node | `docker compose up --build` | nodemon redémarre en ~1 s |
| Modifier le code Flask | `docker compose up --build` | Flask recharge en ~1 s |

### Problème rencontré et pourquoi il est survenu

- **`node_modules` écrasé** : le bind mount `./node-express:/app` remplace tout `/app` par mon dossier, où il n'y a pas de `node_modules`. Résultat : `Cannot find module 'express'`.
- **Flask inaccessible depuis le PC** : par défaut `flask run` écoute sur `127.0.0.1`, c'est-à-dire seulement à l'intérieur du conteneur.


### Solution appliquée et pourquoi cette solution fonctionne

- **Volume anonyme `/app/node_modules`** 

- **`--host 0.0.0.0`** : Flask écoute sur toutes les interfaces du conteneur, donc le port publié fonctionne.
- **`FLASK_DEBUG=1`** remplace `FLASK_ENV` : active à la fois le reloader et le debugger.
- **`.dockerignore`** avec `node_modules` : évite de copier un éventuel `node_modules` local dans l'image.

### Comparaison avec la consigne

<details>
<summary>Ce que j'ai fait par rapport à ce qui était demandé</summary>

```diff
  Stack Node.js Express
    nodemon, node:18-alpine, code monté en volume, script "dev"
+   --legacy-watch (polling, nécessaire sous Windows)
+   volume anonyme /app/node_modules

  Stack Python Flask
    python:3.11-slim, pip install -r requirements.txt
-   FLASK_ENV=development       # supprimé depuis Flask 2.3
    FLASK_DEBUG=1
+   --host 0.0.0.0

- Stack Golang (Gin / Echo / Fiber)   # pas fait
- Stack C++ (inotify-tools)           # pas fait
```


</details>

### Ce que j'ai appris

- Le principe du hot reload est le même partout : **bind mount du code** + **un outil qui surveille les fichiers** et relance l'app.
- Un volume anonyme permet de protéger un dossier de l'image (`node_modules`) du bind mount.


### Docs

- [nodemon](https://github.com/remy/nodemon#readme) / [option `--legacy-watch`](https://github.com/remy/nodemon#application-isnt-restarting)
- [Image Node officielle](https://hub.docker.com/_/node)
- [Flask : mode debug](https://flask.palletsprojects.com/en/stable/quickstart/#debug-mode)
- [Flask : suppression de `FLASK_ENV` (changelog 2.3)](https://flask.palletsprojects.com/en/stable/changes/#version-2-3-0)
- [Image Python officielle](https://hub.docker.com/_/python)
- [`.dockerignore`](https://docs.docker.com/build/concepts/context/#dockerignore-files)
