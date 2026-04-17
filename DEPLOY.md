# 🚀 Stadsspel Deployen - Stap voor Stap

## Wat je nodig hebt
- Een creditcard/betaalkaart (voor server + domein)
- ~30 minuten tijd

## Kosten overzicht
| Onderdeel | Kosten |
|-----------|--------|
| Hetzner CX22 server | ~€4/maand |
| .eu domeinnaam | ~€10/jaar |
| Cloudflare CDN | Gratis |
| **Totaal** | **~€5/maand** |

---

## Stap 1: Server huren bij Hetzner (~€4/maand)

1. Ga naar [hetzner.com/cloud](https://www.hetzner.com/cloud/)
2. Maak een account aan
3. Klik **"Add Server"**
4. Kies:
   - **Location**: Falkenstein (DE) — centraal in Europa, lage latency overal
   - **Image**: Ubuntu 24.04
   - **Type**: Shared vCPU → **CX22** (2 vCPU, 4GB RAM) — €3,99/maand
   - **SSH Key**: klik "Add SSH Key" (zie hieronder hoe je er een maakt)
   - **Name**: `stadsspel`
5. Klik **"Create & Buy Now"**
6. Noteer het **IP-adres** (bijv. `65.108.xxx.xxx`)

### SSH key aanmaken (als je er nog geen hebt)
Open PowerShell op je PC en typ:
```powershell
ssh-keygen -t ed25519
```
Druk 3x Enter (standaard locatie, geen wachtwoord).
Kopieer je publieke sleutel:
```powershell
Get-Content ~/.ssh/id_ed25519.pub
```
Plak dit in het Hetzner "Add SSH Key" veld.

---

## Stap 2: Domeinnaam kopen via Cloudflare (~€10/jaar)

> 💡 **Waarom Cloudflare?** Naast domeinnaam registratie krijg je een **gratis CDN** dat je app snel maakt in heel Europa. Spelers in Portugal, Finland of Roemenië krijgen allemaal snelle laadtijden.

1. Ga naar [cloudflare.com](https://www.cloudflare.com/)
2. Maak een account aan → "Register domain"
3. Zoek een `.eu` domein (bijv. `stadsspel.eu`) — werkt in elk Europees land
4. Koop het domein

### DNS instellen
Maak een **A-record** aan:
- **Naam**: `@` (of je subdomein, bijv. `spel`)
- **Type**: A
- **Waarde**: het IP-adres van je Hetzner server
- **TTL**: Auto

### Cloudflare CDN inschakelen (gratis, aanbevolen)
Dit zorgt ervoor dat statische bestanden (JS, CSS, afbeeldingen) worden gecached op servers door heel Europa:

1. Zet het **oranje wolkje (Proxy) AAN** bij je A-record
2. Ga naar **SSL/TLS** → zet modus op **Full (Strict)**
3. Ga naar **Caching** → **Cache Level**: Standard
4. Optioneel: **Speed** → schakel **Auto Minify** in voor JS/CSS

> ⚠️ **Wil je GEEN Cloudflare CDN?** Zet het oranje wolkje UIT (grijs). Caddy regelt dan zelf de SSL. Dit werkt ook prima, maar spelers ver van de server kunnen iets meer vertraging ervaren.

---

## Stap 3: Server inrichten

### Verbind met je server
```powershell
ssh root@JOUW-SERVER-IP
```
Typ `yes` als het om de fingerprint vraagt.

### Installeer Docker
Kopieer en plak dit hele blok:
```bash
curl -fsSL https://get.docker.com | sh
```
Wacht tot het klaar is (~1 minuut).

### Maak een projectmap
```bash
mkdir -p /opt/stadsspel
cd /opt/stadsspel
```

---

## Stap 4: Code naar de server kopiëren

**Vanaf je eigen PC** (niet op de server), open een nieuwe PowerShell:

```powershell
cd C:\Users\MarkC\stadsspel

# Kopieer het hele project naar de server
scp -r ./* root@JOUW-SERVER-IP:/opt/stadsspel/
```

> 💡 **Tip**: Als je later updates wilt doen, gebruik je hetzelfde `scp` commando.  
> Of nog beter: zet je code op GitHub en doe `git pull` op de server.

---

## Stap 5: Environment configureren

**Op de server** (via SSH):

### 5a. Genereer eerst een secret key
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```
Dit print een lange random string. **Kopieer deze** (selecteer en rechtermuisklik).

### 5b. Maak het configuratiebestand
```bash
cd /opt/stadsspel
cp .env.production.example .env.production
nano .env.production
```

Je ziet nu een teksteditor. Pas de volgende 3 regels aan:

```env
DOMAIN=stadsspel.org
DB_PASSWORD=MijnSuperGeheimWachtwoord123!
SECRET_KEY=<plak hier de string uit stap 5a>
```

De rest (DB_USER, DB_NAME) laat je staan — de standaard waarden zijn prima.

### 5c. Opslaan en sluiten
1. Druk `Ctrl+O` (opslaan)
2. Druk `Enter` (bestandsnaam bevestigen)
3. Druk `Ctrl+X` (nano sluiten)

### 5d. Controleer of het goed is opgeslagen
```bash
cat .env.production
```
Je zou je ingevulde waarden moeten zien.

---

## Stap 6: Starten! 🎉

```bash
cd /opt/stadsspel

# Bouw en start alles
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Dit duurt de eerste keer 3-5 minuten. Daarna:

```bash
# Check of alles draait
docker compose -f docker-compose.prod.yml ps
```

Je zou moeten zien:
```
stadsspel_db        running (healthy)
stadsspel_backend   running
stadsspel_caddy     running
stadsspel_frontend  exited (0)    ← dit is normaal, deze kopieert alleen bestanden
```

### Test het!
Open in je browser: `https://jouwdomein.nl`

Je zou de Stadsspel app moeten zien met een groen slotje (HTTPS)! 🔒

---

## Stap 7: Admin inloggen

1. Ga naar `https://jouwdomein.nl`
2. Login met **admin** / **admin321**
3. Maak een spel aan met Lissabon, Amsterdam of Roosendaal
4. Deel de join-link met je teams!

---

## Handige commando's

```bash
# Logs bekijken
docker compose -f docker-compose.prod.yml logs -f backend

# Herstarten na een update
docker compose -f docker-compose.prod.yml up -d --build

# Stoppen
docker compose -f docker-compose.prod.yml down

# Database backup maken
docker exec stadsspel_db pg_dump -U stadsspel stadsspel > backup.sql
```

---

## Updates deployen

Als je code hebt aangepast op je PC:

```powershell
# Vanaf je PC
cd C:\Users\MarkC\stadsspel
scp -r backend/ frontend-react/ deploy/ docker-compose.prod.yml root@JOUW-SERVER-IP:/opt/stadsspel/
```

Dan op de server:
```bash
cd /opt/stadsspel
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Problemen oplossen

| Probleem | Oplossing |
|----------|-----------|
| Site niet bereikbaar | Check DNS: `nslookup jouwdomein.nl` → moet je server-IP tonen |
| "Connection refused" | Wacht 2 min op Caddy SSL, check `docker compose logs caddy` |
| Backend errors | `docker compose -f docker-compose.prod.yml logs backend` |
| Database weg na restart | Zou niet moeten, data zit in Docker volume |
| GPS/Camera werkt niet | Werkt alleen via HTTPS — check het groene slotje |

---

## Architectuur

```
Spelers (heel Europa)
   │
   ▼
┌────────────────┐
│  Cloudflare    │ ← Gratis CDN + DDoS bescherming
│  (optioneel)   │   Cached static files op edge servers
└───────┬────────┘
        │
        ▼
┌──────────┐
│  Caddy   │ ← Automatische HTTPS (Let's Encrypt)
│ :80/:443 │   Hetzner server in Falkenstein (DE)
└────┬─────┘
     │
     ├── /api/*     → Backend (FastAPI :8000)
     ├── /media/*   → Bestanden (foto's inzendingen)
     └── /*         → Frontend (React static files)
                        ↓
                    ┌──────────┐
                    │ Postgres │ (PostGIS)
                    └──────────┘
```
