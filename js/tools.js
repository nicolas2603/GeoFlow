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
        const logoPath = GeoFlowConfig.theme.logo || 'assets/logo.png';
        
        return `
            <div class="tool-grid">
                <div class="tool-card" data-tool="theme" id="theme-toggle">
                    <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}"></i>
                    <div class="tool-card-label">${isDark ? 'Clair' : 'Sombre'}</div>
                </div>
                <div class="tool-card" data-tool="screenshot">
                    <i class="fa-solid fa-camera"></i>
                    <div class="tool-card-label">Capture</div>
                </div>
                <div class="tool-card" data-tool="share">
                    <i class="fa-solid fa-share-nodes"></i>
                    <div class="tool-card-label">Partager</div>
                </div>
                <div class="tool-card" data-tool="print">
                    <i class="fa-solid fa-print"></i>
                    <div class="tool-card-label">Imprimer</div>
                </div>
                <div class="tool-card" data-tool="help">
                    <i class="fa-solid fa-circle-question"></i>
                    <div class="tool-card-label">Aide</div>
                </div>
                <div class="tool-card" data-tool="export">
                    <i class="fa-solid fa-download"></i>
                    <div class="tool-card-label">Export</div>
                </div>
            </div>

            <div style="margin-top: 16px; padding: 12px; background: var(--hover-bg); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                <img src="${logoPath}" alt="GeoFlow" style="width: 77px; height: 77px; flex-shrink: 0; object-fit: contain;" onerror="this.style.display='none'">
                <div style="flex: 1;">
                    <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 6px;">À propos</div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                        <strong style="font-size: 0.8rem;">GeoFlow v1.0</strong><br>
                        Visualiseur WebSIG open source<br>
                        Leaflet + Bootstrap + PostGIS
                    </p>
                </div>
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
                if (GeoFlowConfig.isFeatureEnabled('draw')) {
                    GeoFlowDraw.exportGeoJSON();
                } else {
                    GeoFlowUtils.showToast('Fonctionnalité de dessin désactivée', 'warning');
                }
                break;
            case 'help':
                GeoFlowUtils.showToast('Documentation : docs.geoflow.io', 'info');
                break;
        }
    }
};