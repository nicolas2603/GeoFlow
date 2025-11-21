/**
 * Geoflow Configuration Module
 * Default configuration and runtime config storage
 * Actual configuration should be loaded from config.json
 */

const GeoflowConfig = {
    // App configuration (loaded from config.json, overridden by config.json)
    app: {
		title: 'Geoflow',
		version: '1.0'
	},

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

    // Legend configuration (loaded from config.json)
    legends: {},
	
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