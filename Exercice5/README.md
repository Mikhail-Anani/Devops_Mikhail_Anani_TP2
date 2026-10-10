# Apprentissages

## Exercice 5 – Déployer une application YunoHost : WordPress

J'ai pris [WordPress](https://apps.yunohost.org/app/wordpress) dans le catalogue YunoHost et j'ai écrit un `docker-compose.yaml` pour le lancer en local.

### Ce dont WordPress a besoin

| Besoin | Dans mon compose |
|---|---|
| Serveur web + PHP | image `wordpress:6-apache` |
| Base de données | service `db` avec `mariadb:11` |
| Garder les fichiers (thèmes, plugins, images) | volume `wp_data` |
| Garder la base | volume `db_data` |
| Port | `8080:80` |
| Identifiants de la base | variables d'environnement (`.env`) |

### Commandes utilisées

```bash
docker compose up -d
docker compose ps
docker compose logs -f wordpress
docker volume ls --filter name=exercice5
docker compose down          # garde les volumes
docker compose down -v       # efface tout
```

### Avant / après

Avant, rien ne répond sur le port 8080 :

```
$ curl -I localhost:8080
curl: (7) Failed to connect to localhost port 8080
```

Après `docker compose up -d` :

```
$ docker compose ps
SERVICE     IMAGE                STATUS                    PORTS
db          mariadb:11           Up 28 seconds (healthy)   3306/tcp
wordpress   wordpress:6-apache   Up 7 seconds              0.0.0.0:8080->80/tcp
```

Sur http://localhost:8080 j'arrive sur la page d'installation de WordPress.

Test de la persistance :

```
$ docker compose down
$ docker volume ls --filter name=exercice5
exercice5_db_data
exercice5_wp_data

$ docker compose up -d
```

Les 2 volumes sont toujours là après le `down`. Au premier lancement les logs affichent `WordPress not found in /var/www/html - copying now...`, au deuxième ce message n'apparaît plus : WordPress reprend ses fichiers dans le volume.

| | Avant | Après |
|---|---|---|
| `localhost:8080` | rien | WordPress |
| Conteneurs | aucun | `wordpress` + `db` |
| Après `down` / `up` | – | données gardées |

### Problème rencontré et pourquoi il est survenu

- **Il faut 2 volumes** : WordPress range ses données à deux endroits, la base (articles, comptes) et le disque (images, plugins). Avec un seul volume on perd la moitié.
- **MariaDB est lente à démarrer la première fois** (une vingtaine de secondes dans `docker compose ps` avant de passer `healthy`). Avec un `depends_on` simple comme à l'exo 2, WordPress serait lancé avant que la base réponde.


### Solution appliquée et pourquoi cette solution fonctionne

- **Deux volumes nommés**, `wp_data` et `db_data`.
- **`healthcheck`** sur la base + **`condition: service_healthy`** : Docker teste la base toutes les 5 s et ne lance WordPress que quand elle répond.

### Comparaison avec YunoHost

<details>
<summary>Différences entre mon compose et l'installation YunoHost</summary>

```diff
- YunoHost : HTTPS automatique, installation en 1 clic, sauvegardes
+ Mon compose : HTTP sur localhost:8080, base MariaDB dans son propre conteneur
```

- **Mieux** : isolé de ma machine, marche partout où il y a Docker, se supprime proprement avec `down -v`.
- **Moins bien** : pas de HTTPS ni de sauvegardes, c'est seulement pour du local.

</details>

### Ce que j'ai appris

- Regarder ce dont une application a besoin avant de la déployer (services, ports, données).
- `healthcheck` + `service_healthy` pour attendre qu'un service soit vraiment prêt.
- Les variables `${VAR:-défaut}` et le fichier `.env`.
- On peut déployer une appli complète sans écrire de Dockerfile, avec des images officielles.

### Docs

- [WordPress sur YunoHost](https://apps.yunohost.org/app/wordpress)
- [Image WordPress](https://hub.docker.com/_/wordpress)
- [Image MariaDB](https://hub.docker.com/_/mariadb)
- [`healthcheck` dans Compose](https://docs.docker.com/reference/compose-file/services/#healthcheck)
- [Ordre de démarrage dans Compose](https://docs.docker.com/compose/how-tos/startup-order/)
- [Fichier `.env` dans Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
