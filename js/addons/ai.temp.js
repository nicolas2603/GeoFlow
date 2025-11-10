/**
 * Geoflow Layer Search Module
 * Recherche de couches en langage naturel avec apprentissage
 */

const GeoflowLayerSearch = {
    
    init() {
        // Le module est prêt, l'UI sera créée via getPanelContent()
        //console.log('✅ Layer Search initialized');
    },
    
    /**
     * Get panel content for AI search
     */
    getPanelContent() {
        return `
            <!-- Header avec description -->
            <div style="margin-bottom: 16px; padding: 12px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1)); border-radius: 8px; border-left: 3px solid var(--primary);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary); font-size: 1.1rem;"></i>
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">
                        Recherche intelligente
                    </span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                    En construction
                </p>
            </div>
        `;
    },
    
    /**
     * Attach listeners
     */
    attachListeners() {
        
    }
};