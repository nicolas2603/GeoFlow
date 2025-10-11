/**
 * GeoFlow Map Module
 * Handles map initialization and base layers
 */

const GeoFlowMap = {
    map: null,
    baseLayers: {},
    currentBasemap: 'osm',

    /**
     * Initialize the map
     */
    init() {
        // Create map instance
        this.map = L.map('map', { zoomControl: false })
            .setView(GeoFlowConfig.map.center, GeoFlowConfig.map.zoom);

        // Add base layers
        this.baseLayers['OSM'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(this.map);

        this.baseLayers['Satellite'] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        });

        this.baseLayers['Topo'] = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap'
        });

        this.baseLayers['Positron'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            attribution: '© Carto'
        });

        this.baseLayers['DarkMatter'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            attribution: '© Carto'
        });

        // Add event listeners
        this.map.on('moveend', () => this.updateStats());

        GeoFlowUtils.showToast('GeoFlow prêt', 'success');
        
        return this.map;
    },

    /**
     * Switch basemap
     * @param {string} type - Basemap type (osm, satellite, topo, positron, darkmatter)
     */
    switchBasemap(type) {
        Object.values(this.baseLayers).forEach(layer => this.map.removeLayer(layer));
        
        const layerMap = {
            'osm': 'OSM',
            'satellite': 'Satellite',
            'topo': 'Topo',
            'positron': 'Positron',
            'darkmatter': 'DarkMatter'
        };
        
        const layerName = layerMap[type];
        if (this.baseLayers[layerName]) {
            this.map.addLayer(this.baseLayers[layerName]);
            this.currentBasemap = type;
            
            const clickedItem = document.querySelector(`[data-basemap="${type}"]`);
            const tooltip = clickedItem ? clickedItem.querySelector('.tooltip-custom').textContent : layerName;
            GeoFlowUtils.showToast(`Fond: ${tooltip}`, 'success');
        }
    },

    /**
     * Get current map center and zoom
     */
    getView() {
        return {
            center: this.map.getCenter(),
            zoom: this.map.getZoom()
        };
    },

    /**
     * Set map view
     * @param {Array} center - [lat, lng]
     * @param {number} zoom - Zoom level
     */
    setView(center, zoom) {
        this.map.setView(center, zoom);
    },

    /**
     * Reset to initial view
     */
    resetView() {
        this.map.setView(GeoFlowConfig.map.center, GeoFlowConfig.map.zoom);
        GeoFlowUtils.showToast('Vue initiale', 'success');
    },

    /**
     * Locate user position
     */
    locateUser() {
        if (!navigator.geolocation) {
            GeoFlowUtils.showToast('Géolocalisation non supportée', 'error');
            return;
        }

        GeoFlowUtils.showLoading();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                GeoFlowUtils.hideLoading();
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                this.map.setView([lat, lng], 16);
                
                L.marker([lat, lng]).addTo(this.map)
                    .bindPopup('<div class="feature-popup"><h6>Votre position</h6></div>')
                    .openPopup();
                
                GeoFlowUtils.showToast('Position localisée', 'success');
            },
            () => {
                GeoFlowUtils.hideLoading();
                GeoFlowUtils.showToast('Impossible de localiser', 'error');
            }
        );
    },

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    },

    /**
     * Update map statistics
     */
    updateStats() {
        const statZoom = document.getElementById('stat-zoom');
        const statLat = document.getElementById('stat-lat');
        const statLng = document.getElementById('stat-lng');

        if (statZoom) statZoom.textContent = this.map.getZoom();
        if (statLat) statLat.textContent = this.map.getCenter().lat.toFixed(4);
        if (statLng) statLng.textContent = this.map.getCenter().lng.toFixed(4);
    }
};