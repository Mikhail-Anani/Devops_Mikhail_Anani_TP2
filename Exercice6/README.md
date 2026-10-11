# Apprentissages

## Exercice 6 – JupyterLab en local avec des notebooks persistants

Lancer JupyterLab avec Docker Compose, protégé par un token, avec les datasets du dépôt accessibles et des notebooks qui restent après un redémarrage.

### Ce qui est monté dans le conteneur

| Dans le conteneur | Vient de | Sert à |
|---|---|---|
| `/home/jovyan/work` | volume `jupyter_notebooks` | mes notebooks |
| `/home/jovyan/.local` | volume `jupyter_data` | paquets Python installés |
| `/home/jovyan/datasets` | dossier `../datasets` (lecture seule) | les datasets (`trees.csv`) |
| `/home/jovyan/examples` | dossier `../examples` (lecture seule) | le notebook de démo |

### Commandes utilisées

```bash
docker compose up -d
docker compose ps
docker compose logs jupyter
docker compose exec -u jovyan jupyter pip install --user cowsay
docker compose down          # garde les volumes
docker compose down -v       # efface notebooks et paquets
```

JupyterLab : http://localhost:8888 (token : `monmotdepasse`, modifiable avec un fichier `.env`).

### Dataset Kaggle

J'ai ajouté le dataset [Wine Reviews](https://www.kaggle.com/datasets/zynicide/wine-reviews) (avis de vins, environ 130 000 lignes) dans le dossier `datasets/`.

| Fichier | Taille |
|---|---|
| `winemag-data-130k-v2.csv` | 53 MB |
| `winemag-data-130k-v2.json` | 79 MB |
| `winemag-data_first150k.csv` | 50 MB |

Ces fichiers ne sont **pas dans le dépôt** (trop gros pour git, ils sont dans le `.gitignore`). Pour les récupérer : les télécharger depuis le lien Kaggle et les déposer dans `datasets/`. Pas besoin de relancer le conteneur, le dossier est monté directement.

Lecture depuis un notebook enregistré dans `work/` :

```python
import pandas as pd

vins = pd.read_csv("/home/jovyan/datasets/winemag-data-130k-v2.csv", index_col=0)
vins.head()
```

### Avant / après

Avant, rien ne répond sur le port 8888. Après `docker compose up -d` :

```
$ docker compose ps
SERVICE   STATUS         PORTS
jupyter   Up (healthy)   0.0.0.0:8888->8888/tcp

$ curl -I localhost:8888/lab
HTTP 302 -> http://localhost:8888/login?next=%2Flab     # demande le token

$ curl localhost:8888/api/contents                       # sans token
HTTP 403
$ curl -H "Authorization: token monmotdepasse" localhost:8888/api/contents
HTTP 200
```

Le notebook `examples/demo-trees.ipynb` lit bien le dataset :

```
   id         species  height_m  circumference_cm  district  planted_year
0   1      Plane tree      24.5               310   Paris 5          1890
1   2      Plane tree      21.0               260  Paris 12          1925
2   3  Horse chestnut      18.2               240   Paris 7          1910
```

Test de la persistance avec la dernière cellule du notebook de démo :

```
# 1er lancement
Marker written, now restart the containers and run this cell again.

$ docker compose down
$ docker volume ls --filter name=exercice6
exercice6_jupyter_data
exercice6_jupyter_notebooks
$ docker compose up -d

# 2e lancement
Found from a previous run: written before restart
```

Test de la persistance des paquets :

```
$ pip install --user cowsay      # installé dans /home/jovyan/.local  -> volume
$ pip install pyjokes            # installé dans /opt/conda           -> conteneur

$ docker compose down && docker compose up -d

$ python -c "import cowsay"      # OK
$ python -c "import pyjokes"     # ModuleNotFoundError
```

| | Avant | Après |
|---|---|---|
| `localhost:8888` | rien | JupyterLab (avec token) |
| Notebooks après `down` / `up` | – | gardés (`jupyter_notebooks`) |
| Paquets après `down` / `up` | – | gardés seulement avec `pip install --user` |
| Datasets | – | lisibles, non modifiables (`Read-only file system`) |

### Problème rencontré et pourquoi il est survenu

- **Le conteneur s'arrêtait tout de suite** avec le compose de la consigne :

  ```
  PermissionError: [Errno 13] Permission denied: '/home/jovyan/.local/share'
  ```

  Le dossier `.local` n'existe pas dans l'image, donc Docker crée le volume `jupyter_data` avec `root` comme propriétaire. Jupyter tourne avec l'utilisateur `jovyan`, qui n'a pas le droit d'écrire dedans.
- **Un paquet installé avec `pip install` disparaît au redémarrage** 
- **Le notebook de démo cherche `/home/jovyan/datasets/trees.csv`** : il faut monter le dossier `datasets` exactement à cet endroit.

### Solution appliquée et pourquoi cette solution fonctionne

- **`user: root` + `CHOWN_EXTRA=/home/jovyan/.local,/home/jovyan/work`** 
- **`pip install --user`** : installe dans `/home/jovyan/.local`, qui est dans le volume `jupyter_data`.
- **`JUPYTER_TOKEN`** : sans lui, n'importe qui sur le réseau pourrait exécuter du code sur ma machine.

### Comparaison avec la consigne

<details>
<summary>Différences entre mon compose et celui donné dans le sujet</summary>

```diff
  services:
    jupyter:
      image: quay.io/jupyter/datascience-notebook:python-3.12
      ports:
        - "8888:8888"
+     user: root
      volumes:
        - jupyter_notebooks:/home/jovyan/work
        - jupyter_data:/home/jovyan/.local
+       - ../datasets:/home/jovyan/datasets:ro
+       - ../examples:/home/jovyan/examples:ro
      environment:
-       - JUPYTER_TOKEN=monmotdepasse
+       - JUPYTER_TOKEN=${JUPYTER_TOKEN:-monmotdepasse}
+       - CHOWN_EXTRA=/home/jovyan/.local,/home/jovyan/work
+       - CHOWN_EXTRA_OPTS=-R
```

- Le compose du sujet tel quel ne démarrait pas chez moi (erreur de permission sur `.local`), d'où `user: root` et `CHOWN_EXTRA`.
- J'ai ajouté les deux dossiers du dépôt en lecture seule.
- Le token peut être changé avec un fichier `.env` sans toucher au compose.

</details>

### Ce que j'ai appris

- Un volume nommé peut appartenir à `root` et bloquer une application qui tourne avec un autre utilisateur.
- Lire les logs (`docker compose logs`) quand un conteneur s'arrête tout seul.
- `:ro` pour monter un dossier en lecture seule.
- Ce qui n'est pas dans un volume est perdu : il faut savoir **où** l'application écrit (ici `pip install` vs `pip install --user`).

### Docs

- [Jupyter Docker Stacks](https://jupyter-docker-stacks.readthedocs.io/en/latest/)
- [Options de l'image (`CHOWN_EXTRA`, `user: root`)](https://jupyter-docker-stacks.readthedocs.io/en/latest/using/common.html)
- [Choisir une image Jupyter](https://jupyter-docker-stacks.readthedocs.io/en/latest/using/selecting.html)
- [Volumes Docker](https://docs.docker.com/engine/storage/volumes/)
- [Bind mounts et option `ro`](https://docs.docker.com/engine/storage/bind-mounts/)
- [Datasets Kaggle](https://www.kaggle.com/datasets)
