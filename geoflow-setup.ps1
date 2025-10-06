<#
.SYNOPSIS
    Script d'installation automatique de GeoFlow WebSIG
.DESCRIPTION
    Deploie l'architecture complete GeoFlow avec Docker sur Windows 11
.NOTES
    Version: 1.0
    Chemin d'installation: Sauvegarde automatique dans geoflow-config.json
#>

#Requires -RunAsAdministrator

param(
    [switch]$Install,
    [switch]$Start,
    [switch]$Stop,
    [switch]$Status,
    [switch]$Logs,
    [switch]$Reset,
    [switch]$CheckPrerequisites,
    [switch]$RegenerateConfigs,
    [switch]$Menu
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# ============================================================================
# CONFIGURATION
# ============================================================================

$INSTALL_PATH = ""
$DOCKER_NETWORK = "geoflow_network"
$POSTGRES_VERSION = "16-3.4"
$REDIS_VERSION = "7-alpine"
$NGINX_VERSION = "alpine"

# Fichier de configuration du script (a cote du .ps1)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$CONFIG_FILE = Join-Path $SCRIPT_DIR "geoflow-config.json"

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "`n[ETAPE] $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[OK] $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERREUR] $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[ATTENTION] $Message" "Yellow"
}

function Test-Command {
    param([string]$Command)
    try {
        if (Get-Command $Command -ErrorAction SilentlyContinue) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Wait-UserConfirmation {
    param([string]$Message = "Appuyez sur une touche pour continuer...")
    Write-Host "`n$Message" -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# ============================================================================
# GESTION DE LA CONFIGURATION
# ============================================================================

function Save-InstallConfig {
    param([string]$InstallPath)
    
    $config = @{
        InstallPath = $InstallPath
        LastUpdate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
    
    $config | ConvertTo-Json | Out-File -FilePath $script:CONFIG_FILE -Encoding UTF8 -Force
    Write-Success "Configuration sauvegardee dans: $script:CONFIG_FILE"
}

function Get-SavedInstallPath {
    if (Test-Path $script:CONFIG_FILE) {
        try {
            $config = Get-Content $script:CONFIG_FILE -Raw | ConvertFrom-Json
            if ($config.InstallPath -and (Test-Path $config.InstallPath)) {
                return $config.InstallPath
            }
        } catch {
            Write-Warning "Impossible de lire le fichier de configuration"
        }
    }
    return $null
}

function Test-GeoFlowInstalled {
    param([string]$Path)
    
    # Verifier si les fichiers essentiels existent
    $requiredFiles = @(
        "$Path\.env",
        "$Path\docker-compose.yml"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            return $false
        }
    }
    
    return $true
}

function Get-InstallPath {
    # Si deja defini, retourner
    if ($script:INSTALL_PATH -and (Test-Path $script:INSTALL_PATH)) {
        return $script:INSTALL_PATH
    }
    
    # Essayer de recuperer depuis le fichier de config
    $savedPath = Get-SavedInstallPath
    if ($savedPath) {
        Write-ColorOutput "`nInstallation GeoFlow trouvee: $savedPath" "Green"
        $confirm = Read-Host "Utiliser cette installation? (O/N)"
        if ($confirm -eq 'O') {
            $script:INSTALL_PATH = $savedPath
            return $savedPath
        }
    }
    
    Write-ColorOutput "`n=== CHEMIN D'INSTALLATION ===" "Cyan"
    Write-ColorOutput "Entrez le chemin d'installation de GeoFlow" "White"
    Write-ColorOutput "Exemple: F:\SIG\GeoFlow ou C:\Projects\GeoFlow" "Yellow"
    
    do {
        $path = Read-Host "`nChemin d'installation"
        
        if ([string]::IsNullOrWhiteSpace($path)) {
            Write-Warning "Le chemin ne peut pas etre vide"
            continue
        }
        
        # Nettoyer le chemin
        $path = $path.Trim().TrimEnd('\')
        
        # Verifier le lecteur
        $drive = Split-Path -Path $path -Qualifier
        if (-not (Test-Path $drive)) {
            Write-Warning "Le lecteur $drive n'existe pas"
            continue
        }
        
        $script:INSTALL_PATH = $path
        
        # Sauvegarder le chemin pour les prochaines fois
        Save-InstallConfig -InstallPath $path
        
        return $path
        
    } while ($true)
}

# ============================================================================
# VERIFICATION DES PRE-REQUIS
# ============================================================================

function Test-Prerequisites {
    Write-Step "Verification des pre-requis"
    
    $allOk = $true
    
    # Verifier Docker
    if (Test-Command "docker") {
        $dockerVersion = docker --version
        Write-Success "Docker installe: $dockerVersion"
    } else {
        Write-Error "Docker n'est pas installe"
        $allOk = $false
    }
    
    # Verifier Docker Compose
    if (Test-Command "docker") {
        try {
            docker compose version | Out-Null
            Write-Success "Docker Compose disponible"
        } catch {
            Write-Error "Docker Compose non disponible"
            $allOk = $false
        }
    }
    
    # Verifier que Docker Desktop tourne
    if (Test-Command "docker") {
        try {
            docker ps | Out-Null
            Write-Success "Docker Desktop est actif"
        } catch {
            Write-Error "Docker Desktop n'est pas demarre"
            $allOk = $false
        }
    }
    
    # Verifier les droits administrateur
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if ($currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Success "Droits administrateur OK"
    } else {
        Write-Error "Droits administrateur requis"
        $allOk = $false
    }
    
    if (-not $allOk) {
        throw "Pre-requis non satisfaits"
    }
}

# ============================================================================
# GENERATION DES FICHIERS DE CONFIGURATION
# ============================================================================

function New-EnvironmentFile {
    Write-Step "Generation du fichier .env"
    
    $envContent = @"
# GeoFlow Configuration
PROJECT_NAME=geoflow
INSTALL_PATH=$script:INSTALL_PATH

# PostgreSQL
POSTGRES_DB=geoflow_db
POSTGRES_USER=geoflow_user
POSTGRES_PASSWORD=GeoFlow2025!Secure
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=RedisGeoFlow2025!

# Backend
BACKEND_PORT=3001
NODE_ENV=production

# pg_tileserv
TILESERV_PORT=7800

# NGINX
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Prometheus
PROMETHEUS_PORT=9090

# Grafana
GRAFANA_PORT=3000
GRAFANA_ADMIN_PASSWORD=AdminGeoFlow2025!

# Loki
LOKI_PORT=3100

# Adminer
ADMINER_PORT=8080

# Network
DOCKER_NETWORK=$DOCKER_NETWORK
"@
    
    $envContent | Out-File -FilePath "$script:INSTALL_PATH\.env" -Encoding UTF8 -NoNewline
    Write-Success "Fichier .env cree"
}

function New-DockerCompose {
    Write-Step "Generation du fichier docker-compose.yml"
    
    $composeContent = @"
networks:
  geoflow_network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  loki_data:

services:
  postgres:
    image: postgis/postgis:$POSTGRES_VERSION
    container_name: geoflow_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: `${POSTGRES_DB}
      POSTGRES_USER: `${POSTGRES_USER}
      POSTGRES_PASSWORD: `${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d
    ports:
      - "`${POSTGRES_PORT}:5432"
    networks:
      - geoflow_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U `${POSTGRES_USER} -d `${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:$REDIS_VERSION
    container_name: geoflow_redis
    restart: unless-stopped
    command: redis-server --requirepass `${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "`${REDIS_PORT}:6379"
    networks:
      - geoflow_network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: geoflow_backend
    restart: unless-stopped
    environment:
      NODE_ENV: `${NODE_ENV}
      DATABASE_URL: postgresql://`${POSTGRES_USER}:`${POSTGRES_PASSWORD}@postgres:`${POSTGRES_PORT}/`${POSTGRES_DB}
      REDIS_URL: redis://:`${REDIS_PASSWORD}@redis:`${REDIS_PORT}
      PORT: `${BACKEND_PORT}
    ports:
      - "`${BACKEND_PORT}:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - geoflow_network

  pg_tileserv:
    image: pramsey/pg_tileserv:latest
    container_name: geoflow_tileserv
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://`${POSTGRES_USER}:`${POSTGRES_PASSWORD}@postgres:`${POSTGRES_PORT}/`${POSTGRES_DB}
    ports:
      - "`${TILESERV_PORT}:7800"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - geoflow_network

  nginx:
    image: nginx:$NGINX_VERSION
    container_name: geoflow_nginx
    restart: unless-stopped
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/cache:/var/cache/nginx
    ports:
      - "`${NGINX_HTTP_PORT}:80"
    depends_on:
      - backend
      - pg_tileserv
    networks:
      - geoflow_network

  prometheus:
    image: prom/prometheus:latest
    container_name: geoflow_prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "`${PROMETHEUS_PORT}:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - geoflow_network

  grafana:
    image: grafana/grafana:latest
    container_name: geoflow_grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: `${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: 'false'
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "`${GRAFANA_PORT}:3000"
    depends_on:
      - prometheus
    networks:
      - geoflow_network

  loki:
    image: grafana/loki:latest
    container_name: geoflow_loki
    restart: unless-stopped
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    ports:
      - "`${LOKI_PORT}:3100"
    networks:
      - geoflow_network

  promtail:
    image: grafana/promtail:latest
    container_name: geoflow_promtail
    restart: unless-stopped
    volumes:
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
    networks:
      - geoflow_network

  adminer:
    image: adminer:latest
    container_name: geoflow_adminer
    restart: unless-stopped
    environment:
      ADMINER_DEFAULT_SERVER: postgres
      ADMINER_DESIGN: nette
    ports:
      - "`${ADMINER_PORT}:8080"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - geoflow_network
"@
    
    $composeContent | Out-File -FilePath "$script:INSTALL_PATH\docker-compose.yml" -Encoding UTF8 -NoNewline
    Write-Success "Fichier docker-compose.yml cree"
}

function New-InitDatabase {
    Write-Step "Generation du script d'initialisation PostgreSQL"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\init-db" | Out-Null
    
    $initScript = @"
-- GeoFlow Database Initialization Script

-- Activer PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Schema pour les donnees spatiales
CREATE SCHEMA IF NOT EXISTS spatial;

-- Table des couches
CREATE TABLE IF NOT EXISTS spatial.layers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('vector', 'raster', 'wms', 'wmts', 'wfs')),
    source_url TEXT,
    style JSONB,
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des themes
CREATE TABLE IF NOT EXISTS spatial.themes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    css_config JSONB,
    layers_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des geometries vectorielles (exemple points)
CREATE TABLE IF NOT EXISTS spatial.features_points (
    id SERIAL PRIMARY KEY,
    layer_id INTEGER REFERENCES spatial.layers(id) ON DELETE CASCADE,
    properties JSONB,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des geometries lignes
CREATE TABLE IF NOT EXISTS spatial.features_lines (
    id SERIAL PRIMARY KEY,
    layer_id INTEGER REFERENCES spatial.layers(id) ON DELETE CASCADE,
    properties JSONB,
    geom GEOMETRY(LineString, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des geometries polygones
CREATE TABLE IF NOT EXISTS spatial.features_polygons (
    id SERIAL PRIMARY KEY,
    layer_id INTEGER REFERENCES spatial.layers(id) ON DELETE CASCADE,
    properties JSONB,
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index spatiaux
CREATE INDEX IF NOT EXISTS idx_features_points_geom ON spatial.features_points USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_features_lines_geom ON spatial.features_lines USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_features_polygons_geom ON spatial.features_polygons USING GIST(geom);

-- Index sur layer_id
CREATE INDEX IF NOT EXISTS idx_features_points_layer ON spatial.features_points(layer_id);
CREATE INDEX IF NOT EXISTS idx_features_lines_layer ON spatial.features_lines(layer_id);
CREATE INDEX IF NOT EXISTS idx_features_polygons_layer ON spatial.features_polygons(layer_id);

-- Vue materialisee pour le cache
CREATE MATERIALIZED VIEW IF NOT EXISTS spatial.mv_all_features AS
SELECT 
    'point' as geom_type,
    id,
    layer_id,
    properties,
    ST_AsGeoJSON(geom)::json as geojson,
    geom
FROM spatial.features_points
UNION ALL
SELECT 
    'line' as geom_type,
    id,
    layer_id,
    properties,
    ST_AsGeoJSON(geom)::json as geojson,
    geom
FROM spatial.features_lines
UNION ALL
SELECT 
    'polygon' as geom_type,
    id,
    layer_id,
    properties,
    ST_AsGeoJSON(geom)::json as geojson,
    geom
FROM spatial.features_polygons;

CREATE INDEX IF NOT EXISTS idx_mv_all_features_geom ON spatial.mv_all_features USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_mv_all_features_layer ON spatial.mv_all_features(layer_id);

-- Fonction de rafraichissement auto de la vue materialisee
CREATE OR REPLACE FUNCTION spatial.refresh_mv_all_features()
RETURNS TRIGGER AS `$`$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY spatial.mv_all_features;
    RETURN NULL;
END;
`$`$ LANGUAGE plpgsql;

-- Triggers pour rafraichir la vue
CREATE TRIGGER trigger_refresh_mv_points
AFTER INSERT OR UPDATE OR DELETE ON spatial.features_points
FOR EACH STATEMENT EXECUTE FUNCTION spatial.refresh_mv_all_features();

CREATE TRIGGER trigger_refresh_mv_lines
AFTER INSERT OR UPDATE OR DELETE ON spatial.features_lines
FOR EACH STATEMENT EXECUTE FUNCTION spatial.refresh_mv_all_features();

CREATE TRIGGER trigger_refresh_mv_polygons
AFTER INSERT OR UPDATE OR DELETE ON spatial.features_polygons
FOR EACH STATEMENT EXECUTE FUNCTION spatial.refresh_mv_all_features();

-- Donnees d'exemple
INSERT INTO spatial.themes (name, title, description, css_config, layers_config) VALUES
('default', 'Theme par defaut', 'Theme GeoFlow par defaut', 
 '{"primaryColor": "#2563eb", "secondaryColor": "#0ea5e9"}'::jsonb,
 '{"baseLayers": ["osm"], "overlays": []}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO spatial.layers (name, title, description, type) VALUES
('example_points', 'Points d''exemple', 'Couche de points pour tests', 'vector'),
('example_lines', 'Lignes d''exemple', 'Couche de lignes pour tests', 'vector'),
('example_polygons', 'Polygones d''exemple', 'Couche de polygones pour tests', 'vector')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA spatial TO geoflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA spatial TO geoflow_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA spatial TO geoflow_user;
"@
    
    $initScript | Out-File -FilePath "$script:INSTALL_PATH\init-db\01-init.sql" -Encoding UTF8 -NoNewline
    Write-Success "Script d'initialisation PostgreSQL cree"
}

function New-NginxConfig {
    Write-Step "Generation de la configuration NGINX"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\nginx" | Out-Null
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\nginx\cache" | Out-Null
    
    $nginxConf = @"
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '`$remote_addr - `$remote_user [`$time_local] "`$request" '
                    '`$status `$body_bytes_sent "`$http_referer" '
                    '"`$http_user_agent" "`$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/x-javascript;

    proxy_cache_path /var/cache/nginx/tiles levels=1:2 keys_zone=tile_cache:10m max_size=500m inactive=7d use_temp_path=off;
    proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=1h use_temp_path=off;

    upstream backend {
        server backend:3001 max_fails=3 fail_timeout=30s;
    }

    upstream tileserv {
        server pg_tileserv:7800 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;
        server_name localhost;

        location /api/ {
            proxy_pass http://backend/;
            proxy_cache api_cache;
            proxy_cache_valid 200 5m;
            proxy_cache_valid 404 1m;
            proxy_cache_key `$scheme`$request_method`$host`$request_uri;
            proxy_cache_bypass `$http_cache_control;
            add_header X-Cache-Status `$upstream_cache_status;
            
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        location /tiles/ {
            proxy_pass http://tileserv/;
            proxy_cache tile_cache;
            proxy_cache_valid 200 7d;
            proxy_cache_valid 404 1m;
            proxy_cache_key `$scheme`$request_method`$host`$request_uri;
            proxy_cache_bypass `$http_cache_control;
            add_header X-Cache-Status `$upstream_cache_status;
            add_header Access-Control-Allow-Origin *;
            
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        location / {
            return 200 "GeoFlow is running\n";
            add_header Content-Type text/plain;
        }
    }
}
"@
    
    # UTF8 sans BOM
    [System.IO.File]::WriteAllText("$script:INSTALL_PATH\nginx\nginx.conf", $nginxConf, (New-Object System.Text.UTF8Encoding $false))
    Write-Success "Configuration NGINX creee"
}

function New-BackendStructure {
    Write-Step "Generation de la structure Backend"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\backend\src" | Out-Null
    
    # Dockerfile
    $dockerfile = @"
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/server.js"]
"@
    
    $dockerfile | Out-File -FilePath "$script:INSTALL_PATH\backend\Dockerfile" -Encoding UTF8 -NoNewline
    
    # package.json
    $packageJson = @"
{
  "name": "geoflow-backend",
  "version": "1.0.0",
  "description": "GeoFlow Backend API",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
"@
    
    $packageJson | Out-File -FilePath "$script:INSTALL_PATH\backend\package.json" -Encoding UTF8 -NoNewline
    
    # server.js
    $serverJs = @"
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis
let redisClient;
(async () => {
  redisClient = redis.createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', err => console.error('Redis Error:', err));
  await redisClient.connect();
})();

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/layers', async (req, res) => {
  try {
    const cacheKey = 'layers:all';
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const result = await pool.query('SELECT * FROM spatial.layers WHERE is_active = true');
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result.rows));
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/themes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM spatial.themes WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(\`Backend running on port \${PORT}\`);
});
"@
    
    $serverJs | Out-File -FilePath "$script:INSTALL_PATH\backend\src\server.js" -Encoding UTF8 -NoNewline
    Write-Success "Structure Backend creee"
}

function New-PrometheusConfig {
    Write-Step "Generation de la configuration Prometheus"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\prometheus" | Out-Null
    
    $prometheusYml = @"
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']

  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3001']
"@
    
    $prometheusYml | Out-File -FilePath "$script:INSTALL_PATH\prometheus\prometheus.yml" -Encoding UTF8 -NoNewline
    Write-Success "Configuration Prometheus creee"
}

function New-LokiConfig {
    Write-Step "Generation de la configuration Loki"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\loki" | Out-Null
    
    $lokiYml = @"
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/tsdb-index
    cache_location: /loki/tsdb-cache
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 168h
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20
  max_query_series: 500

compactor:
  working_directory: /loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
  delete_request_store: filesystem

pattern_ingester:
  enabled: false
"@
    
    # UTF8 sans BOM
    [System.IO.File]::WriteAllText("$script:INSTALL_PATH\loki\loki-config.yml", $lokiYml, (New-Object System.Text.UTF8Encoding $false))
    Write-Success "Configuration Loki creee"
}

function New-PromtailConfig {
    Write-Step "Generation de la configuration Promtail"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\promtail" | Out-Null
    
    $promtailYml = @"
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    static_configs:
      - targets:
          - localhost
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*-json.log
"@
    
    $promtailYml | Out-File -FilePath "$script:INSTALL_PATH\promtail\promtail-config.yml" -Encoding UTF8 -NoNewline
    Write-Success "Configuration Promtail creee"
}

function New-GrafanaProvisioning {
    Write-Step "Generation du provisioning Grafana"
    
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\grafana\provisioning\datasources" | Out-Null
    New-Item -ItemType Directory -Force -Path "$script:INSTALL_PATH\grafana\provisioning\dashboards" | Out-Null
    
    $datasources = @"
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
"@
    
    $datasources | Out-File -FilePath "$script:INSTALL_PATH\grafana\provisioning\datasources\datasources.yml" -Encoding UTF8 -NoNewline
    Write-Success "Provisioning Grafana cree"
}

# ============================================================================
# OPERATIONS DOCKER
# ============================================================================

function Start-GeoFlowStack {
    if (-not $script:INSTALL_PATH) {
        $script:INSTALL_PATH = Get-InstallPath
    }
    
    # Verifier si GeoFlow est installe
    if (-not (Test-GeoFlowInstalled -Path $script:INSTALL_PATH)) {
        Write-Error "GeoFlow n'est pas installe dans ce repertoire: $script:INSTALL_PATH"
        Write-ColorOutput "Veuillez d'abord installer GeoFlow (option 2)" "Yellow"
        return
    }
    
    Write-Step "Demarrage de la stack GeoFlow"
    
    Set-Location $script:INSTALL_PATH
    
    docker compose down 2>$null
    docker compose up -d
    
    Write-Success "Stack demarree"
}

function Stop-GeoFlowStack {
    if (-not $script:INSTALL_PATH) {
        $script:INSTALL_PATH = Get-InstallPath
    }
    
    # Verifier si GeoFlow est installe
    if (-not (Test-GeoFlowInstalled -Path $script:INSTALL_PATH)) {
        Write-Error "GeoFlow n'est pas installe dans ce repertoire: $script:INSTALL_PATH"
        return
    }
    
    Write-Step "Arret de la stack GeoFlow"
    
    Set-Location $script:INSTALL_PATH
    docker compose down
    
    Write-Success "Stack arretee"
}

function Show-GeoFlowStatus {
    if (-not $script:INSTALL_PATH) {
        $script:INSTALL_PATH = Get-InstallPath
    }
    
    # Verifier si GeoFlow est installe
    if (-not (Test-GeoFlowInstalled -Path $script:INSTALL_PATH)) {
        Write-Error "GeoFlow n'est pas installe dans ce repertoire: $script:INSTALL_PATH"
        return
    }
    
    Write-Step "Statut de la stack GeoFlow"
    
    Set-Location $script:INSTALL_PATH
    docker compose ps
}

function Show-GeoFlowLogs {
    param([string]$Service = "")
    
    if (-not $script:INSTALL_PATH) {
        $script:INSTALL_PATH = Get-InstallPath
    }
    
    # Verifier si GeoFlow est installe
    if (-not (Test-GeoFlowInstalled -Path $script:INSTALL_PATH)) {
        Write-Error "GeoFlow n'est pas installe dans ce repertoire: $script:INSTALL_PATH"
        return
    }
    
    Write-Step "Logs de la stack GeoFlow"
    
    Set-Location $script:INSTALL_PATH
    
    if ($Service) {
        docker compose logs --tail=200 $Service
    } else {
        docker compose logs --tail=200
    }
    
    Write-ColorOutput "`n[Appuyez sur une touche pour continuer ou CTRL+C pour quitter]" "Yellow"
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# ============================================================================
# INSTALLATION COMPLETE
# ============================================================================

function Install-GeoFlow {
    try {
        Write-ColorOutput "`n========================================" "Cyan"
        Write-ColorOutput "   INSTALLATION GEOFLOW v1.0" "Cyan"
        Write-ColorOutput "========================================`n" "Cyan"
        
        Test-Prerequisites
        
        # Demander le chemin d'installation
        $installDir = Get-InstallPath
        
        # Creation du repertoire
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Force -Path $installDir | Out-Null
            Write-Success "Repertoire d'installation cree: $installDir"
        } else {
            Write-Success "Utilisation du repertoire: $installDir"
        }
        
        # Generation des fichiers
        New-EnvironmentFile
        New-DockerCompose
        New-InitDatabase
        New-NginxConfig
        New-BackendStructure
        New-PrometheusConfig
        New-LokiConfig
        New-PromtailConfig
        New-GrafanaProvisioning
        
        # Demarrage de la stack
        Start-GeoFlowStack
        
        Write-ColorOutput "`n========================================" "Green"
        Write-ColorOutput "   INSTALLATION TERMINEE AVEC SUCCES!" "Green"
        Write-ColorOutput "========================================`n" "Green"
        
        Write-ColorOutput "`nServices disponibles:" "Cyan"
        Write-ColorOutput "  - NGINX (Reverse Proxy): http://localhost" "White"
        Write-ColorOutput "  - Backend API: http://localhost:3001" "White"
        Write-ColorOutput "  - PostgreSQL/PostGIS: localhost:5432" "White"
        Write-ColorOutput "  - Adminer (DB Admin): http://localhost:8080" "White"
        Write-ColorOutput "  - pg_tileserv: http://localhost:7800" "White"
        Write-ColorOutput "  - Redis: localhost:6379" "White"
        Write-ColorOutput "  - Prometheus: http://localhost:9090" "White"
        Write-ColorOutput "  - Grafana: http://localhost:3000 (admin/AdminGeoFlow2025!)" "White"
        Write-ColorOutput "  - Loki: http://localhost:3100" "White"
        
        Write-ColorOutput "`nBase de donnees PostgreSQL:" "Cyan"
        Write-ColorOutput "  - Database: geoflow_db" "White"
        Write-ColorOutput "  - User: geoflow_user" "White"
        Write-ColorOutput "  - Password: GeoFlow2025!Secure" "White"
        
        Write-ColorOutput "`nAcces Adminer (http://localhost:8080):" "Cyan"
        Write-ColorOutput "  - Systeme: PostgreSQL" "White"
        Write-ColorOutput "  - Serveur: postgres" "White"
        Write-ColorOutput "  - Utilisateur: geoflow_user" "White"
        Write-ColorOutput "  - Mot de passe: GeoFlow2025!Secure" "White"
        Write-ColorOutput "  - Base de donnees: geoflow_db" "White"
        
    } catch {
        Write-Error "Erreur lors de l'installation: $_"
        Write-ColorOutput "`nConsultez les logs Docker pour plus de details:" "Yellow"
        Write-ColorOutput "  docker compose logs" "White"
        exit 1
    }
}

# ============================================================================
# MENU INTERACTIF
# ============================================================================

function Show-Menu {
    Clear-Host
    Write-ColorOutput "`n========================================" "Cyan"
    Write-ColorOutput "        GEOFLOW - MENU PRINCIPAL" "Cyan"
    Write-ColorOutput "========================================`n" "Cyan"
    
    Write-ColorOutput "1. Verifier les pre-requis uniquement" "White"
    Write-ColorOutput "2. Installation complete de GeoFlow" "White"
    Write-ColorOutput "3. Demarrer la stack" "White"
    Write-ColorOutput "4. Arreter la stack" "White"
    Write-ColorOutput "5. Afficher le statut" "White"
    Write-ColorOutput "6. Afficher les logs" "White"
    Write-ColorOutput "7. Regenerer les fichiers de configuration" "White"
    Write-ColorOutput "8. Reinitialiser (supprimer tous les conteneurs et volumes)" "White"
    Write-ColorOutput "Q. Quitter" "White"
    
    Write-Host ""
}

function Reset-GeoFlow {
    if (-not $script:INSTALL_PATH) {
        $script:INSTALL_PATH = Get-InstallPath
    }
    
    Write-Warning "`nATTENTION: Cette operation va supprimer tous les conteneurs et volumes!"
    $confirm = Read-Host "Etes-vous sur? Tapez 'SUPPRIMER' pour confirmer"
    
    if ($confirm -eq 'SUPPRIMER') {
        Write-Step "Suppression de la stack GeoFlow"
        
        Set-Location $script:INSTALL_PATH
        docker compose down -v
        
        Write-Success "Stack supprimee avec succes"
    } else {
        Write-ColorOutput "Operation annulee" "Yellow"
    }
}

function Regenerate-Configs {
    if (-not $script:INSTALL_PATH) {
        $script:INSTALL_PATH = Get-InstallPath
    }
    
    Write-Step "Regeneration des fichiers de configuration"
    
    New-EnvironmentFile
    New-DockerCompose
    New-InitDatabase
    New-NginxConfig
    New-BackendStructure
    New-PrometheusConfig
    New-LokiConfig
    New-PromtailConfig
    New-GrafanaProvisioning
    
    Write-Success "Fichiers regeneres avec succes"
    Write-Warning "Relancez la stack pour appliquer les changements"
}

# ============================================================================
# POINT D'ENTREE PRINCIPAL
# ============================================================================

# Initialisation : chercher le chemin d'installation sauvegarde
$savedPath = Get-SavedInstallPath
if ($savedPath -and (Test-GeoFlowInstalled -Path $savedPath)) {
    $script:INSTALL_PATH = $savedPath
    Write-ColorOutput "Installation GeoFlow detectee: $script:INSTALL_PATH" "Green"
}

# Si aucun parametre, afficher le menu
if (-not ($Install -or $Start -or $Stop -or $Status -or $Logs -or $Reset -or $CheckPrerequisites -or $RegenerateConfigs)) {
    $Menu = $true
}

if ($Menu) {
    do {
        Show-Menu
        $choice = Read-Host "Choisissez une option"
        
        switch ($choice) {
            '1' {
                Test-Prerequisites
                Wait-UserConfirmation
            }
            '2' {
                Install-GeoFlow
                Wait-UserConfirmation
            }
            '3' {
                Start-GeoFlowStack
                Wait-UserConfirmation
            }
            '4' {
                Stop-GeoFlowStack
                Wait-UserConfirmation
            }
            '5' {
                Show-GeoFlowStatus
                Wait-UserConfirmation
            }
            '6' {
                Show-GeoFlowLogs
            }
            '7' {
                Regenerate-Configs
                Wait-UserConfirmation
            }
            '8' {
                Reset-GeoFlow
                Wait-UserConfirmation
            }
            'Q' {
                exit 0
            }
            default {
                Write-Warning "Option invalide"
                Start-Sleep -Seconds 1
            }
        }
    } while ($choice -ne 'Q')
} else {
    # Mode ligne de commande
    if ($Install) { Install-GeoFlow }
    if ($Start) { Start-GeoFlowStack }
    if ($Stop) { Stop-GeoFlowStack }
    if ($Status) { Show-GeoFlowStatus }
    if ($Logs) { Show-GeoFlowLogs }
    if ($Reset) { Reset-GeoFlow }
    if ($CheckPrerequisites) { Test-Prerequisites }
    if ($RegenerateConfigs) { Regenerate-Configs }
}

Write-ColorOutput "`nScript termine.`n" "Green"