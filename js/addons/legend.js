/**
 * Geoflow Legend Module - VERSION AVEC ANNOTATIONS
 * Centralized legend management system with external layer support
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
        this.registerSource('annotations', () => this.getAnnotationsLegend());

        // Listen for legend updates from other modules
        document.addEventListener('geoflow:legend-update', () => {
            this.updateWidget();
        });
    },

    /**
     * Register a legend source
     */
    registerSource(sourceId, provider) {
        this.legendSources.set(sourceId, provider);
    },

    /**
     * Unregister a legend source
     */
    unregisterSource(sourceId) {
        this.legendSources.delete(sourceId);
    },

    /**
     * Get legend data from layers module
     */
    getLayersLegend() {
        if (typeof GeoflowLayers === 'undefined' || !GeoflowLayers.activeLayerIds) {
            return [];
        }

        const sections = [];
        
        GeoflowLayers.activeLayerIds.forEach(layerId => {
            // Skip annotation layers (handled separately)
            if (layerId === 'user-draw' || layerId === 'user-import') {
                return;
            }

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
     * Get legend data from annotations module
     */
    getAnnotationsLegend() {
        if (typeof GeoflowAnnotations === 'undefined') {
            return [];
        }

        const items = [];
        
        // Draw layer avec couleur dynamique
        if (GeoflowAnnotations.getDrawnCount() > 0 && GeoflowLayers.activeLayerIds.has('user-draw')) {
            const drawItem = document.querySelector('[data-layer="user-draw"]');
            const color = drawItem ? (drawItem.dataset.color || '#2563eb') : '#2563eb';
            
            items.push({
                symbol: 'polygon',
                color: color,
                label: `Dessins (${GeoflowAnnotations.getDrawnCount()})`
            });
        }

        // Import layer avec couleur dynamique
        if (GeoflowAnnotations.getImportedCount() > 0 && GeoflowLayers.activeLayerIds.has('user-import')) {
            const importItem = document.querySelector('[data-layer="user-import"]');
            const color = importItem ? (importItem.dataset.color || '#10b981') : '#10b981';
            
            items.push({
                symbol: 'polygon',
                color: color,
                label: `Imports (${GeoflowAnnotations.getImportedCount()})`
            });
        }

        // Retourner un seul bloc "Annotations" avec tous les items
        if (items.length > 0) {
            return [{
                title: 'Annotations',
                items: items
            }];
        }

        return [];
    },

    /**
     * Collect all legend data from registered sources
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
     */
    generateSectionHTML(section) {
        return `
            <div class="legend-layer">
                <div class="legend-layer-name">${section.title}</div>
                ${section.items.map(item => {
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
     */
    requestUpdate() {
        document.dispatchEvent(new CustomEvent('geoflow:legend-update'));
    },

    /**
     * Get legend data for export (print/PDF)
     */
    getExportData() {
        return this.collectLegendData();
    },

    /**
     * Check if legend has content
     */
    hasContent() {
        return this.collectLegendData().length > 0;
    }
};