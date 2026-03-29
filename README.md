# 🏙️ Stadsspel - Mobile-First City Game PWA

Een herbruikbare, mobile-first webapp/PWA voor stadsspellen met realtime kaart updates, offline support, admin goedkeuring workflow en spel-timer.

## ✨ Features

### Core Gameplay
- **Één actief spel** tegelijk met configureerbare duur (X uur)
- **In-app timer** - teams zien resterende tijd, automatische stop bij 00:00
- **Kaart met gebieden** - PostGIS polygons met GeoJSON rendering
- **Twee win-modes per opdracht**:
  - `LAST_APPROVED_WINS` - laatst goedgekeurde team bezit het gebied
  - `HIGHEST_SCORE_WINS` - hoogste score wint (zichtbaar op kaart)
- **Cooldown systeem** - 15 minuten per team per gebied (configureerbaar)
- **Realtime updates** - kaart en leaderboard via polling (5s interval)

### Teams & Auth
- **Open registratie** met teamnaam + wachtwoord + teamkleur
- **JWT authenticatie** - meerdere apparaten per team toegestaan
- **Leaderboard** gerangschikt op aantal bezette gebieden

### Submissions
- **Tekst verplicht** + optionele foto's/video's
- **Score** indien vereist door challenge mode
- **Status tracking**: Pending → Approved/Rejected
- **Eigen inzendingen** altijd zichtbaar, anderen pas na publicatie

### Admin
- **Max 3 admins** (kunnen ook meespelen via apart team-account)
- **Approve/reject** workflow met optionele feedback
- **In-app notificaties** - pending teller
- **ZIP export** na afloop (metadata + submissions)
- **Game controls** - start game, publish results

### Offline-First
- **Service Worker** + **IndexedDB** queue
- **Offline kaart** bekijken (laatste bekende staat)
- **Offline submit** - lokaal queue + autosync bij online
- **Cache-first** voor static assets

### PWA
- **Installeerbaar** op mobiel
- **Standalone mode**
- **Responsive design** - mobile-first

---

## 🏗️ Technische Stack

### Backend
- **FastAPI** - Python async web framework
- **PostgreSQL + PostGIS** - database met geo-extensies
- **SQLAlchemy 2.0** - ORM
- **Alembic** - database migraties
- **JWT** - authenticatie via python-jose
- **Poetry** - dependency management

### Frontend
- **Vanilla JavaScript** (ES6 modules)
- **Leaflet** - interactive map library
- **Service Worker** - offline caching
- **IndexedDB** - offline submission queue
- **PWA** - Progressive Web App

### Storage
- **Lokaal** (development) - filesystem in `./media`
- **S3-compatible** (production) - Cloudflare R2 of AWS S3

---

## 🚀 Quick Start

### Vereisten
- **Python 3.11+**
- **PostgreSQL 14+** met PostGIS extensie
- **Poetry** - [installatie instructies](https://python-poetry.org/docs/#installation)
- **Node.js** (optioneel, voor frontend development server)

### 1. Clone Repository

```powershell
git clone <repository-url>
cd stadsspel
```

### 2. Backend Setup

#### a. Installeer Docker Desktop (Eenmalig)

Als Docker nog niet geïnstalleerd is op je systeem:

1. **Download Docker Desktop voor Windows:**
   - Ga naar: https://www.docker.com/products/docker-desktop/
   - Download de Windows installer
   - Alternatief: `winget install Docker.DockerDesktop`

2. **Installeer Docker Desktop:**
   - Voer de installer uit
   - Volg de installatie wizard
   - Kies "Use WSL 2 instead of Hyper-V" (aanbevolen)
   - Herstart je computer indien gevraagd

3. **Start Docker Desktop:**
   - Open Docker Desktop vanuit het Start menu
   - Wacht tot Docker volledig opgestart is (groen icoontje in systray)
   - Accepteer eventuele licentievoorwaarden

4. **Verifieer installatie:**
   ```powershell
   docker --version
   docker compose version
   ```
   
   **Verwachte output:**
   ```
   Docker version 24.0.x, build xxxxx
   Docker Compose version v2.x.x
   ```

#### b. Start PostgreSQL met PostGIS (Docker)

```powershell
cd infra
docker compose up -d
```

**Eerste keer opstarten duurt ~30-60 seconden** (image wordt gedownload)

Dit start PostgreSQL op `localhost:5432` met:
- User: `stadsspel`
- Password: `stadsspel_dev_password`
- Database: `stadsspel`
- PostGIS extensie: geactiveerd

**Verifieer dat database draait:**
```powershell
docker ps
```

Je zou moeten zien:
```
CONTAINER ID   IMAGE                    STATUS         PORTS
xxxxx          postgis/postgis:16-3.4   Up X seconds   0.0.0.0:5432->5432/tcp
```

**Handige Docker commando's:**
```powershell
# Stop database
docker compose down

# Stop en verwijder data (clean slate)
docker compose down -v

# Bekijk logs
docker compose logs -f postgres

# Restart database
docker compose restart
```

#### c. Configureer Environment

**Let op:** `.env` moet in de `backend/` folder staan, niet in de root!

```powershell
# Vanaf project root
Copy-Item .env.example backend\.env
```

Of handmatig:
1. Kopieer `.env.example` naar `backend/.env`
2. Bewerk indien nodig (standaard waarden werken voor lokaal dev)

**Belangrijke variabelen:**
```env
DATABASE_URL=postgresql://stadsspel:stadsspel_dev_password@localhost:5432/stadsspel
SECRET_KEY=your-secret-key-change-this-in-production-min-32-chars
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://localhost:8000
MEDIA_STORAGE_TYPE=local
MEDIA_LOCAL_PATH=./media
```

> **Security note:** Verander `SECRET_KEY` in productie naar een random 32+ character string!

#### d. Installeer Dependencies met Poetry

**Installeer Poetry** (indien nog niet geïnstalleerd):
```powershell
# Optie 1: Via pip
pip install poetry

# Optie 2: Via official installer
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -

# Verifieer installatie
poetry --version
```

**Installeer project dependencies:**
```powershell
cd backend
poetry install
```

Dit:
- Creëert een virtual environment in `.venv/`
- Installeert alle packages uit `pyproject.toml`
- Duurt ~2-5 minuten bij eerste keer

#### e. Run Database Migraties

**Wacht tot PostgreSQL volledig opgestart is** (~10-30 seconden na `docker compose up`), run dan:

```powershell
# Zorg dat je in backend/ folder zit
cd backend
poetry run alembic upgrade head
```

**Verwachte output:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial, Initial schema with PostGIS support
```

Dit creëert alle database tabellen (teams, games, areas, submissions, etc.)

**⚠️ Known Issue - GeoAlchemy2 Index Conflict:**

Als je een error krijgt over `idx_areas_geom already exists`, is dit omdat GeoAlchemy2 automatisch GIST indexes aanmaakt voor Geometry columns. Dit is al gefixed in de migratie file, maar als je een oude versie hebt:

```powershell
# Reset database als nodig
cd ..
cd infra
docker compose down -v
docker compose up -d
# Wacht 30 seconden
cd ..
cd backend
poetry run alembic upgrade head
```

**Troubleshooting:**
- **"Connection refused"**: Database draait niet → check `docker ps`
- **"alembic.util.exc.CommandError"**: Verkeerde folder → `cd backend`
- **PostGIS error**: Database niet klaar → wacht 10 sec en probeer opnieuw
- **Duplicate index error**: Zie "Known Issue" hierboven

#### f. Seed Demo Data (Optioneel maar aanbevolen)

Creëert demo stad met 9 gebieden, challenges en 5 teams + 1 admin:

```powershell
poetry run python -m app.seeds.seed_demo_city
```

**Verwachte output:**
```
INFO: Starting seed process...
INFO: Created city: Demo City
INFO: Created area: Centrum with challenge: Foto van een fontein
INFO: Created area: Noord with challenge: Hoogste gebouw
... (7 more areas)
INFO: Created team: Team Rood
INFO: Created team: Team Blauw
INFO: Created team: Admin Team
INFO: Seed process completed successfully
```

**⚠️ Known Issue - Bcrypt Compatibility:**

Als je een error krijgt over `password cannot be longer than 72 bytes`, is dit een compatibility issue tussen passlib en bcrypt 5.x. Dit is al gefixed door direct bcrypt te gebruiken in plaats van passlib.

Als de seed faalt bij het maken van teams, kun je ze handmatig toevoegen:

```powershell
poetry run python -c "from app.db.session import SessionLocal; from app.db.models import Team; from app.core.security import get_password_hash; from datetime import datetime; db = SessionLocal(); teams = [{'name': 'Team Rood', 'color': '#FF0000', 'is_admin': False}, {'name': 'Team Blauw', 'color': '#0000FF', 'is_admin': False}, {'name': 'Admin Team', 'color': '#000000', 'is_admin': True}]; [db.add(Team(name=t['name'], password_hash=get_password_hash('password123'), color=t['color'], is_admin=t['is_admin'], created_at=datetime.utcnow())) for t in teams]; db.commit(); print('Teams created!')"
```

**Demo teams** (allemaal wachtwoord: `password123`):
- **Team Rood** (kleur: #FF0000)
- **Team Blauw** (kleur: #0000FF)
- **Team Groen** (kleur: #00FF00)
- **Team Geel** (kleur: #FFFF00)
- **Team Paars** (kleur: #800080)
- **Admin Team** (is_admin=True) - kan spel beheren

**Demo areas** (grid rond Amsterdam):
- Centrum, Noord, Zuid, Oost, West, Noordoost, Noordwest, Zuidoost, Zuidwest

**Challenge modes** (afwisselend):
- `LAST_APPROVED_WINS`: Laatst goedgekeurde team wint
- `HIGHEST_SCORE_WINS`: Hoogste score wint (0-100 punten)

#### g. Start Backend Server

```powershell
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verwachte output:**
```
INFO:     Will watch for changes in these directories: ['C:\\...\\stadsspel']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Server draait nu op:** `http://0.0.0.0:8000`

**API is bereikbaar op:**
- API Docs: http://localhost:8000/docs (Swagger UI)
- ReDoc: http://localhost:8000/redoc
- API Root: http://localhost:8000/api

**Frontend is bereikbaar op:**
- Main App: http://localhost:8000/ of http://localhost:8000/index.html
- Admin Panel: http://localhost:8000/admin.html

**Server blijft draaien** - gebruik een nieuwe terminal voor andere commando's

**Stop server:** `Ctrl+C` in terminal

**🎉 De applicatie is nu LIVE!**

---

### 3. Open de Applicatie

De frontend wordt automatisch geserveerd door de FastAPI backend.

**Geen extra stappen nodig!** De frontend is al beschikbaar.

✅ **Voordelen van deze setup:**
- Geen aparte frontend server nodig
- Geen CORS configuratie nodig
- Media uploads werken direct
- Service Worker werkt correct

---

### 4. Test de Applicatie

#### Voor Spelers:

**Open in browser:** http://localhost:8000/

1. **Registreer nieuw team:**
   - Klik "Registreren"
   - Kies unieke teamnaam
   - Kies wachtwoord (min. 6 tekens)
   - Selecteer teamkleur
   
2. **Of login met demo team:**
   - Teamnaam: `Team Rood` / `Team Blauw` / etc.
   - Wachtwoord: `password123`

3. **Verken de app:**
   - **Kaart tab:** Zie gebieden, klik erop
   - **Stand tab:** Bekijk leaderboard
   - **Mijn tab:** Zie je eigen inzendingen
   - **Profiel tab:** Team info, uitloggen

#### Voor Admin:

**Open:** http://localhost:8000/admin.html

**Login:**
- Teamnaam: `Admin Team`
- Wachtwoord: `password123`

**Admin acties:**
- Start een nieuw spel (stel duur in)
- Bekijk pending submissions
- Approve/reject inzendingen
- Bekijk team statistieken
- Export game data (ZIP)

---

## 🔧 Troubleshooting

### Database Errors

**"Connection refused" / "Cannot connect to database"**
```powershell
# Check of Docker draait
docker ps

# Als container niet bestaat
cd infra
docker compose up -d

# Wacht 30 seconden, probeer opnieuw
poetry run alembic upgrade head
```

**"Database does not exist"**
```powershell
# Container herstarten
cd infra
docker compose down
docker compose up -d
```

### Backend Errors

**"ModuleNotFoundError: No module named 'app'"**
```powershell
# Zorg dat je in backend/ folder zit
cd backend

# Of gebruik volledige path
cd c:\Users\MarkC\stadsspel\backend
```

**"Port 8000 already in use"**
```powershell
# Stop bestaande server met Ctrl+C
# Of kies andere port
poetry run uvicorn app.main:app --reload --port 8001
```

### Frontend Errors

**CORS Errors in browser console**
```powershell
# Voeg je frontend URL toe aan CORS_ORIGINS in backend/.env
CORS_ORIGINS=http://localhost:8000,http://localhost:8080,http://127.0.0.1:5500
```

**Service Worker niet geregistreerd**
- Open in HTTPS of localhost (niet IP adres)
- Check DevTools → Application → Service Workers
- Hard refresh: `Ctrl+Shift+R`

### Docker Issues

**Docker Desktop niet opgestart**
- Open Docker Desktop vanuit Start menu
- Wacht tot groen icoontje in systray

**WSL 2 fout**
- Installeer: https://aka.ms/wsl2kernel
- Herstart computer

**"Cannot connect to Docker daemon"**
- Herstart Docker Desktop
- Of herstart computer
php -S localhost:8080
```

### 4. Open App

Navigeer naar **http://localhost:8080**

1. **Registreer** een nieuw team of **login** met demo teams
2. Zie de kaart met gebieden
3. Klik op een gebied → bekijk opdracht → dien in

**Admin login:**
- Teamnaam: `Admin Team`
- Wachtwoord: `password123`
- Klik "Admin Panel" in profiel tab

---

## 📁 Project Structuur

```
stadsspel/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints (routers)
│   │   ├── core/          # Config, security, logging
│   │   ├── db/            # Database models en session
│   │   ├── services/      # Business logic (ownership, cooldown, storage, export)
│   │   ├── seeds/         # Seed scripts
│   │   └── main.py        # FastAPI app
│   ├── alembic/           # Database migraties
│   ├── alembic.ini
│   └── pyproject.toml     # Poetry dependencies
├── frontend/
│   ├── css/
│   ├── js/                # Modules: api, auth, map, leaderboard, timer, offline_queue, admin
│   ├── index.html         # Main app
│   ├── admin.html         # Admin panel
│   ├── manifest.json      # PWA manifest
│   └── service-worker.js  # Offline support
├── infra/
│   └── docker-compose.yml # PostgreSQL + PostGIS
├── .env.example
├── .gitignore
└── README.md
```

---

## 🎮 Gebruik

### Als Team

1. **Registreer** met unieke teamnaam en kies kleur
2. **Bekijk kaart** - zie gebieden en huidige eigenaren
3. **Klik gebied** → zie opdracht details
4. **Dien in** met tekst + optioneel foto/video + score
5. **Wacht op goedkeuring** - zie status in "Mijn" tab
6. **Volg leaderboard** - zie ranking op basis van gebieden

### Als Admin

1. **Login** met admin account
2. **Start spel** - stel duur in (bijv. 120 minuten)
3. **Bekijk pending** - lijst van te beoordelen inzendingen
4. **Approve/reject** - met optionele feedback
5. **Publiceer resultaten** - na afloop, maakt alles zichtbaar
6. **Export ZIP** - download alle data

---

## 🔧 Configuratie

### Environment Variables (.env)

| Variabele | Omschrijving | Default |
|-----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `SECRET_KEY` | JWT secret (min 32 chars) | - |
| `CORS_ORIGINS` | Comma-separated frontend URLs | `http://localhost:8080` |
| `DEFAULT_COOLDOWN_MINUTES` | Cooldown periode per gebied | `15` |
| `MAX_ADMINS` | Max aantal admins | `3` |
| `MEDIA_STORAGE_TYPE` | `local` of `s3` | `local` |
| `MEDIA_LOCAL_PATH` | Lokale media opslag pad | `./media` |
| `S3_ENDPOINT_URL` | S3/R2 endpoint (production) | - |
| `S3_BUCKET_NAME` | S3 bucket naam | - |

### Database Migraties

Nieuwe migratie aanmaken:

```powershell
poetry run alembic revision --autogenerate -m "description"
```

Migraties toepassen:

```powershell
poetry run alembic upgrade head
```

Rollback:

```powershell
poetry run alembic downgrade -1
```

---

## 🌐 Deployment

### Backend (Productie)

#### 1. Hosting Opties
- **Fly.io** (gratis tier, PostgreSQL add-on)
- **Railway** (gratis tier)
- **Render** (gratis PostgreSQL)
- **VPS** (DigitalOcean, Hetzner)

#### 2. Environment Setup
```bash
# Genereer veilige SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Zet productie environment variabelen
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=<generated-key>
CORS_ORIGINS=https://jouw-frontend-domein.com
MEDIA_STORAGE_TYPE=s3
S3_ENDPOINT_URL=https://your-account.r2.cloudflarestorage.com
S3_BUCKET_NAME=stadsspel-media
```

#### 3. Run Migraties
```bash
poetry run alembic upgrade head
poetry run python -m app.seeds.seed_demo_city
```

#### 4. Start met Gunicorn
```bash
poetry add gunicorn
poetry run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend (Productie)

#### Hosting Opties
- **Vercel** (gratis, eenvoudig)
- **Netlify** (gratis)
- **Cloudflare Pages** (gratis)
- **GitHub Pages**

#### Deployment Stappen
1. Upload `frontend/` folder naar hosting
2. Configureer redirect rules (SPA):
   ```
   /* /index.html 200
   ```
3. Update `API_BASE_URL` in `frontend/js/api.js`:
   ```javascript
   const API_BASE_URL = 'https://jouw-backend-domein.com';
   ```

### Media Storage (Cloudflare R2)

Voordelen: gratis 10GB storage, geen egress kosten.

1. Maak R2 bucket aan in Cloudflare dashboard
2. Genereer API token
3. Zet environment variabelen:
   ```env
   MEDIA_STORAGE_TYPE=s3
   S3_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=<key>
   S3_SECRET_ACCESS_KEY=<secret>
   S3_BUCKET_NAME=stadsspel-media
   ```

**Note:** Voor R2 moet je `boto3` installeren:
```bash
poetry add boto3
```

---

## 📊 Database Schema

### Belangrijkste Tabellen

- **games** - actieve spel instances
- **cities** - steden/locaties
- **areas** - geografische gebieden (PostGIS polygons)
- **challenges** - opdrachten per gebied (1:1)
- **teams** - team accounts (incl. admins)
- **submissions** - inzendingen van teams
- **submission_media** - foto's/video's bij inzendingen
- **approvals** - admin beslissingen
- **territory_ownership** - huidige eigenaar per gebied (materialized)

### Ownership Logic

Bij approve:
1. Submission status → `APPROVED`
2. Ownership update via `update_ownership()` service:
   - **LAST_APPROVED_WINS**: direct assign team
   - **HIGHEST_SCORE_WINS**: vergelijk scores, assign als hoger
3. Transaction-safe met `with_for_update()` locking

---

## 🧪 Testing

### Manual Testing

1. Start backend + frontend
2. Registreer meerdere teams
3. Login als admin → start spel
4. Login als team → dien inzendingen in
5. Login als admin → approve/reject
6. Bekijk realtime updates op kaart + leaderboard
7. Test offline mode (Chrome DevTools → Network → Offline)
8. Test cooldown (probeer 2x snel in te zenden)
9. Laat timer aflopen → test 00:00 behavior
10. Publish results → test zichtbaarheid

### Automated Testing (TODO)

```powershell
poetry add --group dev pytest pytest-asyncio httpx
poetry run pytest
```

---

## 🐛 Troubleshooting

### Backend start niet

**PostGIS extensie fout:**
```sql
-- Handmatig toevoegen in psql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Alembic migratie fout:**
```powershell
# Check huidige versie
poetry run alembic current

# Force stamp naar HEAD
poetry run alembic stamp head
```

### CORS errors

Check `.env`:
```env
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

Herstart backend na wijziging.

### Media uploads falen

Check permissions op `./media` folder:
```powershell
mkdir media
# Zorg dat backend user write permissions heeft
```

### Service Worker update niet

Hard refresh: `Ctrl+Shift+R` (Chrome) of clear cache.

---

## 🔮 Toekomstige Features (V2)

- [ ] **WebSockets** voor realtime updates (ipv polling)
- [ ] **GPS hints** - optioneel gebied centrumpunt check
- [ ] **Push notifications** - voor admin bij nieuwe inzendingen
- [ ] **Multi-game support** - historie van oude spellen
- [ ] **Team chat** - berichten tussen teamleden
- [ ] **Custom map tiles** - eigen stijl of offline tiles
- [ ] **Advanced analytics** - grafieken en statistieken
- [ ] **Import/export** gebieden via GeoJSON upload

---

## 🤝 Contributing

Contributions welkom! Open een issue of pull request.

### Development Workflow

1. Fork repository
2. Maak feature branch: `git checkout -b feature/nieuwe-feature`
3. Commit changes: `git commit -m 'Add nieuwe feature'`
4. Push naar branch: `git push origin feature/nieuwe-feature`
5. Open Pull Request

### Code Style

- **Backend**: Black formatter (line length 100)
- **Frontend**: 2 spaces indentation, ES6+

Formatteer code:
```powershell
poetry run black backend/app
```

---

## 📄 License

MIT License - vrij te gebruiken voor eigen projecten.

---

## 👥 Credits

Gebouwd met ❤️ voor stadsspellen en teambuilding events.

**Libraries:**
- [FastAPI](https://fastapi.tiangolo.com/)
- [Leaflet](https://leafletjs.com/)
- [PostGIS](https://postgis.net/)
- [SQLAlchemy](https://www.sqlalchemy.org/)

---

## 📞 Support

Voor vragen of hulp:
- Open een GitHub issue
- Check API docs: http://localhost:8000/docs

---

**Happy Gaming! 🎮🏙️**
