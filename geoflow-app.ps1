<#
.SYNOPSIS
    Gestionnaire d'applications GeoFlow
.DESCRIPTION
    Permet de creer, lister et gerer des instances d'applications GeoFlow
    Chaque app = 1 theme = 1 client avec Bootstrap + Leaflet
.NOTES
    Version: 2.0 - Apps servies directement par NGINX
#>

#Requires -RunAsAdministrator

param(
    [switch]$List,
    [switch]$Create,
    [string]$Enable,
    [string]$Disable,
    [string]$Remove,
    [switch]$Menu
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SETUP_CONFIG_FILE = Join-Path $SCRIPT_DIR "geoflow-config.json"
$APPS_DIR = ""
$GEOFLOW_INSTALL_PATH = ""

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
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

function Wait-UserConfirmation {
    param([string]$Message = "Appuyez sur une touche pour continuer...")
    Write-Host "`n$Message" -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Get-GeoFlowInstallPath {
    if (Test-Path $SETUP_CONFIG_FILE) {
        try {
            $config = Get-Content $SETUP_CONFIG_FILE -Raw | ConvertFrom-Json
            if ($config.InstallPath -and (Test-Path $config.InstallPath)) {
                return $config.InstallPath
            }
        } catch {
            Write-Warning "Impossible de lire la configuration GeoFlow"
        }
    }
    
    Write-Error "GeoFlow n'est pas installe ou le fichier de configuration est manquant"
    Write-ColorOutput "Fichier cherche: $SETUP_CONFIG_FILE" "Yellow"
    Write-ColorOutput "Veuillez d'abord installer GeoFlow avec: .\geoflow-setup.ps1" "Yellow"
    throw "GeoFlow non installe"
}

function Initialize-AppsDirectory {
    $script:GEOFLOW_INSTALL_PATH = Get-GeoFlowInstallPath
    $script:APPS_DIR = Join-Path $script:GEOFLOW_INSTALL_PATH "apps"
    
    if (-not (Test-Path $script:APPS_DIR)) {
        New-Item -ItemType Directory -Force -Path $script:APPS_DIR | Out-Null
        Write-Success "Repertoire apps cree: $script:APPS_DIR"
    }
}

function Get-AppsList {
    if (-not (Test-Path $script:APPS_DIR)) {
        return @()
    }
    
    $apps = @()
    $folders = Get-ChildItem -Path $script:APPS_DIR -Directory
    
    foreach ($folder in $folders) {
        $configFile = Join-Path $folder.FullName "config.json"
        if (Test-Path $configFile) {
            try {
                $config = Get-Content $configFile -Raw | ConvertFrom-Json
                $apps += [PSCustomObject]@{
                    Name = $folder.Name
                    Title = $config.theme.title
                    Path = $folder.FullName
                    Enabled = $config.enabled
                }
            } catch {
                Write-Warning "Erreur lecture config de '$($folder.Name)': $_"
            }
        }
    }
    
    return ,$apps
}

function Show-AppsList {
    Write-Step "Liste des applications GeoFlow"
    
    $apps = Get-AppsList
    
    if ($apps.Count -eq 0) {
        Write-Warning "Aucune application creee"
        Write-ColorOutput "Utilisez l'option 1 pour creer une nouvelle application" "Yellow"
        return
    }
    
    Write-Host "`n"
    Write-Host "NOM".PadRight(20) "TITRE".PadRight(40) "STATUT" -ForegroundColor Cyan
    Write-Host ("-" * 80) -ForegroundColor Cyan
    
    foreach ($app in $apps) {
        $statusColor = if ($app.Enabled) { "Green" } else { "Gray" }
        $statusText = if ($app.Enabled) { "Active" } else { "Desactivee" }
        Write-Host $app.Name.PadRight(20) -NoNewline
        Write-Host $app.Title.PadRight(40) -NoNewline
        Write-Host $statusText -ForegroundColor $statusColor
    }
    
    Write-Host ""
}

function New-GeoFlowApp {
    Write-Step "Creation d'une nouvelle application GeoFlow"
    
    do {
        $appName = Read-Host "`nNom de l'application (ex: client-a, demo, mairie)"
        $appName = $appName.Trim().ToLower() -replace '[^a-z0-9-]', ''
        
        if ([string]::IsNullOrWhiteSpace($appName)) {
            Write-Warning "Le nom ne peut pas etre vide"
            continue
        }
        
        $appPath = Join-Path $script:APPS_DIR $appName
        if (Test-Path $appPath) {
            Write-Warning "Une application avec ce nom existe deja"
            continue
        }
        
        break
    } while ($true)
    
    $appTitle = Read-Host "Titre de l'application (ex: Cartographie Client A)"
    if ([string]::IsNullOrWhiteSpace($appTitle)) {
        $appTitle = $appName
    }
    
    Write-ColorOutput "`n=== THEME VISUEL ===" "Cyan"
    $primaryColor = Read-Host "Couleur primaire (ex: #2563eb)"
    if ([string]::IsNullOrWhiteSpace($primaryColor)) { $primaryColor = "#2563eb" }
    
    $secondaryColor = Read-Host "Couleur secondaire (ex: #0ea5e9)"
    if ([string]::IsNullOrWhiteSpace($secondaryColor)) { $secondaryColor = "#0ea5e9" }
    
    Write-ColorOutput "`n=== CARTE PAR DEFAUT ===" "Cyan"
    $centerLat = Read-Host "Latitude du centre (defaut: 48.8566)"
    if ([string]::IsNullOrWhiteSpace($centerLat)) { $centerLat = "48.8566" }
    
    $centerLng = Read-Host "Longitude du centre (defaut: 2.3522)"
    if ([string]::IsNullOrWhiteSpace($centerLng)) { $centerLng = "2.3522" }
    
    $zoom = Read-Host "Zoom initial (defaut: 12)"
    if ([string]::IsNullOrWhiteSpace($zoom)) { $zoom = "12" }
    
    Write-Step "Creation de l'application '$appName'..."
    
    New-Item -ItemType Directory -Force -Path $appPath | Out-Null
    New-AppStructure -AppPath $appPath -AppName $appName -AppTitle $appTitle `
        -PrimaryColor $primaryColor -SecondaryColor $secondaryColor `
        -CenterLat $centerLat -CenterLng $centerLng -Zoom $zoom
    
    Write-Success "Application '$appName' creee avec succes!"
    Write-ColorOutput "`nPour activer l'application:" "Cyan"
    Write-ColorOutput "  .\geoflow-app.ps1 -Enable $appName" "White"
    Write-ColorOutput "  Puis accessible sur: http://localhost/$appName/" "White"
}

function New-AppStructure {
    param(
        [string]$AppPath,
        [string]$AppName,
        [string]$AppTitle,
        [string]$PrimaryColor,
        [string]$SecondaryColor,
        [string]$CenterLat,
        [string]$CenterLng,
        [string]$Zoom
    )
    
    New-Item -ItemType Directory -Force -Path "$AppPath\css" | Out-Null
    New-Item -ItemType Directory -Force -Path "$AppPath\js" | Out-Null
    New-Item -ItemType Directory -Force -Path "$AppPath\assets" | Out-Null
    
    $config = @{
        enabled = $false
        theme = @{
            name = $AppName
            title = $AppTitle
            colors = @{
                primary = $PrimaryColor
                secondary = $SecondaryColor
            }
            logo = "assets/logo.png"
        }
        map = @{
            center = @([double]$CenterLat, [double]$CenterLng)
            zoom = [int]$Zoom
            baseLayers = @("osm", "satellite")
        }
        server = @{
            apiUrl = "/api"
            tilesUrl = "/tiles"
        }
        features = @{
            draw = $true
            search = $true
            filters = $true
            export = $true
        }
    }
    
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath "$AppPath\config.json" -Encoding UTF8
    
    # Mêmes fichiers HTML/CSS/JS que dans votre version originale
    $html = @"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$AppTitle</title>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    
    <link rel="stylesheet" href="css/theme.css">
    <link rel="stylesheet" href="css/app.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container-fluid">
            <a class="navbar-brand" href="#">
                <i class="bi bi-geo-alt-fill"></i>
                $AppTitle
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="#" id="btn-layers">
                            <i class="bi bi-layers"></i> Couches
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#" id="btn-search">
                            <i class="bi bi-search"></i> Rechercher
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#" id="btn-draw">
                            <i class="bi bi-pencil"></i> Dessiner
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h5>Panneau de controle</h5>
            <button class="btn-close" id="btn-close-sidebar"></button>
        </div>
        <div class="sidebar-content" id="sidebar-content">
        </div>
    </div>

    <div id="map"></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <script src="https://unpkg.com/leaflet-geosearch@3.7.0/dist/bundle.min.js"></script>
    
    <script src="js/config.js"></script>
    <script src="js/map.js"></script>
    <script src="js/layers.js"></script>
    <script src="js/draw.js"></script>
    <script src="js/search.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
"@
    
    [System.IO.File]::WriteAllText("$AppPath\index.html", $html, (New-Object System.Text.UTF8Encoding $false))
    
    # CSS et JS identiques à votre version
    $themeCSS = @"
:root {
    --primary-color: $PrimaryColor;
    --secondary-color: $SecondaryColor;
}

.bg-primary {
    background-color: var(--primary-color) !important;
}

.btn-primary {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
}

.btn-primary:hover {
    background-color: var(--secondary-color);
    border-color: var(--secondary-color);
}

.text-primary {
    color: var(--primary-color) !important;
}
"@
    
    $themeCSS | Out-File -FilePath "$AppPath\css\theme.css" -Encoding UTF8 -NoNewline
    
    $appCSS = @"
body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#map {
    position: absolute;
    top: 56px;
    left: 0;
    right: 0;
    bottom: 0;
}

.sidebar {
    position: fixed;
    top: 56px;
    left: -400px;
    width: 400px;
    height: calc(100vh - 56px);
    background: white;
    box-shadow: 2px 0 10px rgba(0,0,0,0.1);
    transition: left 0.3s ease;
    z-index: 1000;
    overflow-y: auto;
}

.sidebar.active {
    left: 0;
}

.sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.sidebar-content {
    padding: 1rem;
}

.layer-item {
    padding: 0.5rem;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background 0.2s;
}

.layer-item:hover {
    background: #f8f9fa;
}

.leaflet-popup-content {
    margin: 1rem;
}
"@
    
    $appCSS | Out-File -FilePath "$AppPath\css\app.css" -Encoding UTF8 -NoNewline
    
    $configJS = @"
let CONFIG = null;

async function loadConfig() {
    const response = await fetch('config.json');
    CONFIG = await response.json();
    return CONFIG;
}
"@
    
    $configJS | Out-File -FilePath "$AppPath\js\config.js" -Encoding UTF8 -NoNewline
    
    # Tous les autres fichiers JS identiques...
    $mapJS = @"
let map = null;
let baseLayers = {};

function initMap() {
    map = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);
    
    baseLayers['OSM'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    baseLayers['Satellite'] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri'
    });
    
    L.control.layers(baseLayers).addTo(map);
    
    return map;
}
"@
    
    $mapJS | Out-File -FilePath "$AppPath\js\map.js" -Encoding UTF8 -NoNewline
    
    $layersJS = @"
let layers = [];
let layerGroups = {};

async function loadLayers() {
    try {
        const response = await fetch(\`\${CONFIG.server.apiUrl}/layers\`);
        layers = await response.json();
        displayLayersPanel();
    } catch (err) {
        console.error('Erreur chargement couches:', err);
    }
}

function displayLayersPanel() {
    const content = document.getElementById('sidebar-content');
    content.innerHTML = '<h6>Couches disponibles</h6>';
    
    layers.forEach(layer => {
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.innerHTML = \`
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="layer-\${layer.id}">
                <label class="form-check-label" for="layer-\${layer.id}">
                    <strong>\${layer.title}</strong><br>
                    <small class="text-muted">\${layer.description || ''}</small>
                </label>
            </div>
        \`;
        
        div.querySelector('input').addEventListener('change', (e) => {
            toggleLayer(layer, e.target.checked);
        });
        
        content.appendChild(div);
    });
}

function toggleLayer(layer, show) {
    if (show) {
        fetch(\`\${CONFIG.server.apiUrl}/layers/\${layer.id}/data\`)
            .then(r => r.json())
            .then(data => {
                layerGroups[layer.id] = L.geoJSON(data, {
                    style: layer.style,
                    onEachFeature: (feature, layer) => {
                        if (feature.properties) {
                            layer.bindPopup(JSON.stringify(feature.properties, null, 2));
                        }
                    }
                }).addTo(map);
            });
    } else {
        if (layerGroups[layer.id]) {
            map.removeLayer(layerGroups[layer.id]);
            delete layerGroups[layer.id];
        }
    }
}
"@
    
    $layersJS | Out-File -FilePath "$AppPath\js\layers.js" -Encoding UTF8 -NoNewline
    
    $drawJS = @"
let drawControl = null;
let drawnItems = null;

function initDraw() {
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: true,
            polyline: true,
            marker: true,
            circle: false,
            rectangle: true,
            circlemarker: false
        }
    });
    
    map.addControl(drawControl);
    
    map.on('draw:created', (e) => {
        drawnItems.addLayer(e.layer);
    });
}
"@
    
    $drawJS | Out-File -FilePath "$AppPath\js\draw.js" -Encoding UTF8 -NoNewline
    
    $searchJS = @"
function initSearch() {
    const provider = new window.GeoSearch.OpenStreetMapProvider();
    const searchControl = new window.GeoSearch.GeoSearchControl({
        provider: provider,
        style: 'bar',
        autoComplete: true,
        autoCompleteDelay: 250
    });
    
    map.addControl(searchControl);
}
"@
    
    $searchJS | Out-File -FilePath "$AppPath\js\search.js" -Encoding UTF8 -NoNewline
    
    $appJS = @"
const sidebar = document.getElementById('sidebar');

document.getElementById('btn-layers').addEventListener('click', (e) => {
    e.preventDefault();
    loadLayers();
    toggleSidebar();
});

document.getElementById('btn-search').addEventListener('click', (e) => {
    e.preventDefault();
});

document.getElementById('btn-draw').addEventListener('click', (e) => {
    e.preventDefault();
});

document.getElementById('btn-close-sidebar').addEventListener('click', () => {
    toggleSidebar();
});

function toggleSidebar() {
    sidebar.classList.toggle('active');
}

async function init() {
    await loadConfig();
    initMap();
    
    if (CONFIG.features.draw) {
        initDraw();
    }
    
    if (CONFIG.features.search) {
        initSearch();
    }
    
    console.log('$AppTitle initialise');
}

init();
"@
    
    $appJS | Out-File -FilePath "$AppPath\js\app.js" -Encoding UTF8 -NoNewline
    
    Write-Success "Structure de l'application creee"
}

function Enable-App {
    param([string]$AppName)
    
    $appPath = Join-Path $script:APPS_DIR $AppName
    
    if (-not (Test-Path $appPath)) {
        Write-Error "Application '$AppName' introuvable"
        return
    }
    
    $configFile = Join-Path $appPath "config.json"
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    $config.enabled = $true
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configFile -Encoding UTF8
    
    Update-NginxConfig
    
    Write-Success "Application '$AppName' activee"
    Write-ColorOutput "URL: http://localhost/$AppName/" "Cyan"
}

function Disable-App {
    param([string]$AppName)
    
    $appPath = Join-Path $script:APPS_DIR $AppName
    
    if (-not (Test-Path $appPath)) {
        Write-Error "Application '$AppName' introuvable"
        return
    }
    
    $configFile = Join-Path $appPath "config.json"
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    $config.enabled = $false
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configFile -Encoding UTF8
    
    Update-NginxConfig
    
    Write-Success "Application '$AppName' desactivee"
}

function Update-NginxConfig {
    $nginxConfPath = Join-Path $script:GEOFLOW_INSTALL_PATH "nginx\nginx.conf"
    
    if (-not (Test-Path $nginxConfPath)) {
        Write-Warning "Configuration NGINX introuvable"
        return
    }
    
    Write-Step "Mise a jour de la configuration NGINX..."
    
    $apps = Get-AppsList | Where-Object { $_.Enabled -eq $true }
    
    # Construire les blocs location pour chaque app
    $locationBlocks = ""
    foreach ($app in $apps) {
        $appPathInContainer = "/usr/share/nginx/html/apps/$($app.Name)"
        $locationBlocks += @"

        location /$($app.Name)/ {
            alias $appPathInContainer/;
            index index.html;
            try_files `$uri `$uri/ /index.html;
            
            # Headers pour le cache des assets statiques
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
"@
    }
    
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
$locationBlocks

        location / {
            return 200 "GeoFlow is running\n";
            add_header Content-Type text/plain;
        }
    }
}
"@
    
    [System.IO.File]::WriteAllText($nginxConfPath, $nginxConf, (New-Object System.Text.UTF8Encoding $false))
    
    Write-Success "Configuration NGINX mise a jour avec $($apps.Count) app(s)"
    
    # Recharger NGINX
    try {
        $installPath = $script:GEOFLOW_INSTALL_PATH
        Set-Location $installPath
        docker exec geoflow_nginx nginx -t 2>&1 | Out-Null
        docker exec geoflow_nginx nginx -s reload
        Write-Success "NGINX recharge avec succes"
    } catch {
        Write-Warning "Erreur lors du rechargement NGINX: $_"
        Write-ColorOutput "Redemarrez manuellement: docker restart geoflow_nginx" "Yellow"
    }
}

function Remove-App {
    param([string]$AppName)
    
    $appPath = Join-Path $script:APPS_DIR $AppName
    
    if (-not (Test-Path $appPath)) {
        Write-Error "Application '$AppName' introuvable"
        return
    }
    
    Write-Warning "`nSuppression de l'application '$AppName'"
    $confirm = Read-Host "Confirmer la suppression? (oui/non)"
    
    if ($confirm -eq 'oui') {
        Disable-App -AppName $AppName
        Remove-Item -Path $appPath -Recurse -Force
        Write-Success "Application supprimee"
    } else {
        Write-ColorOutput "Suppression annulee" "Yellow"
    }
}

function Show-Menu {
    Clear-Host
    Write-ColorOutput "`n========================================" "Cyan"
    Write-ColorOutput "    GEOFLOW - GESTIONNAIRE D'APPS" "Cyan"
    Write-ColorOutput "========================================`n" "Cyan"
    
    if ($script:GEOFLOW_INSTALL_PATH) {
        Write-ColorOutput "Installation GeoFlow: $script:GEOFLOW_INSTALL_PATH" "Gray"
        Write-ColorOutput "Repertoire apps: $script:APPS_DIR`n" "Gray"
    }
    
    Write-ColorOutput "1. Creer une nouvelle application" "White"
    Write-ColorOutput "2. Lister les applications" "White"
    Write-ColorOutput "3. Activer une application" "White"
    Write-ColorOutput "4. Desactiver une application" "White"
    Write-ColorOutput "5. Supprimer une application" "White"
    Write-ColorOutput "6. Ouvrir le repertoire d'une application" "White"
    Write-ColorOutput "Q. Quitter" "White"
    
    Write-Host ""
}

function Select-App {
    param([string]$Action)
    
    $apps = Get-AppsList
    
    if ($apps.Count -eq 0) {
        Write-Warning "Aucune application disponible"
        return $null
    }
    
    Write-ColorOutput "`n=== $Action ===" "Cyan"
    Write-Host ""
    Write-Host "  #  " "NOM".PadRight(20) "TITRE".PadRight(40) "STATUT" -ForegroundColor Cyan
    Write-Host "  " + ("-" * 80) -ForegroundColor Gray
    
    for ($i = 0; $i -lt $apps.Count; $i++) {
        $num = ($i + 1).ToString().PadLeft(3)
        $statusColor = if ($apps[$i].Enabled) { "Green" } else { "Gray" }
        $statusIcon = if ($apps[$i].Enabled) { "●" } else { "○" }
        $statusText = if ($apps[$i].Enabled) { "Active" } else { "Desactivee" }
        
        Write-Host "  $num " -NoNewline -ForegroundColor Yellow
        Write-Host $apps[$i].Name.PadRight(20) -NoNewline
        Write-Host $apps[$i].Title.PadRight(40) -NoNewline
        Write-Host "$statusIcon $statusText" -ForegroundColor $statusColor
    }
    
    Write-Host ""
    
    do {
        $choice = Read-Host "Choisissez un numero (ou 0 pour annuler)"
        
        if ($choice -eq "0") {
            return $null
        }
        
        $idx = [int]$choice - 1
        
        if ($idx -ge 0 -and $idx -lt $apps.Count) {
            return $apps[$idx]
        }
        
        Write-Warning "Choix invalide. Entrez un numero entre 1 et $($apps.Count)"
    } while ($true)
}

function Open-AppDirectory {
    param([string]$AppName)
    
    $appPath = Join-Path $script:APPS_DIR $AppName
    
    if (Test-Path $appPath) {
        Start-Process explorer $appPath
        Write-Success "Repertoire ouvert dans l'explorateur"
    } else {
        Write-Error "Application introuvable"
    }
}

try {
    Initialize-AppsDirectory
    
    if (-not ($List -or $Create -or $Enable -or $Disable -or $Remove)) {
        $Menu = $true
    }
    
    if ($Menu) {
        do {
            Show-Menu
            $choice = Read-Host "Choisissez une option"
            
            switch ($choice) {
                '1' {
                    New-GeoFlowApp
                    Wait-UserConfirmation
                }
                '2' {
                    Show-AppsList
                    Wait-UserConfirmation
                }
                '3' {
                    $app = Select-App -Action "Activer une application"
                    if ($app) {
                        Enable-App -AppName $app.Name
                    }
                    Wait-UserConfirmation
                }
                '4' {
                    $app = Select-App -Action "Desactiver une application"
                    if ($app) {
                        Disable-App -AppName $app.Name
                    }
                    Wait-UserConfirmation
                }
                '5' {
                    $app = Select-App -Action "Supprimer une application"
                    if ($app) {
                        Remove-App -AppName $app.Name
                    }
                    Wait-UserConfirmation
                }
                '6' {
                    $app = Select-App -Action "Ouvrir le repertoire"
                    if ($app) {
                        Open-AppDirectory -AppName $app.Name
                    }
                    Wait-UserConfirmation
                }
                'Q' {
                    Write-ColorOutput "`nAu revoir!" "Cyan"
                    exit 0
                }
                default {
                    Write-Warning "Option invalide"
                    Start-Sleep -Seconds 1
                }
            }
        } while ($choice -ne 'Q')
    } else {
        if ($List) { Show-AppsList }
        if ($Create) { New-GeoFlowApp }
        if ($Enable) { Enable-App -AppName $Enable }
        if ($Disable) { Disable-App -AppName $Disable }
        if ($Remove) { Remove-App -AppName $Remove }
    }
    
} catch {
    Write-ColorOutput "`n[ERREUR] $_" "Red"
    Write-ColorOutput "`nAssurez-vous que GeoFlow est installe avec geoflow-setup.ps1" "Yellow"
    Write-ColorOutput "Fichier de config cherche: $SETUP_CONFIG_FILE" "Gray"
    exit 1
}

Write-ColorOutput "`nScript termine.`n" "Green"