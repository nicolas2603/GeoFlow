/**
 * GeoFlow Main Application
 * Entry point and initialization
 */

const GeoFlowApp = {
    /**
     * Initialize the application
     */
    init() {
        // Load saved theme
        GeoFlowUtils.loadTheme();

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

        console.log('GeoFlow initialized successfully');
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