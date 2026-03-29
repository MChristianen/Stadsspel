# Infrastructure Documentation

## Docker Compose Setup

### PostgreSQL + PostGIS

The `docker-compose.yml` file provides a complete PostgreSQL 16 database with PostGIS 3.4 extension for spatial data.

### Usage

Start database:
```powershell
docker-compose up -d
```

Stop database:
```powershell
docker-compose down
```

Stop and remove volumes (⚠️ deletes all data):
```powershell
docker-compose down -v
```

### Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: stadsspel
- **User**: stadsspel
- **Password**: stadsspel_dev_password

### Direct Database Access

Connect with psql:
```powershell
docker exec -it stadsspel_postgres psql -U stadsspel -d stadsspel
```

Common queries:
```sql
-- List all tables
\dt

-- Check PostGIS version
SELECT PostGIS_Version();

-- View areas with geometry
SELECT id, name, ST_AsText(geom) FROM areas LIMIT 5;

-- Count submissions by status
SELECT status, COUNT(*) FROM submissions GROUP BY status;
```

### Backup & Restore

**Backup:**
```powershell
docker exec stadsspel_postgres pg_dump -U stadsspel stadsspel > backup.sql
```

**Restore:**
```powershell
cat backup.sql | docker exec -i stadsspel_postgres psql -U stadsspel -d stadsspel
```

### Production Considerations

For production deployment:

1. **Managed PostgreSQL** (recommended):
   - Fly.io Postgres
   - Railway Postgres
   - Render Postgres
   - Supabase (free tier with PostGIS)
   - AWS RDS / Azure Database

2. **Self-hosted**:
   - Use production-ready Docker setup with:
     - Volume mounts for persistence
     - Backup automation
     - Monitoring (pg_stat_statements)
     - Connection pooling (PgBouncer)
   
3. **Security**:
   - Change default passwords
   - Use SSL/TLS connections
   - Firewall rules (only allow backend access)
   - Regular security updates

### Troubleshooting

**Container won't start:**
```powershell
# Check logs
docker-compose logs postgres

# Check if port 5432 is already in use
netstat -an | findstr 5432
```

**PostGIS not available:**
```sql
-- Enable manually
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Performance issues:**
```sql
-- Check active queries
SELECT pid, query, state FROM pg_stat_activity;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```
