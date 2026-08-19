# emc-cyberviolence-lms
Plateforme de formation à distance des professionnels dans la lutte contre les cyberviolences

[![CI](https://github.com/itsmeefatiha/emc-cyberviolence-lms/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmeefatiha/emc-cyberviolence-lms/actions/workflows/ci.yml)

## Lancer avec Docker

Prérequis : Docker Desktop (ou Docker Engine + Compose).

```bash
docker compose up --build
```

L’application est disponible sur [http://localhost:8080](http://localhost:8080).

- Frontend (React) : `http://localhost:8080`
- API / Swagger : `http://localhost:8080/api/docs/`
- Admin Django : `http://localhost:8080/admin/`

Compte administrateur créé au premier démarrage :

- e-mail : `admin@emc.local`
- mot de passe : `AdminPass123!`

Les variables se surchargent via un fichier `.env` à la racine (voir `.env.example`).

Arrêt :

```bash
docker compose down
```

Les données Postgres, médias et fichiers statiques sont conservés dans des volumes Docker. Pour tout réinitialiser : `docker compose down -v`.
