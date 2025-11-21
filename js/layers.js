/**
 * Geoflow Layers Module - VERSION DYNAMIQUE
 * Handles layer management, display, and interactions
 * Chargement dynamique basé sur config.json
 */

const GeoflowLayers = {
    overlayLayers: {},
    markerClusters: null,
    layerOpacities: {},
    activeLayerIds: new Set(),
    layerConfigs: {}, // Cache des configurations de couches

    /**
     * Initialize layers system
     */
    init() {
        this.markerClusters = L.markerClusterGroup();
        GeoflowMap.map.addLayer(this.markerClusters);
        
        // Charger les configurations de couches depuis config.json
        this.loadLayerConfigs();
        
        this.setupDelegatedListeners();
    },

    /**
     * Load layer configurations from config.json
     */
    loadLayerConfigs() {
        if (!GeoflowConfig.layersConfig || !GeoflowConfig.layersConfig.themes) {
            console.warn('⚠️ No layer configuration found in config.json');
            return;
        }

        GeoflowConfig.layersConfig.themes.forEach(theme => {
            theme.layers.forEach(layer => {
                this.layerConfigs[layer.id] = layer;
            });
        });
    },

    setupDelegatedListeners() {
        const panelContent = document.getElementById('panel-content');
        if (!panelContent) return;
        
        // Toggle des couches externes - DÉLÉGATION
        panelContent.addEventListener('click', (e) => {
            const layerName = e.target.closest('.layer-name');
            if (!layerName) return;
            
            const item = layerName.closest('.layer-item');
            if (!item || !item.dataset.external) return;
            
            const checkbox = item.querySelector('.layer-checkbox');
            const layerId = item.dataset.layer;
            
            const newState = !checkbox.checked;
            checkbox.checked = newState;
            item.classList.toggle('active', newState);
            
            this.toggleExternalLayer(layerId, newState);
        });
        
        // Opacité des couches externes - DÉLÉGATION
        panelContent.addEventListener('input', (e) => {
            if (!e.target.classList.contains('opacity-slider')) return;
            
            const item = e.target.closest('.layer-item');
            if (!item || !item.dataset.external) return;
            
            const layerId = item.dataset.layer;
            const value = e.target.value;
            const valueSpan = e.target.previousElementSibling?.querySelector('.opacity-value');
            
            if (valueSpan) {
                valueSpan.textContent = value + '%';
            }
            
            this.layerOpacities[layerId] = value / 100;
            
            const layerInfo = GeoflowExternalSources.externalLayers.find(l => l.id === layerId);
            if (layerInfo && layerInfo.layer.setOpacity) {
                layerInfo.layer.setOpacity(value / 100);
            }
        });
    },

    /**
     * Get layers panel content HTML - DYNAMIQUE
     */
    getPanelContent() {
        if (!GeoflowConfig.layersConfig || !GeoflowConfig.layersConfig.themes) {
            return `
                <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                    <p>Aucune configuration de couches trouvée.</p>
                    <p style="font-size: 0.8rem; margin-top: 10px;">Vérifiez votre fichier config.json</p>
                </div>
            `;
        }

        let html = `
            <div class="layer-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="layer-search-input" placeholder="Filtrer les couches">
            </div>
        `;

        // Générer les thèmes dynamiquement depuis config.json
        GeoflowConfig.layersConfig.themes.forEach(theme => {
            const icon = theme.icon || 'bi-layers';
            const layerCount = theme.layers.length;

            html += `
                <div class="layer-theme" data-theme="${theme.id}">
                    <div class="layer-theme-header">
                        <div class="layer-theme-title">
                            <i class="fa-solid ${icon} layer-theme-icon"></i>
                            <span>${theme.name}</span>
                            <span class="layer-theme-count">(${layerCount})</span>
                        </div>
                        <i class="fa-solid fa-chevron-right layer-theme-chevron"></i>
                    </div>
                    <div class="layer-theme-content">
                        <div class="layer-group">
            `;

            theme.layers.forEach(layer => {
                html += this.createLayerItem(layer.id, layer.name, layer.source, layer.date);
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        // Thème Annotations (dessins + imports)
        html += typeof GeoflowAnnotations !== 'undefined' ? GeoflowAnnotations.getAnnotationsThemeHTML() : '';


        // Couches externes
        html += typeof GeoflowExternalSources !== 'undefined' ? GeoflowExternalSources.getExternalLayersHTML() : '';
        
        // Boutons d'ajout de sources
        html += `
            <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                ${this.getAddSourceButtons()}
            </div>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-label">Latitude</div>
                    <div class="stat-value" id="stat-lat">${GeoflowMap.map.getCenter().lat.toFixed(4)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Longitude</div>
                    <div class="stat-value" id="stat-lng">${GeoflowMap.map.getCenter().lng.toFixed(4)}</div>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Get add source buttons HTML
     */
    getAddSourceButtons() {
        return `
            <button class="btn btn-sm btn-outline-primary flex-fill" id="btn-add-external-source" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <i class="fa-solid fa-plus"></i>
                <span>Ajout WMTS</span>
            </button>
            <button class="btn btn-sm btn-primary flex-fill" id="btn-add-ai-source" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Recherche IA</span>
            </button>
        `;
    },

    /**
     * Create layer item HTML
     */
    createLayerItem(id, name, source, date) {
        const isActive = this.activeLayerIds.has(id);
        const opacity = this.layerOpacities[id] || 1;
        const opacityPercent = Math.round(opacity * 100);
        
        return `
            <div class="layer-item ${isActive ? 'active' : ''}" data-layer="${id}">
                <div class="layer-item-main">
                    <input type="checkbox" class="layer-checkbox" ${isActive ? 'checked' : ''}>
                    <div class="layer-name">${name}</div>
                    <button class="layer-expand-btn" title="Détails">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
                <div class="layer-details">
                    <div class="layer-details-content">
                        <div class="layer-opacity-control">
                            <div class="opacity-label">
                                <span>Opacité</span>
                                <span class="opacity-value">${opacityPercent}%</span>
                            </div>
                            <input type="range" class="opacity-slider" min="0" max="100" value="${opacityPercent}">
                        </div>
                        <div class="layer-metadata">
                            <div><strong>Source:</strong> ${source}</div>
                            <div><strong>Date:</strong> ${date}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Attach event listeners to layer controls
     */
    attachListeners() {
        // AI search button
        const btnAddAI = document.getElementById('btn-add-ai-source');
        if (btnAddAI) {
            btnAddAI.addEventListener('click', () => {
                GeoflowPanels.showPanel('ai-search', 'layers');
            });
        }

        // External sources button
        const btnAddExternal = document.getElementById('btn-add-external-source');
        if (btnAddExternal) {
            btnAddExternal.addEventListener('click', () => {
                GeoflowPanels.showPanel('external-source', 'layers');
            });
        }

        // Theme accordion
        document.querySelectorAll('.layer-theme-header').forEach(header => {
            header.addEventListener('click', () => {
                const theme = header.closest('.layer-theme');
                theme.classList.toggle('expanded');
            });
        });

        // Layer toggle pour couches NORMALES (pas externes, pas annotations)
        document.querySelectorAll('.layer-item-main').forEach(main => {
            const item = main.closest('.layer-item');
            if (item.dataset.external || item.dataset.annotation) return;
            
            const layerName = main.querySelector('.layer-name');
            
            layerName.addEventListener('click', () => {
                const checkbox = main.querySelector('.layer-checkbox');
                const layerId = item.dataset.layer;
                
                const newState = !checkbox.checked;
                checkbox.checked = newState;
                item.classList.toggle('active', newState);
                
                this.toggleLayer(layerId, newState);
                this.updateLegendWidget();
            });
        });

        // Expand button
        document.querySelectorAll('.layer-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.layer-item');
                const details = item.querySelector('.layer-details');
                const icon = btn.querySelector('i');
                
                details.classList.toggle('expanded');
                btn.classList.toggle('expanded');
                icon.className = details.classList.contains('expanded') ? 'fa-solid fa-minus' : 'fa-solid fa-plus';
            });
        });

        // Opacity sliders pour couches NORMALES (pas externes, pas annotations)
        document.querySelectorAll('.opacity-slider').forEach(slider => {
            const item = slider.closest('.layer-item');
            if (item.dataset.external || item.dataset.annotation) return;
            
            slider.addEventListener('input', (e) => {
                const layerId = item.dataset.layer;
                const value = e.target.value;
                const valueSpan = slider.previousElementSibling.querySelector('.opacity-value');
                
                valueSpan.textContent = value + '%';
                this.layerOpacities[layerId] = value / 100;
                this.applyLayerOpacity(layerId, value / 100);
            });
        });

        // Search filter
        const searchInput = document.getElementById('layer-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', GeoflowUtils.debounce((e) => {
                const query = e.target.value.toLowerCase().trim();
                
                document.querySelectorAll('.layer-item').forEach(item => {
                    const name = item.querySelector('.layer-name').textContent.toLowerCase();
                    const matches = name.includes(query);
                    item.classList.toggle('hidden', !matches && query !== '');
                });

                document.querySelectorAll('.layer-theme').forEach(theme => {
                    const visibleItems = theme.querySelectorAll('.layer-item:not(.hidden)');
                    theme.style.display = visibleItems.length > 0 || query === '' ? 'block' : 'none';
                });
            }, 300));
        }

        // Setup annotation listeners
        if (typeof GeoflowAnnotations !== 'undefined') {
            GeoflowAnnotations.setupAnnotationListeners();
        }
    },

    /**
     * Toggle layer - DYNAMIQUE selon le type
     */
    async toggleLayer(layerId, show) {
        const layerConfig = this.layerConfigs[layerId];
        
        if (!layerConfig) {
            console.warn(`Layer config not found for: ${layerId}`);
            return;
        }

        if (show) {
            this.activeLayerIds.add(layerId);
            await this.loadLayer(layerId, layerConfig);
        } else {
            this.activeLayerIds.delete(layerId);
            this.unloadLayer(layerId);
        }
    },

    /**
     * Load layer according to its type
     */
    async loadLayer(layerId, config) {
        try {
            switch(config.type) {
                case 'geojson':
                    await this.loadGeoJSONLayer(layerId, config);
                    break;
                case 'postgis':
                    await this.loadPostGISLayer(layerId, config);
                    break;
                case 'empty':
                    GeoflowUtils.showToast(`Couche "${config.name}" : pas encore de données`, 'info');
                    break;
                default:
                    console.warn(`Unknown layer type: ${config.type} for layer ${layerId}`);
            }
        } catch (error) {
            console.error(`Error loading layer ${layerId}:`, error);
            GeoflowUtils.showToast(`Erreur lors du chargement de "${config.name}"`, 'error');
            this.activeLayerIds.delete(layerId);
        }
    },

    /**
     * Load GeoJSON layer from local file
     */
    async loadGeoJSONLayer(layerId, config) {
        const response = await fetch(config.url);
        if (!response.ok) {
            throw new Error(`Failed to load GeoJSON from ${config.url}`);
        }

        const geojson = await response.json();
        const style = config.style || {};

        // Utiliser le clustering si activé
        if (style.clustered) {
            L.geoJSON(geojson, {
                pointToLayer: (feature, latlng) => {
                    const marker = L.marker(latlng);
                    
                    // Créer popup avec propriétés
                    let popupContent = '<div class="feature-popup">';
                    popupContent += `<h6>${feature.properties.name || 'Sans nom'}</h6>`;
                    popupContent += '<table>';
                    Object.entries(feature.properties).forEach(([key, value]) => {
                        if (key !== 'name' && value !== null) {
                            popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                        }
                    });
                    popupContent += '</table></div>';
                    marker.bindPopup(popupContent);
                    
                    this.markerClusters.addLayer(marker);
                    return marker;
                }
            });
            
            GeoflowUtils.showToast(`${geojson.features.length} points chargés`, 'success');
        } else {
            // Couche standard (polygones, lignes, etc.)
            const layer = L.geoJSON(geojson, {
                style: () => ({
                    color: style.color || '#2563eb',
                    weight: style.weight || 2,
                    fillOpacity: style.fillOpacity || 0.2
                }),
                onEachFeature: (feature, layer) => {
                    // Créer popup avec propriétés
                    let popupContent = '<div class="feature-popup">';
                    popupContent += `<h6>${feature.properties.name || 'Sans nom'}</h6>`;
                    popupContent += '<table>';
                    Object.entries(feature.properties).forEach(([key, value]) => {
                        if (key !== 'name' && value !== null) {
                            popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                        }
                    });
                    popupContent += '</table></div>';
                    layer.bindPopup(popupContent);
                }
            });
            
            layer.addTo(GeoflowMap.map);
            this.overlayLayers[layerId] = layer;
            
            GeoflowUtils.showToast(`Couche "${config.name}" chargée`, 'success');
        }
    },

    /**
     * Load PostGIS layer (future implementation)
     */
    async loadPostGISLayer(layerId, config) {
        GeoflowUtils.showToast(`Couche PostGIS "${config.name}" : à implémenter`, 'info');
        // TODO: Implémenter le chargement depuis PostGIS
        // Via endpoint backend ou pg_tileserv
    },

    /**
     * Unload layer
     */
    unloadLayer(layerId) {
        const layerConfig = this.layerConfigs[layerId];
        
        if (layerConfig && layerConfig.style && layerConfig.style.clustered) {
            // Clear markers from cluster
            this.markerClusters.clearLayers();
        } else if (this.overlayLayers[layerId]) {
            GeoflowMap.map.removeLayer(this.overlayLayers[layerId]);
            delete this.overlayLayers[layerId];
        }
    },

    applyLayerOpacity(layerId, opacity) {
        this.layerOpacities[layerId] = opacity;
        
        if (this.overlayLayers[layerId] && this.overlayLayers[layerId].setStyle) {
            this.overlayLayers[layerId].setStyle({ 
                fillOpacity: opacity * 0.2, 
                opacity: opacity 
            });
        }
    },

    updateLegendWidget() {
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    toggleExternalLayer(layerId, show) {
        const layerInfo = GeoflowExternalSources.externalLayers.find(l => l.id === layerId);
        if (!layerInfo) return;
        
        if (show) {
            this.activeLayerIds.add(layerId);
            GeoflowMap.map.addLayer(layerInfo.layer);
        } else {
            this.activeLayerIds.delete(layerId);
            GeoflowMap.map.removeLayer(layerInfo.layer);
        }
        
        this.updateLegendWidget();
    }
};