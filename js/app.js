/**
 * Geoflow Main Application
 * Entry point and initialization
 */

const GeoflowApp = {
    /**
     * Initialize the application
     */
    async init() {
        // Load saved theme
        GeoflowUtils.loadTheme();

        // Load config from JSON if available
        await this.loadConfig();

        // Apply theme colors from config
        this.applyThemeColors();

        // Update loading text with app title
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = `Chargement de l'application ${GeoflowConfig.app.title}`;
        }

        // Simulate minimum loading time for better UX
        await new Promise(resolve => setTimeout(resolve, 800));

        // Apply feature configuration AFTER config is loaded
        this.applyFeatureConfig();

        // Initialize all modules
        GeoflowMap.init();
        GeoflowLayers.init();
		GeoflowExternalSources.init();
        GeoflowLayerSearch.init();
		
        if (GeoflowConfig.isFeatureEnabled('draw')) {
            GeoflowDraw.init();
        }

        if (GeoflowConfig.isFeatureEnabled('measure')) {
            GeoflowMeasure.init();
        }

        if (GeoflowConfig.isFeatureEnabled('search')) {
            GeoflowSearch.init();
        }

        GeoflowBasemap.init();
        GeoflowPanels.init();
        GeoflowLegend.init();

        // Setup action buttons
        this.initActionButtons();

        // Setup keyboard shortcuts
        this.initKeyboardShortcuts();

        // Hide loading screen
        setTimeout(() => {
            GeoflowUtils.hideLoading();
            
            if (typeof GeoflowShare !== 'undefined') {
                GeoflowShare.applySharedContext();
            }
        }, 300);

        console.log('✅ Geoflow initialized successfully');
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
                    GeoflowConfig.theme = config.theme;
                    GeoflowConfig.app.title = config.theme.title.split(' - ')[0] || 'Geoflow';
                    GeoflowConfig.app.version = config.theme.version.split(' - ')[0] || '1.0';
                    
                    // Update title in HTML
                    document.title = GeoflowConfig.app.title;
                    const brandTitle = document.querySelector('.command-bar-title');
                    if (brandTitle) {
                        brandTitle.textContent = GeoflowConfig.app.title;
                    }
                }
                if (config.map) {
                    GeoflowConfig.map = { ...GeoflowConfig.map, ...config.map };
                }
                if (config.layers) {
                    GeoflowConfig.layersConfig = config.layers;
                }
                if (config.legends) {
                    GeoflowConfig.legends = { ...GeoflowConfig.legends, ...config.legends };
                }
                if (config.features) {
                    GeoflowConfig.featuresConfig = config.features;
                }
                
                console.log('✅ Configuration loaded from config.json');
            }
        } catch (error) {
            console.warn('⚠️ Could not load config.json, using default configuration');
        }
    },

    /**
     * Apply theme colors from config.json to CSS variables
     */
    applyThemeColors() {
        if (!GeoflowConfig.theme || !GeoflowConfig.theme.colors) {
            console.log('ℹ️ No theme colors defined in config.json, using defaults');
            return;
        }

        const colors = GeoflowConfig.theme.colors;

        // Create or get style element for custom theme
        let themeStyle = document.getElementById('geoflow-custom-theme');
        if (!themeStyle) {
            themeStyle = document.createElement('style');
            themeStyle.id = 'geoflow-custom-theme';
            document.head.appendChild(themeStyle);
        }

        // Build CSS rules
        let cssRules = ':root {\n';
        
        // Light mode colors
        if (colors.primary) {
            cssRules += `  --primary: ${colors.primary};\n`;
        }
        if (colors.primaryText) {
            cssRules += `  --text-primary: ${colors.primaryText};\n`;
        }
        
        cssRules += '}\n\n';
        
        // Dark mode colors
        cssRules += '[data-theme="dark"] {\n';
        
        if (colors.primaryDark) {
            cssRules += `  --primary: ${colors.primaryDark};\n`;
        } else if (colors.primary) {
            // Fallback to light primary if dark not specified
            cssRules += `  --primary: ${colors.primary};\n`;
        }
        
        // In dark mode, text-primary is already defined in theme.css
        // Only override if specifically provided
        if (colors.primaryTextDark) {
            cssRules += `  --text-primary: ${colors.primaryTextDark};\n`;
        }
        
        cssRules += '}\n';
        
        // Apply the CSS
        themeStyle.textContent = cssRules;
    },

    /**
     * Apply feature configuration by hiding disabled features
     */
    applyFeatureConfig() {
        // Hide draw button if disabled
        if (!GeoflowConfig.isFeatureEnabled('draw')) {
            const btnDraw = document.getElementById('btn-draw');
            if (btnDraw) btnDraw.style.display = 'none';
        }

        // Hide measure button if disabled
        if (!GeoflowConfig.isFeatureEnabled('measure')) {
            const btnMeasure = document.getElementById('btn-measure');
            if (btnMeasure) btnMeasure.style.display = 'none';
        }

        // Hide geolocation button if disabled
        if (!GeoflowConfig.isFeatureEnabled('geolocation')) {
            const btnLocate = document.getElementById('btn-locate');
            if (btnLocate) btnLocate.style.display = 'none';
        }

        // Hide legend button if disabled
        if (!GeoflowConfig.isFeatureEnabled('legend')) {
            const btnLegend = document.getElementById('btn-legend');
            if (btnLegend) btnLegend.style.display = 'none';
        }

        // Hide layers button if disabled
        if (!GeoflowConfig.isFeatureEnabled('layers')) {
            const btnLayers = document.getElementById('btn-layers');
            if (btnLayers) btnLayers.style.display = 'none';
        }

        // Hide tools button if disabled
        if (!GeoflowConfig.isFeatureEnabled('tools')) {
            const btnTools = document.getElementById('btn-tools');
            if (btnTools) btnTools.style.display = 'none';
        }

        // Hide search bar if disabled
        if (!GeoflowConfig.isFeatureEnabled('search')) {
            const searchBar = document.querySelector('.search-bar');
            if (searchBar) searchBar.style.display = 'none';
        }
    },

    /**
     * Initialize action buttons
     */
    initActionButtons() {
        if (GeoflowConfig.isFeatureEnabled('geolocation')) {
            const btnLocate = document.getElementById('btn-locate');
            if (btnLocate) {
                btnLocate.addEventListener('click', () => {
                    GeoflowMap.locateUser();
                });
            }
        }

        const btnFullscreen = document.getElementById('btn-fullscreen');
        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => {
                GeoflowMap.toggleFullscreen();
            });
        }

        const btnHome = document.getElementById('btn-home');
        if (btnHome) {
            btnHome.addEventListener('click', () => {
                GeoflowMap.resetView();
            });
        }
    },

    /**
     * Initialize keyboard shortcuts
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC - Close panel
            if (e.key === 'Escape') {
                GeoflowPanels.closePanel();
            }
            
            // Ctrl+F - Focus search
            if (GeoflowConfig.isFeatureEnabled('search') && e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.focus();
            }
            
            // Ctrl+H - Home view
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                GeoflowMap.resetView();
            }
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GeoflowApp.init();
});