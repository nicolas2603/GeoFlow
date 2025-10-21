/**
 * Geoflow ENR Module
 * Handles ENR tools and utilities
 */

const GeoflowEnr = {
    /**
     * Get ENR panel content HTML
     */
    getPanelContent() {
        return `
            <div class="tool-grid">
                <div class="tool-card" data-tool="calepinage">
                    <i class="fa-solid fa-solar-panel"></i>
                    <div class="tool-card-label">Calepinage</div>
                </div>
                <div class="tool-card" data-tool="foncier">
                    <i class="fa-solid fa-object-ungroup"></i>
                    <div class="tool-card-label">Foncier</div>
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
            case 'calepinage':
                GeoflowPanels.showPanel('calepinage');
                break;
            case 'foncier':
                GeoflowUtils.showToast('Foncier', 'info');
                break;
        }
    }
};