/**
 * Geoflow Annotations Module
 * Manages user drawings and imports as dynamic layers
 * Integrates with the layers panel
 */

const GeoflowAnnotations = {
    drawLayerGroup: null,
    importLayerGroup: null,
    initialized: false,

    /**
     * Initialize annotations system
     */
    init() {
        if (this.initialized) return;

        // Create separate layer groups for draw and import
        this.drawLayerGroup = L.featureGroup();
        this.importLayerGroup = L.featureGroup();

        // Add to map
        GeoflowMap.map.addLayer(this.drawLayerGroup);
        GeoflowMap.map.addLayer(this.importLayerGroup);

        // Set default opacity
        GeoflowLayers.layerOpacities['user-draw'] = 1;
        GeoflowLayers.layerOpacities['user-import'] = 1;

        this.initialized = true;
    },

    /**
     * Add a drawn feature to the draw layer
     * @param {L.Layer} layer - Leaflet layer
     */
    addDrawnFeature(layer) {
        this.init(); // Ensure initialized
        this.drawLayerGroup.addLayer(layer);
        
        // Mark as active
        GeoflowLayers.activeLayerIds.add('user-draw');
        
        // Update layers panel if open
        if (GeoflowPanels.currentPanel === 'layers') {
            GeoflowPanels.showPanel('layers');
        }

        // Update legend
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Add an imported feature to the import layer
     * @param {L.Layer} layer - Leaflet layer
     */
    addImportedFeature(layer) {
        this.init(); // Ensure initialized
        this.importLayerGroup.addLayer(layer);
        
        // Mark as active
        GeoflowLayers.activeLayerIds.add('user-import');
        
        // Update layers panel if open
        if (GeoflowPanels.currentPanel === 'layers') {
            GeoflowPanels.showPanel('layers');
        }

        // Update legend
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Clear all drawn features
     */
    clearDrawnFeatures() {
        if (!this.drawLayerGroup) return;
        
        const count = this.drawLayerGroup.getLayers().length;
        if (count === 0) {
            GeoflowUtils.showToast('Aucun dessin à effacer', 'info');
            return;
        }

        if (confirm(`Effacer tous les dessins (${count}) ?`)) {
            this.drawLayerGroup.clearLayers();
            GeoflowLayers.activeLayerIds.delete('user-draw');
            
            // Update UI
            if (GeoflowPanels.currentPanel === 'layers') {
                GeoflowPanels.showPanel('layers');
            }
            
            GeoflowUtils.showToast('Dessins effacés', 'success');

            // Update legend
            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
        }
    },

    /**
     * Clear all imported features
     */
    clearImportedFeatures() {
        if (!this.importLayerGroup) return;
        
        const count = this.importLayerGroup.getLayers().length;
        if (count === 0) {
            GeoflowUtils.showToast('Aucun import à effacer', 'info');
            return;
        }

        if (confirm(`Effacer tous les imports (${count}) ?`)) {
            this.importLayerGroup.clearLayers();
            GeoflowLayers.activeLayerIds.delete('user-import');
            
            // Update UI
            if (GeoflowPanels.currentPanel === 'layers') {
                GeoflowPanels.showPanel('layers');
            }
            
            GeoflowUtils.showToast('Imports effacés', 'success');

            // Update legend
            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
        }
    },

    /**
     * Get count of drawn features
     * @returns {number}
     */
    getDrawnCount() {
        return this.drawLayerGroup ? this.drawLayerGroup.getLayers().length : 0;
    },

    /**
     * Get count of imported features
     * @returns {number}
     */
    getImportedCount() {
        return this.importLayerGroup ? this.importLayerGroup.getLayers().length : 0;
    },

    /**
     * Check if annotations theme should be displayed
     * @returns {boolean}
     */
    hasAnnotations() {
        return this.getDrawnCount() > 0 || this.getImportedCount() > 0;
    },

    /**
     * Toggle draw layer visibility
     * @param {boolean} show
     */
    toggleDrawLayer(show) {
        if (!this.drawLayerGroup) return;

        if (show) {
            GeoflowMap.map.addLayer(this.drawLayerGroup);
            GeoflowLayers.activeLayerIds.add('user-draw');
        } else {
            GeoflowMap.map.removeLayer(this.drawLayerGroup);
            GeoflowLayers.activeLayerIds.delete('user-draw');
        }

        // Update legend
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Toggle import layer visibility
     * @param {boolean} show
     */
    toggleImportLayer(show) {
        if (!this.importLayerGroup) return;

        if (show) {
            GeoflowMap.map.addLayer(this.importLayerGroup);
            GeoflowLayers.activeLayerIds.add('user-import');
        } else {
            GeoflowMap.map.removeLayer(this.importLayerGroup);
            GeoflowLayers.activeLayerIds.delete('user-import');
        }

        // Update legend
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Set opacity for draw layer
     * @param {number} opacity - 0 to 1
     */
    setDrawOpacity(opacity) {
        if (!this.drawLayerGroup) return;
        
        GeoflowLayers.layerOpacities['user-draw'] = opacity;
        
        this.drawLayerGroup.eachLayer(layer => {
            if (layer.setStyle) {
                const currentStyle = layer.options;
                layer.setStyle({
                    fillOpacity: currentStyle.fillOpacity ? opacity * 0.3 : undefined,
                    opacity: opacity
                });
            } else if (layer.setOpacity) {
                layer.setOpacity(opacity);
            }
        });
    },

    /**
     * Set opacity for import layer
     * @param {number} opacity - 0 to 1
     */
    setImportOpacity(opacity) {
        if (!this.importLayerGroup) return;
        
        GeoflowLayers.layerOpacities['user-import'] = opacity;
        
        this.importLayerGroup.eachLayer(layer => {
            if (layer.setStyle) {
                const currentStyle = layer.options;
                layer.setStyle({
                    fillOpacity: currentStyle.fillOpacity ? opacity * 0.3 : undefined,
                    opacity: opacity
                });
            } else if (layer.setOpacity) {
                layer.setOpacity(opacity);
            }
        });
    },

    /**
     * Change color for draw layer
     * @param {string} color - Hex color
     */
    setDrawColor(color) {
        if (!this.drawLayerGroup) return;
        
        this.drawLayerGroup.eachLayer(layer => {
            if (layer.setStyle) {
                layer.setStyle({
                    color: color,
                    fillColor: color
                });
            }
        });

        // Stocker la couleur dans le data-attribute
        const drawItem = document.querySelector('[data-layer="user-draw"]');
        if (drawItem) {
            drawItem.dataset.color = color;
        }

        //GeoflowUtils.showToast('Couleur des dessins modifiée', 'success');

        // Update legend
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Change color for import layer
     * @param {string} color - Hex color
     */
    setImportColor(color) {
        if (!this.importLayerGroup) return;
        
        this.importLayerGroup.eachLayer(layer => {
            if (layer.setStyle) {
                layer.setStyle({
                    color: color,
                    fillColor: color
                });
            }
        });

        // Stocker la couleur dans le data-attribute
        const importItem = document.querySelector('[data-layer="user-import"]');
        if (importItem) {
            importItem.dataset.color = color;
        }

        //GeoflowUtils.showToast('Couleur des imports modifiée', 'success');

        // Update legend
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Get HTML for annotations theme in layers panel
     * @returns {string}
     */
    getAnnotationsThemeHTML() {
        if (!this.hasAnnotations()) {
            return ''; // Don't show theme if no annotations
        }

        const drawCount = this.getDrawnCount();
        const importCount = this.getImportedCount();
        const totalCount = drawCount + importCount;

        let html = `
            <div class="layer-theme expanded" data-theme="annotations">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-pen-to-square layer-theme-icon"></i>
                        <span>Annotations</span>
                        <span class="layer-theme-count">(${totalCount})</span>
                    </div>
                    <i class="fa-solid fa-chevron-right layer-theme-chevron"></i>
                </div>
                <div class="layer-theme-content">
                    <div class="layer-group">
        `;

        // Draw layer
        if (drawCount > 0) {
            const isActive = GeoflowLayers.activeLayerIds.has('user-draw');
            const opacity = GeoflowLayers.layerOpacities['user-draw'] || 1;
            const opacityPercent = Math.round(opacity * 100);

            html += `
                <div class="layer-item ${isActive ? 'active' : ''}" data-layer="user-draw" data-annotation="true" data-color="#2563eb">
                    <div class="layer-item-main">
                        <input type="checkbox" class="layer-checkbox" ${isActive ? 'checked' : ''}>
                        <div class="layer-name">Dessins (${drawCount})</div>
                        <button class="layer-expand-btn" title="Détails">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <div class="layer-details">
                        <div class="layer-details-content">
                            <!-- Opacité et Couleur sur la même ligne -->
                            <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; margin-bottom: 12px;">
                                <div class="layer-opacity-control" style="margin-bottom: 0;">
                                    <div class="opacity-label">
                                        <span>Opacité</span>
                                        <span class="opacity-value">${opacityPercent}%</span>
                                    </div>
                                    <input type="range" class="opacity-slider" min="0" max="100" value="${opacityPercent}">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); margin: 0;">
                                        Couleur
                                    </label>
                                    <input type="color" class="color-picker" value="#2563eb" style="width: 44px; height: 32px; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; padding: 2px;" title="Couleur unique">
                                </div>
                            </div>

                            <div class="layer-metadata" style="margin-bottom: 8px;">
                                <div><strong>Type:</strong> Dessin utilisateur</div>
                                <div><strong>Géométries:</strong> ${drawCount}</div>
                            </div>

                            <button class="btn btn-sm btn-danger w-100" onclick="GeoflowAnnotations.clearDrawnFeatures()">
                                <i class="fa-solid fa-trash"></i> Supprimer tout
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Import layer
        if (importCount > 0) {
            const isActive = GeoflowLayers.activeLayerIds.has('user-import');
            const opacity = GeoflowLayers.layerOpacities['user-import'] || 1;
            const opacityPercent = Math.round(opacity * 100);

            html += `
                <div class="layer-item ${isActive ? 'active' : ''}" data-layer="user-import" data-annotation="true" data-color="#10b981">
                    <div class="layer-item-main">
                        <input type="checkbox" class="layer-checkbox" ${isActive ? 'checked' : ''}>
                        <div class="layer-name">Imports (${importCount})</div>
                        <button class="layer-expand-btn" title="Détails">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <div class="layer-details">
                        <div class="layer-details-content">
                            <!-- Opacité et Couleur sur la même ligne -->
                            <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; margin-bottom: 12px;">
                                <div class="layer-opacity-control" style="margin-bottom: 0;">
                                    <div class="opacity-label">
                                        <span>Opacité</span>
                                        <span class="opacity-value">${opacityPercent}%</span>
                                    </div>
                                    <input type="range" class="opacity-slider" min="0" max="100" value="${opacityPercent}">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); margin: 0;">
                                        Couleur
                                    </label>
                                    <input type="color" class="color-picker" value="#10b981" style="width: 44px; height: 32px; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; padding: 2px;" title="Couleur unique">
                                </div>
                            </div>

                            <div class="layer-metadata" style="margin-bottom: 8px;">
                                <div><strong>Type:</strong> Import GeoJSON</div>
                                <div><strong>Géométries:</strong> ${importCount}</div>
                            </div>

                            <button class="btn btn-sm btn-danger w-100" onclick="GeoflowAnnotations.clearImportedFeatures()">
                                <i class="fa-solid fa-trash"></i> Supprimer tout
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Setup event listeners for annotation layers
     * IMPORTANT: Utilise la délégation d'événements pour éviter les doublons
     */
    setupAnnotationListeners() {
        const panelContent = document.getElementById('panel-content');
        if (!panelContent) return;

        // Retirer les anciens listeners pour éviter les doublons
        const oldHandler = panelContent._annotationClickHandler;
        if (oldHandler) {
            panelContent.removeEventListener('click', oldHandler);
        }

        // Créer le nouveau handler
        const clickHandler = (e) => {
            // Toggle via clic sur .layer-name
            const layerName = e.target.closest('.layer-name');
            if (layerName) {
                const item = layerName.closest('.layer-item');
                if (!item || !item.dataset.annotation) return;

                e.stopPropagation();

                const checkbox = item.querySelector('.layer-checkbox');
                const layerId = item.dataset.layer;

                const newState = !checkbox.checked;
                checkbox.checked = newState;
                item.classList.toggle('active', newState);

                if (layerId === 'user-draw') {
                    this.toggleDrawLayer(newState);
                } else if (layerId === 'user-import') {
                    this.toggleImportLayer(newState);
                }
                return;
            }

            // Gestion opacité
            if (e.target.classList.contains('opacity-slider')) {
                const item = e.target.closest('.layer-item');
                if (!item || !item.dataset.annotation) return;

                const layerId = item.dataset.layer;
                const value = e.target.value;
                const valueSpan = e.target.previousElementSibling?.querySelector('.opacity-value');

                if (valueSpan) {
                    valueSpan.textContent = value + '%';
                }

                const opacity = value / 100;

                if (layerId === 'user-draw') {
                    this.setDrawOpacity(opacity);
                } else if (layerId === 'user-import') {
                    this.setImportOpacity(opacity);
                }
                return;
            }

            // Gestion color picker
            if (e.target.classList.contains('color-picker')) {
                const item = e.target.closest('.layer-item');
                if (!item || !item.dataset.annotation) return;

                const layerId = item.dataset.layer;
                const color = e.target.value;

                if (layerId === 'user-draw') {
                    this.setDrawColor(color);
                } else if (layerId === 'user-import') {
                    this.setImportColor(color);
                }
            }
        };

        // Stocker le handler pour pouvoir le retirer plus tard
        panelContent._annotationClickHandler = clickHandler;

        // Attacher le listener (une seule fois)
        panelContent.addEventListener('click', clickHandler);
        panelContent.addEventListener('input', clickHandler);
        panelContent.addEventListener('change', clickHandler);
    }
};