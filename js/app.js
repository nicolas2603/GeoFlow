/**
 * GeoFlow Main Application
 * Entry point and initialization
 */

const GeoFlowApp = {
    /**
     * Initialize the application
     */
    async init() {
        // Load saved theme
        GeoFlowUtils.loadTheme();

        // Load config from JSON if available
        await this.loadConfig();

        // Update loading text with app title
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = `Chargement de l'application ${GeoFlowConfig.app.title}`;
        }

        // Simulate minimum loading time for better UX
        await new Promise(resolve => setTimeout(resolve, 800));

        // Apply feature configuration AFTER config is loaded
        this.applyFeatureConfig();

        // Initialize all modules
        GeoFlowMap.init();
        GeoFlowLayers.init();
        
        if (GeoFlowConfig.isFeatureEnabled('draw')) {
            GeoFlowDraw.init();
        }
        
        if (GeoFlowConfig.isFeatureEnabled('search')) {
            GeoFlowSearch.init();
        }
        
        GeoFlowBasemap.init();
        GeoFlowPanels.init();

        // Setup action buttons
        this.initActionButtons();

        // Setup keyboard shortcuts
        this.initKeyboardShortcuts();

        // Hide loading screen
        setTimeout(() => {
            GeoFlowUtils.hideLoading();
        }, 300);

        console.log('GeoFlow initialized successfully');
    },

    /**
     * Load configuration from config.json
     */
    async loadConfig() {
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                const config = await response.json();
                
                // Store full config
                if (config.theme) {
                    GeoFlowConfig.theme = config.theme;
                    GeoFlowConfig.app.title = config.theme.title.split(' - ')[0] || 'GeoFlow';
                }
                if (config.map) {
                    GeoFlowConfig.map = { ...GeoFlowConfig.map, ...config.map };
                }
                if (config.layers) {
                    GeoFlowConfig.layersConfig = config.layers;
                }
                if (config.legends) {
                    GeoFlowConfig.legends = { ...GeoFlowConfig.legends, ...config.legends };
                }
                if (config.features) {
                    GeoFlowConfig.featuresConfig = config.features;
                }
                
                console.log('Configuration loaded from config.json');
            }
        } catch (error) {
            console.warn('Could not load config.json, using default configuration');
        }
    },

    /**
     * Apply feature configuration by hiding disabled features
     */
    applyFeatureConfig() {
        // Hide draw button if disabled
        if (!GeoFlowConfig.isFeatureEnabled('draw')) {
            const btnDraw = document.getElementById('btn-draw');
            if (btnDraw) btnDraw.style.display = 'none';
        }

        // Hide measure button if disabled
        if (!GeoFlowConfig.isFeatureEnabled('measure')) {
            const btnMeasure = document.getElementById('btn-measure');
            if (btnMeasure) btnMeasure.style.display = 'none';
        }

        // Hide geolocation button if disabled
        if (!GeoFlowConfig.isFeatureEnabled('geolocation')) {
            const btnLocate = document.getElementById('btn-locate');
            if (btnLocate) btnLocate.style.display = 'none';
        }

        // Hide legend button if disabled
        if (!GeoFlowConfig.isFeatureEnabled('legend')) {
            const btnLegend = document.getElementById('btn-legend');
            if (btnLegend) btnLegend.style.display = 'none';
        }

        // Hide layers button if disabled
        if (!GeoFlowConfig.isFeatureEnabled('layers')) {
            const btnLayers = document.getElementById('btn-layers');
            if (btnLayers) btnLayers.style.display = 'none';
        }

        // Hide tools button if disabled
        if (!GeoFlowConfig.isFeatureEnabled('tools')) {
            const btnTools = document.getElementById('btn-tools');
            if (btnTools) btnTools.style.display = 'none';
        }

        // Hide search bar if disabled
        if (!GeoFlowConfig.isFeatureEnabled('search')) {
            const searchBar = document.querySelector('.search-bar');
            if (searchBar) searchBar.style.display = 'none';
        }
    },

    /**
     * Initialize action buttons
     */
    initActionButtons() {
        if (GeoFlowConfig.isFeatureEnabled('geolocation')) {
            const btnLocate = document.getElementById('btn-locate');
            if (btnLocate) {
                btnLocate.addEventListener('click', () => {
                    GeoFlowMap.locateUser();
                });
            }
        }

        document.getElementById('btn-fullscreen').addEventListener('click', () => {
            GeoFlowMap.toggleFullscreen();
        });

        document.getElementById('btn-home').addEventListener('click', () => {
            GeoFlowMap.resetView();
        });
    },

    /**
     * Initialize keyboard shortcuts
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC - Close panel
            if (e.key === 'Escape') {
                GeoFlowPanels.closePanel();
            }
            
            // Ctrl+F - Focus search
            if (GeoFlowConfig.isFeatureEnabled('search') && e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
            
            // Ctrl+H - Home view
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                GeoFlowMap.resetView();
            }
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GeoFlowApp.init();
});