/**
 * Geoflow Map Module
 * Handles map initialization and base layers
 */

const GeoflowMap = {
    map: null,
    baseLayers: {},
    currentBasemap: null,

    /**
     * Initialize the map
     */
    init() {
        // Create map instance
        this.map = L.map('map', { zoomControl: false })
            .setView(GeoflowConfig.map.center, GeoflowConfig.map.zoom);

        // Load base layers from config
        this.loadBaseLayers();

        // Add event listeners
        this.map.on('moveend', () => this.updateStats());

        GeoflowUtils.showToast('Geoflow prêt', 'success');
        
        return this.map;
    },

    /**
     * Load base layers from configuration
     */
    loadBaseLayers() {
        const baseLayers = GeoflowConfig.map.baseLayers;
        let defaultLayer = null;

        Object.entries(baseLayers).forEach(([key, config]) => {
            let layer;
            
            // Support différents types de couches
            if (config.type === 'wmts') {
                // Service WMTS
                layer = L.tileLayer(config.url, {
                    attribution: config.attribution || '',
                    maxZoom: config.maxZoom || 18,
                    minZoom: config.minZoom || 0,
                    tileSize: config.tileSize || 256,
                    crossOrigin: true
                });
                // console.log(`✅ WMTS layer created: ${config.name}`);
            } else if (config.type === 'wms') {
                // Service WMS
                layer = L.tileLayer.wms(config.url, {
                    layers: config.layers || '',
                    format: config.format || 'image/png',
                    transparent: config.transparent !== false,
                    attribution: config.attribution || '',
                    maxZoom: config.maxZoom || 18
                });
                // console.log(`✅ WMS layer created: ${config.name}`);
            } else {
                // Service Tile standard (OSM, etc.)
                layer = L.tileLayer(config.url, {
                    attribution: config.attribution,
                    maxZoom: config.maxZoom
                });
                // console.log(`✅ Tile layer created: ${config.name}`);
            }

            this.baseLayers[key] = layer;

            if (config.default) {
                defaultLayer = key;
                this.currentBasemap = key;
                layer.addTo(this.map);
            }
        });

        // If no default, use first layer
        if (!defaultLayer) {
            const firstKey = Object.keys(baseLayers)[0];
            this.currentBasemap = firstKey;
            this.baseLayers[firstKey].addTo(this.map);
        }
    },

    /**
     * Switch basemap
     * @param {string} type - Basemap type (osm, satellite, topo, positron, darkmatter, etc.)
     */
    switchBasemap(type) {
        Object.values(this.baseLayers).forEach(layer => this.map.removeLayer(layer));
        
        if (this.baseLayers[type]) {
            this.map.addLayer(this.baseLayers[type]);
            this.currentBasemap = type;
            
            const layerConfig = GeoflowConfig.map.baseLayers[type];
            GeoflowUtils.showToast(`Fond: ${layerConfig.name}`, 'success');
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
        this.map.setView(GeoflowConfig.map.center, GeoflowConfig.map.zoom);
        GeoflowUtils.showToast('Vue initiale', 'success');
    },

    /**
     * Locate user position
     */
    locateUser() {
        if (!navigator.geolocation) {
            GeoflowUtils.showToast('Géolocalisation non supportée', 'error');
            return;
        }

        GeoflowUtils.showLoadingOverlay();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                GeoflowUtils.hideLoadingOverlay();
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                this.map.setView([lat, lng], 16);
                
                L.marker([lat, lng]).addTo(this.map)
                    .bindPopup('<div class="feature-popup"><h6>Votre position</h6></div>')
                    .openPopup();
                
                GeoflowUtils.showToast('Position localisée', 'success');
            },
            () => {
                GeoflowUtils.hideLoadingOverlay();
                GeoflowUtils.showToast('Impossible de localiser', 'error');
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
        const statLat = document.getElementById('stat-lat');
        const statLng = document.getElementById('stat-lng');

        if (statLat) statLat.textContent = this.map.getCenter().lat.toFixed(4);
        if (statLng) statLng.textContent = this.map.getCenter().lng.toFixed(4);
    }
};