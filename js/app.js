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
            loadingText.textContent = `Chargement de ${GeoFlowConfig.app.title}`;
        }

        // Simulate minimum loading time for better UX
        await new Promise(resolve => setTimeout(resolve, 800));

        // Initialize all modules
        GeoFlowMap.init();
        GeoFlowLayers.init();
        GeoFlowDraw.init();
        GeoFlowSearch.init();
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
                
                console.log('Configuration loaded from config.json');
            }
        } catch (error) {
            console.warn('Could not load config.json, using default configuration');
        }
    },

    /**
     * Initialize action buttons
     */
    initActionButtons() {
        document.getElementById('btn-locate').addEventListener('click', () => {
            GeoFlowMap.locateUser();
        });

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
            if (e.ctrlKey && e.key === 'f') {
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