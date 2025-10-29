/**
 * Geoflow Tools Module
 * Handles miscellaneous tools and utilities
 */

const GeoflowTools = {
    /**
     * Get tools panel content HTML
     */
    getPanelContent() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const logoPath = GeoflowConfig.theme.logo || 'assets/logo.png';
        
        return `
            <div class="tool-grid">
                <div class="tool-card" data-tool="share">
                    <i class="fa-solid fa-share-nodes"></i>
                    <div class="tool-card-label">Partager</div>
                </div>
                <div class="tool-card" data-tool="export">
                    <i class="fa-solid fa-image"></i>
                    <div class="tool-card-label">Exporter</div>
                </div>
                <div class="tool-card" data-tool="print">
                    <i class="fa-solid fa-print"></i>
                    <div class="tool-card-label">Imprimer</div>
                </div>
				<div class="tool-card" data-tool="theme" id="theme-toggle">
                    <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}"></i>
                    <div class="tool-card-label">${isDark ? 'Clair' : 'Sombre'}</div>
                </div>
                <div class="tool-card" data-tool="help">
                    <i class="fa-solid fa-circle-question"></i>
                    <div class="tool-card-label">Aide</div>
                </div>
            </div>

            <div style="margin-top: 16px; padding: 12px; background: var(--hover-bg); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                <img src="${logoPath}" alt="Geoflow" style="width: 77px; height: 77px; flex-shrink: 0; object-fit: contain;" onerror="this.style.display='none'">
                <div style="flex: 1;">
                    <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 6px;">À propos</div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                        <strong style="font-size: 0.8rem;">${GeoflowConfig.app.title} v${GeoflowConfig.app.version}</strong><br>
                        Application WebSIG<br>
                        <i class="fa-solid fa-location-dot"></i> Leaflet + Bootstrap + Postgis
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
                const newTheme = GeoflowUtils.toggleTheme();
                if (GeoflowPanels.currentPanel === 'tools') {
                    const content = document.getElementById('panel-content');
                    content.innerHTML = this.getPanelContent();
                    this.attachListeners();
                }
                break;
            case 'screenshot':
                GeoflowUtils.showToast('Utilisez Ctrl+Shift+S pour capturer', 'info');
                break;
            case 'share':
                GeoflowPanels.showPanel('share', 'tools');
                break;
            case 'print':
                GeoflowPanels.showPanel('print', 'tools');
                break;
            case 'export':
                GeoflowPanels.showPanel('export', 'tools');
                break;
            case 'help':
                GeoflowUtils.showToast('Documentation : docs.geoflow.io', 'info');
                break;
        }
    }
};