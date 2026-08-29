# emc-cyberviolence-lms

Plateforme de formation à distance des professionnels dans la lutte contre les cyberviolences.

[![CI](https://github.com/itsmeefatiha/emc-cyberviolence-lms/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmeefatiha/emc-cyberviolence-lms/actions/workflows/ci.yml)

## Sommaire

- [Prérequis](#prérequis)
- [Structure du projet](#structure-du-projet)
- [Lancer avec Docker](#lancer-avec-docker)
- [Développement local (sans Docker)](#développement-local-sans-docker)
- [Comptes et données de test](#comptes-et-données-de-test)
- [Exécuter les tests](#exécuter-les-tests)
- [Variables d'environnement](#variables-denvironnement)

## Prérequis

| Outil | Version recommandée |
|---|---|
| Python | 3.12 |
| Node.js | 20 |
| PostgreSQL | 16 |
| Docker (optionnel) | Docker Desktop ou Docker Engine + Compose |

## Structure du projet

```
emc-cyberviolence-lms/
├── backend/          # API Django REST (users, courses, quizzes, progression…)
├── frontend/         # Interface React (Vite + Tailwind)
├── e2e/              # Tests End-to-End Playwright
├── nft/              # Tests non fonctionnels (Locust, Lighthouse, Bandit)
└── docker-compose.yml
```

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

## Développement local (sans Docker)

### 1. Base de données PostgreSQL

Créez une base locale (exemple) :

```sql
CREATE DATABASE emc_lms_db;
CREATE USER emc WITH PASSWORD 'emc_secret';
GRANT ALL PRIVILEGES ON DATABASE emc_lms_db TO emc;
```

### 2. Backend (Django)

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
```

Copiez la configuration :

```bash
cp .env.example .env
```

Adaptez au minimum `POSTGRES_*` et `DJANGO_SECRET_KEY` dans `backend/.env`.

Puis :

```bash
python manage.py migrate
python manage.py createsuperuser   # optionnel en dev
python manage.py runserver
```

L’API tourne sur [http://localhost:8000](http://localhost:8000) :

- Swagger : [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- Admin : [http://localhost:8000/admin/](http://localhost:8000/admin/)

### 3. Frontend (React + Vite)

Dans un second terminal :

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

L’interface est disponible sur [http://localhost:5173](http://localhost:5173).

Le proxy Vite redirige `/api` et `/media` vers Django (`http://127.0.0.1:8000`). Vous pouvez laisser `VITE_API_BASE_URL=http://localhost:8000/api` ou utiliser `/api` pour passer par le proxy.

## Comptes et données de test

### Seed E2E (recommandé pour tests manuels et Playwright)

```bash
cd backend
python manage.py seed_e2e
```

Crée notamment :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Apprenant | `e2e.apprenant@example.com` | `E2ePass123!` |
| Formateur | `e2e.formateur@example.com` | `E2ePass123!` |
| Admin | `e2e.admin@example.com` | `E2ePass123!` |

Et un parcours publié : **E2E — Cyberviolence : parcours de démonstration**.

## Exécuter les tests

La CI GitHub Actions (`.github/workflows/ci.yml`) enchaîne : lint + tests backend, lint + tests frontend, E2E Playwright, puis tests de performance Locust.

### Backend

Prérequis : PostgreSQL accessible avec les variables `POSTGRES_*` (voir `backend/.env`).

```bash
cd backend
source venv/bin/activate   # ou .\venv\Scripts\Activate.ps1

# Lint
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics --exclude=migrations,venv,.venv,__pycache__

# Tous les tests + couverture
pytest --cov-report=term-missing

# Tests unitaires (apps)
pytest apps/ -v --no-cov

# Tests d'intégration
pytest tests/integration/ -v --no-cov
```

### Frontend

```bash
cd frontend
npm install

# Lint
npm run lint

# Tous les tests
npm test

# Avec couverture
npm run test:coverage

# Tests d'intégration uniquement
npm run test:integration

# Mode watch (développement)
npm run test:watch
```

### Tests End-to-End (Playwright)

Prérequis : backend migré + `python manage.py seed_e2e` (fait automatiquement par le `globalSetup` Playwright).

```bash
cd e2e
npm install
npx playwright install chromium

# Lance Django + Vite automatiquement si non déjà démarrés
npm test

# Interface graphique
npm run test:ui

# Navigateur visible
npm run test:headed
```

Rapport HTML : `e2e/playwright-report/index.html`.

### Tests non fonctionnels

**Sécurité (Bandit)** — depuis `backend/` :

```bash
pip install bandit==1.8.6
bandit -c ../nft/bandit.yaml -r apps --severity-level medium
```

**Performance (Locust)** — API Django démarrée + `seed_e2e` :

```bash
pip install -r nft/requirements.txt
cd nft
locust -f locustfile.py --host http://127.0.0.1:8000
```

**Accessibilité (Lighthouse CI)** — build frontend requis :

```bash
cd frontend && npm run build
cd ../nft && npm install && npm run lighthouse
```

## Variables d'environnement

| Fichier | Usage |
|---|---|
| `.env.example` | Variables Docker Compose (racine) |
| `backend/.env.example` | Configuration Django / PostgreSQL |
| `frontend/.env.example` | URL de l’API (`VITE_API_BASE_URL`) |

Principales variables backend :

- `DJANGO_SECRET_KEY` — clé secrète Django
- `DEBUG` — mode debug (`True` en dev)
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `EMAIL_BACKEND` — en dev : `django.core.mail.backends.console.EmailBackend`
- `CORS_ALLOWED_ORIGINS` — origines autorisées (ex. `http://localhost:5173`)
