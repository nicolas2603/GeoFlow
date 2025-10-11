/**
 * GeoFlow Tools Module
 * Handles miscellaneous tools and utilities
 */

const GeoFlowTools = {
    /**
     * Get tools panel content HTML
     */
    getPanelContent() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return `
            <div class="tool-grid">
                <div class="tool-card" data-tool="theme" id="theme-toggle">
                    <i class="bi bi-${isDark ? 'sun-fill' : 'moon-stars-fill'}"></i>
                    <div class="tool-card-label">${isDark ? 'Clair' : 'Sombre'}</div>
                </div>
                <div class="tool-card" data-tool="screenshot">
                    <i class="bi bi-camera"></i>
                    <div class="tool-card-label">Capture</div>
                </div>
                <div class="tool-card" data-tool="share">
                    <i class="bi bi-share"></i>
                    <div class="tool-card-label">Partager</div>
                </div>
                <div class="tool-card" data-tool="print">
                    <i class="bi bi-printer"></i>
                    <div class="tool-card-label">Imprimer</div>
                </div>
                <div class="tool-card" data-tool="help">
                    <i class="bi bi-question-circle"></i>
                    <div class="tool-card-label">Aide</div>
                </div>
                <div class="tool-card" data-tool="export">
                    <i class="bi bi-download"></i>
                    <div class="tool-card-label">Export</div>
                </div>
            </div>

            <div style="margin-top: 16px; padding: 10px; background: var(--hover-bg); border-radius: 6px;">
                <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 6px;">À propos</div>
                <p style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                    <strong style="font-size: 0.8rem;">GeoFlow v1.0</strong><br>
                    Visualiseur WebSIG open source<br>
                    Leaflet + Bootstrap + PostGIS
                </p>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        document.querySelectorAll('[data-tool]').forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.dataset.tool;
                this.handleToolAction(tool);
            });
        });
    },

    /**
     * Handle tool action
     * @param {string} tool - Tool identifier
     */
    handleToolAction(tool) {
        switch(tool) {
            case 'theme':
                const newTheme = GeoFlowUtils.toggleTheme();
                // Refresh panel content to update icon
                if (GeoFlowPanels.currentPanel === 'tools') {
                    const content = document.getElementById('panel-content');
                    content.innerHTML = this.getPanelContent();
                    this.attachListeners();
                }
                break;
            case 'screenshot':
                GeoFlowUtils.showToast('Utilisez Ctrl+Shift+S pour capturer', 'info');
                break;
            case 'share':
                GeoFlowUtils.copyToClipboard(window.location.href);
                GeoFlowUtils.showToast('Lien copié', 'success');
                break;
            case 'print':
                window.print();
                break;
            case 'export':
                GeoFlowDraw.exportGeoJSON();
                break;
            case 'help':
                GeoFlowUtils.showToast('Documentation : docs.geoflow.io', 'info');
                break;
        }
    }
};