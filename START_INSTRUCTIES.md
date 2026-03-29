# 🏙️ Stadsspel - Installatie & Start Instructies

## 🚀 Snel Starten

### Eerste Keer Setup

1. **Installeer vereisten** (éénmalig):
   - Docker Desktop (voor de database)
   - Python 3.11+ met Poetry
   - Node.js 18+ met npm

2. **Start de applicatie**:
   ```powershell
   cd c:\Users\MarkC\stadsspel
   .\start.ps1
   ```

Dat is alles! Het script doet automatisch:
- ✅ Start PostgreSQL database in Docker
- ✅ Voert database migraties uit
- ✅ Vult database met Amsterdam + 9 wijken + opdrachten
- ✅ Maakt admin account aan
- ✅ Start backend server (port 8000)
- ✅ Start frontend server (port 3000)

## 🔐 Admin Inloggen

Nadat de app is gestart:

1. Open browser: `http://localhost:3000`
2. Login met:
   - **Username**: `admin`
   - **Password**: `admin`

## 🎮 Spel Starten

### Stap 1: Maak een Spel Sessie
1. Login als admin
2. Selecteer stad: **Amsterdam**
3. Kies speelduur (bijv. 60 minuten)
4. Klik **"🎮 Maak Spel Aan"**

### Stap 2: Nodig Teams Uit
1. Kopieer de join link (bijv. `http://localhost:3000/join/ABC123`)
2. Deel deze link met deelnemende teams
3. Teams registreren zich via de link
4. Je ziet teams verschijnen in het admin panel

### Stap 3: Start het Spel
1. Wacht tot alle teams zijn aangemeld
2. Klik **"🚀 Start Spel Nu"**
3. Teams worden automatisch doorgestuurd naar het speelveld

## 🛑 Stoppen

Om de applicatie te stoppen:

**Optie 1**: Druk `Ctrl+C` in het PowerShell venster

**Optie 2**: Draai het stop script:
```powershell
.\stop.ps1
```

## 📁 Project Structuur

```
stadsspel/
├── start.ps1                    # 🚀 Hoofdstart script
├── stop.ps1                     # 🛑 Stop script
├── backend/                     # Python FastAPI backend
│   ├── app/
│   │   ├── api/                # API endpoints
│   │   ├── db/                 # Database models
│   │   ├── seeds/
│   │   │   └── seed_cities_only.py  # Seed script (alleen steden)
│   │   └── ...
│   └── alembic/                # Database migraties
├── frontend-react/              # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/              # React paginas
│   │   ├── services/           # API client
│   │   └── ...
│   └── ...
└── infra/
    └── docker-compose.yml      # PostgreSQL + PostGIS
```

## 🗺️ Database Inhoud

Na het starten bevat de database:

### Stad: Amsterdam
Met 9 wijken:
1. **Centrum** - Foto bij Centraal Station
2. **Noord** - Selfie bij Eye Filmmuseum
3. **Oost** - Kramen tellen op Dappermarkt
4. **Zuid** - Groepsfoto bij Museumplein
5. **West** - Foto van Jordaans pand
6. **Nieuw-West** - Selfie bij Sloterplas
7. **Zuidoost** - Foto van de ArenA
8. **De Pijp** - Fruit tellen op Albert Cuypmarkt
9. **Westerpark** - Foto in het park

Elke wijk heeft een unieke opdracht die teams moeten voltooien.

## 🔧 Troubleshooting

### Database start niet
```powershell
cd infra
docker compose down -v
docker compose up -d
```

### Backend errors
Check of database draait:
```powershell
docker ps
```

### Frontend niet bereikbaar
Check of npm beschikbaar is:
```powershell
npm --version
```

### Reset alles
```powershell
# Stop alles
.\stop.ps1

# Verwijder database volumes
cd infra
docker compose down -v

# Start opnieuw
cd ..
.\start.ps1
```

## 🎯 Workflow Overzicht

```
1. Admin start applicatie met start.ps1
                ↓
2. Admin login (admin/admin)
                ↓
3. Admin maakt spel aan → krijgt join link
                ↓
4. Admin deelt join link met teams
                ↓
5. Teams registreren via join link
                ↓
6. Teams zien wachtscherm
                ↓
7. Admin ziet teams in overzicht
                ↓
8. Admin klikt "Start Spel Nu"
                ↓
9. Teams worden doorgestuurd naar speelveld
                ↓
10. Teams voltooien opdrachten
                ↓
11. Admin keurt inzendingen goed/af
                ↓
12. Gebieden worden veroverd
                ↓
13. Na speeltijd: leaderboard met winnaar
```

## 📞 URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Database**: localhost:5432 (PostgreSQL)

## ✨ Features

- ✅ Sessie-gebaseerd spel systeem
- ✅ Real-time team monitoring
- ✅ Automatische kleur toewijzing
- ✅ Wachtscherm voor teams
- ✅ Live kaart met gebieden
- ✅ Foto upload voor opdrachten
- ✅ Admin review systeem
- ✅ Leaderboard
- ✅ Gebied verovering

Veel plezier met het Stadsspel! 🎉
