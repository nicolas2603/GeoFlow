/**
 * Geoflow Configuration Module
 * Default configuration and runtime config storage
 * Actual configuration should be loaded from config.json
 */

const GeoflowConfig = {
    // App configuration (loaded from config.json)
    app: {},

    // Theme configuration (loaded from config.json)
    theme: {},

    // Map configuration (default values, overridden by config.json)
    map: {
        center: [43.6108, 3.8767],
        zoom: 10,
        minZoom: 3,
        maxZoom: 19,
        baseLayers: {
            // Default fallback if config.json not available
            osm: {
                name: 'OpenStreetMap',
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                preview: 'assets/osm.png',
                attribution: '© OpenStreetMap',
                maxZoom: 19,
                default: true
            }
        }
    },

    // API endpoints (loaded from config.json)
    api: {},

    // Layers configuration (loaded from config.json)
    layersConfig: {},
    
    // Features configuration (loaded from config.json)
    featuresConfig: {},

    // Legend definitions (loaded from config.json or defaults)
    legends: {
        'points': {
            type: 'categorized',
            items: [
                { symbol: 'point', color: '#e74c3c', label: 'Monument' },
                { symbol: 'point', color: '#3498db', label: 'Culture' },
                { symbol: 'point', color: '#2ecc71', label: 'Parc' },
                { symbol: 'point', color: '#f39c12', label: 'Transport' }
            ]
        },
        'zones': {
            type: 'simple',
            items: [
                { symbol: 'polygon', color: '#2563eb', label: 'Centre-ville' }
            ]
        },
        'natura2000': {
            type: 'categorized',
            items: [
                { symbol: 'polygon', color: '#8e44ad', label: 'ZPS - Directive oiseaux' },
                { symbol: 'polygon', color: '#16a085', label: 'ZSC - Directive habitats' },
                { symbol: 'polygon', color: '#f39c12', label: 'Zone tampon' },
                { symbol: 'line', color: '#c0392b', label: 'Limites' }
            ]
        }
    },

    // Demo data
    demoData: {
        points: [
            { lat: 43.6108, lng: 3.8767, name: 'Place de la Comédie', type: 'Monument' },
            { lat: 43.6119, lng: 3.8738, name: 'Musée Fabre', type: 'Culture' },
            { lat: 43.6097, lng: 3.8720, name: "Arc de Triomphe", type: 'Monument' },
            { lat: 43.6142, lng: 3.8720, name: 'Jardin des Plantes', type: 'Parc' },
            { lat: 43.6205, lng: 3.8597, name: 'Zoo de Lunaret', type: 'Loisirs' },
            { lat: 43.6047, lng: 3.8942, name: 'Gare Saint-Roch', type: 'Transport' }
        ],
        zone: {
            coordinates: [
                [43.615, 3.865],
                [43.615, 3.885],
                [43.605, 3.885],
                [43.605, 3.865]
            ],
            name: 'Centre-ville',
            color: '#2563eb',
            fillOpacity: 0.2
        }
    },
	
	/**
     * Helper to get feature status with fallback to true
     * @param {string} featureName - Name of the feature
     * @returns {boolean}
     */
    isFeatureEnabled: function(featureName) {
        if (!this.featuresConfig || Object.keys(this.featuresConfig).length === 0) {
            return true; // Default to enabled if config not loaded
        }
        return this.featuresConfig[featureName] !== false;
    }
};