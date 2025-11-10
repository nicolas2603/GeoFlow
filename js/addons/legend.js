/**
 * Geoflow Legend Module - VERSION AMÉLIORÉE
 * Centralized legend management system with external layer support
 * 
 * AMÉLIORATIONS:
 * - Support des légendes d'images (WMS GetLegendGraphic)
 * - Intégration des couches externes dans la légende
 * - Meilleur rendu dans le widget, l'aperçu et l'impression
 */

const GeoflowLegend = {
    legendSources: new Map(),
    widget: null,
    widgetContent: null,
    isActive: false,

    /**
     * Initialize legend system
     */
    init() {
        this.widget = document.getElementById('legend-widget');
        this.widgetContent = document.getElementById('legend-widget-content');

        // Register built-in legend sources
        this.registerSource('layers', () => this.getLayersLegend());
        this.registerSource('draw', () => this.getDrawLegend());
        this.registerSource('measure', () => this.getMeasureLegend());

        // Listen for legend updates from other modules
        document.addEventListener('geoflow:legend-update', () => {
            this.updateWidget();
        });
    },

    /**
     * Register a legend source
     * @param {string} sourceId - Unique identifier for the source
     * @param {Function} provider - Function that returns legend data
     */
    registerSource(sourceId, provider) {
        this.legendSources.set(sourceId, provider);
    },

    /**
     * Unregister a legend source
     * @param {string} sourceId - Source identifier
     */
    unregisterSource(sourceId) {
        this.legendSources.delete(sourceId);
    },

    /**
     * Get legend data from layers module
     * @returns {Array} Array of legend sections
     */
    getLayersLegend() {
        if (typeof GeoflowLayers === 'undefined' || !GeoflowLayers.activeLayerIds) {
            return [];
        }

        const sections = [];
        
        GeoflowLayers.activeLayerIds.forEach(layerId => {
            const legendData = GeoflowConfig.legends[layerId];
            
            if (!legendData || !legendData.items) return;
            
            let layerName = layerId;
            if (GeoflowConfig.layersConfig?.themes) {
                GeoflowConfig.layersConfig.themes.forEach(theme => {
                    const layer = theme.layers.find(l => l.id === layerId);
                    if (layer) layerName = layer.name;
                });
            }

            sections.push({
                title: layerName,
                items: legendData.items
            });
        });

        return sections;
    },

    /**
     * Get legend data from draw module
     * @returns {Array} Array of legend sections
     */
    getDrawLegend() {
        if (typeof GeoflowDraw === 'undefined' || !GeoflowDraw.drawnItems) {
            return [];
        }

        const layers = GeoflowDraw.drawnItems.getLayers();
        
        if (layers.length === 0) {
            return [];
        }

        let drawCount = 0;
        let importCount = 0;

        layers.forEach(layer => {
            if (layer.options && layer.options.color === '#10b981') {
                importCount++;
            } else {
                drawCount++;
            }
        });

        const items = [];

        if (drawCount > 0) {
            items.push({
                symbol: 'polygon',
                color: '#2563eb',
                label: 'Dessin utilisateur'
            });
        }

        if (importCount > 0) {
            items.push({
                symbol: 'polygon',
                color: '#10b981',
                label: 'Import utilisateur'
            });
        }

        return items.length > 0 ? [{
            title: 'Annotations',
            items: items
        }] : [];
    },

    /**
     * Get legend data from measure module
     * @returns {Array} Array of legend sections
     */
    getMeasureLegend() {
        return [];
    },

    /**
     * Collect all legend data from registered sources
     * @returns {Array} Consolidated array of legend sections
     */
    collectLegendData() {
        const allSections = [];

        this.legendSources.forEach((provider, sourceId) => {
            try {
                const sections = provider();
                if (Array.isArray(sections) && sections.length > 0) {
                    allSections.push(...sections);
                }
            } catch (error) {
                console.warn(`Error collecting legend from source '${sourceId}':`, error);
            }
        });

        return allSections;
    },

    /**
     * Generate HTML for a legend section
     * AMÉLIORATION: Support des images de légende
     */
    generateSectionHTML(section) {
        return `
            <div class="legend-layer">
                <div class="legend-layer-name">${section.title}</div>
                ${section.items.map(item => {
                    // Support pour les images de légende (WMS GetLegendGraphic)
                    if (item.symbol === 'image' && item.imageUrl) {
                        return `
                            <div class="legend-item" style="flex-direction: column; align-items: flex-start; padding: 4px 0;">
                                <img src="${item.imageUrl}" 
                                     alt="${item.label}" 
                                     style="max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 4px;"
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <div class="legend-label" style="display: none; color: var(--text-secondary);">
                                    ${item.label} (légende non disponible)
                                </div>
                            </div>
                        `;
                    }
                    
                    // Support standard pour les symboles classiques
                    return `
                        <div class="legend-item">
                            <div class="legend-symbol ${item.symbol}" style="background-color: ${item.color}"></div>
                            <div class="legend-label">${item.label}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Update the legend widget with current data
     */
    updateWidget() {
        if (!this.widgetContent) return;

        const sections = this.collectLegendData();

        if (sections.length === 0) {
            this.widgetContent.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 0.8rem;">
                    Aucune couche active
                </div>
            `;
        } else {
            this.widgetContent.innerHTML = sections
                .map(section => this.generateSectionHTML(section))
                .join('');
        }
    },

    /**
     * Show the legend widget
     */
    show() {
        if (!GeoflowConfig.isFeatureEnabled('legend')) {
            GeoflowUtils.showToast('Légende désactivée', 'warning');
            return;
        }

        this.isActive = true;
        if (this.widget) {
            this.widget.classList.add('active');
        }

        const btn = document.getElementById('btn-legend');
        if (btn) {
            btn.classList.add('active');
        }

        this.updateWidget();
    },

    /**
     * Hide the legend widget
     */
    hide() {
        this.isActive = false;
        if (this.widget) {
            this.widget.classList.remove('active');
        }

        const btn = document.getElementById('btn-legend');
        if (btn) {
            btn.classList.remove('active');
        }
    },

    /**
     * Toggle legend widget visibility
     */
    toggle() {
        if (this.isActive) {
            this.hide();
        } else {
            this.show();
        }
    },

    /**
     * Request legend update (to be called by other modules)
     * This triggers a custom event that the legend module listens to
     */
    requestUpdate() {
        document.dispatchEvent(new CustomEvent('geoflow:legend-update'));
    },

    /**
     * Get legend data for export (print/PDF)
     * AMÉLIORATION: Traitement spécial pour les légendes d'images
     */
    getExportData() {
        const sections = this.collectLegendData();
        
        // Pour l'export, on peut transformer les images en texte simple
        // ou garder l'URL de l'image pour un traitement ultérieur
        return sections.map(section => ({
            ...section,
            items: section.items.map(item => {
                if (item.symbol === 'image' && item.imageUrl) {
                    // Pour l'export, on peut soit:
                    // 1. Garder l'URL pour télécharger l'image plus tard
                    // 2. Ou la transformer en symbole simple
                    return {
                        ...item,
                        needsImageFetch: true // Flag pour indiquer qu'il faut récupérer l'image
                    };
                }
                return item;
            })
        }));
    },

    /**
     * Check if legend has content
     * @returns {boolean} True if legend has at least one section
     */
    hasContent() {
        return this.collectLegendData().length > 0;
    }
};