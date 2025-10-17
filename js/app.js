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

        // Setup action buttons
        this.initActionButtons();

        // Setup keyboard shortcuts
        this.initKeyboardShortcuts();

        // Hide loading screen
        setTimeout(() => {
            GeoflowUtils.hideLoading();
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

        const root = document.documentElement;
        const colors = GeoflowConfig.theme.colors;

        // Apply primary color (light mode)
        if (colors.primary) {
            root.style.setProperty('--primary', colors.primary);
            //console.log(`✅ Primary color set to: ${colors.primary}`);
        }

        // Apply secondary color (optional)
        if (colors.secondary) {
            root.style.setProperty('--secondary', colors.secondary);
            //console.log(`✅ Secondary color set to: ${colors.secondary}`);
        }

        // Apply accent color (optional)
        if (colors.accent) {
            root.style.setProperty('--accent', colors.accent);
            //console.log(`✅ Accent color set to: ${colors.accent}`);
        }

        // Apply success color (optional)
        if (colors.success) {
            root.style.setProperty('--success', colors.success);
        }

        // Apply warning color (optional)
        if (colors.warning) {
            root.style.setProperty('--warning', colors.warning);
        }

        // Apply error color (optional)
        if (colors.error) {
            root.style.setProperty('--error', colors.error);
        }

        // Apply dark mode primary color if defined
        if (colors.primaryDark) {
            this.applyDarkThemeColor('--primary', colors.primaryDark);
            //console.log(`✅ Dark primary color set to: ${colors.primaryDark}`);
        }

        // Apply dark mode secondary color if defined
        if (colors.secondaryDark) {
            this.applyDarkThemeColor('--secondary', colors.secondaryDark);
        }
    },

    /**
     * Apply color specifically for dark mode
     * @param {string} property - CSS variable name
     * @param {string} value - Color value
     */
    applyDarkThemeColor(property, value) {
        // Find or create dark theme style element
        let darkThemeStyle = document.getElementById('geoflow-dark-theme');
        
        if (!darkThemeStyle) {
            darkThemeStyle = document.createElement('style');
            darkThemeStyle.id = 'geoflow-dark-theme';
            document.head.appendChild(darkThemeStyle);
        }

        // Get existing rules
        let rules = darkThemeStyle.sheet ? 
            Array.from(darkThemeStyle.sheet.cssRules).map(rule => rule.cssText) : [];
        
        // Check if dark theme rule exists
        let darkRuleIndex = rules.findIndex(rule => rule.includes('[data-theme="dark"]'));
        
        if (darkRuleIndex === -1) {
            // Create new dark theme rule
            darkThemeStyle.sheet.insertRule(`[data-theme="dark"] { ${property}: ${value}; }`, 0);
        } else {
            // Update existing rule
            const existingRule = darkThemeStyle.sheet.cssRules[darkRuleIndex];
            existingRule.style.setProperty(property, value);
        }
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