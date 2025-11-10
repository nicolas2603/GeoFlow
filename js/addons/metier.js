/**
 * Geoflow Metier Module
 * Handles Metier tools and utilities
 */

const GeoflowMetier = {
    /**
     * Get Metier panel content HTML
     */
    getPanelContent() {
        return `
            <div class="tool-grid">
                <div class="tool-card" data-tool="calepinage">
                    <i class="fa-solid fa-grip"></i>
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
        // Pass 'metier' as parent panel for automatic sub-panel registration
        GeoflowPanels.showPanel(tool, 'metier');
    }
};