/**
 * Geoflow Layers Module
 * Handles layer management, display, and interactions
 */

const GeoflowLayers = {
    overlayLayers: {},
    markerClusters: null,
    layerOpacities: {},
    activeLayerIds: new Set(),

    /**
     * Initialize layers system
     */
    init() {
        this.markerClusters = L.markerClusterGroup();
        GeoflowMap.map.addLayer(this.markerClusters);
        
        this.setupDelegatedListeners();
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
     * Get layers panel content HTML
     */
    getPanelContent() {
        return `
            <div class="layer-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="layer-search-input" placeholder="Filtrer les couches">
            </div>

            <div class="layer-theme" data-theme="environnement">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-tree layer-theme-icon"></i>
                        <span>Environnement</span>
                        <span class="layer-theme-count">(3)</span>
                    </div>
                    <i class="fa-solid fa-chevron-right layer-theme-chevron"></i>
                </div>
                <div class="layer-theme-content">
                    <div class="layer-group">
                        ${this.createLayerItem('natura2000', 'Zones Natura 2000', 'DREAL 2024', 'Janvier 2024')}
                        ${this.createLayerItem('espaces-verts', 'Espaces verts', 'IGN', '2024')}
                        ${this.createLayerItem('zones-humides', 'Zones humides', 'Agence de l\'eau', '2024')}
                    </div>
                </div>
            </div>

            <div class="layer-theme" data-theme="transport">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-bus layer-theme-icon"></i>
                        <span>Transport</span>
                        <span class="layer-theme-count">(2)</span>
                    </div>
                    <i class="fa-solid fa-chevron-right layer-theme-chevron"></i>
                </div>
                <div class="layer-theme-content">
                    <div class="layer-group">
                        ${this.createLayerItem('transports-publics', 'Transports publics', 'TAM', '2024')}
                        ${this.createLayerItem('parkings', 'Parkings', 'Ville de Montpellier', '2024')}
                    </div>
                </div>
            </div>

            <div class="layer-theme" data-theme="demo">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-star layer-theme-icon"></i>
                        <span>Démonstration</span>
                        <span class="layer-theme-count">(2)</span>
                    </div>
                    <i class="fa-solid fa-chevron-right layer-theme-chevron"></i>
                </div>
                <div class="layer-theme-content">
                    <div class="layer-group">
                        ${this.createLayerItem('points', 'Points d\'intérêt', 'OpenStreetMap', '2024')}
                        ${this.createLayerItem('zones', 'Zones administratives', 'IGN', '2024')}
                    </div>
                </div>
            </div>

            ${typeof GeoflowExternalSources !== 'undefined' ? GeoflowExternalSources.getExternalLayersHTML() : ''}
            
            <!-- Boutons d'ajout de sources -->
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

        // Layer toggle pour couches NORMALES (pas externes)
        document.querySelectorAll('.layer-item-main').forEach(main => {
            const item = main.closest('.layer-item');
            if (item.dataset.external) return;
            
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

        // Opacity sliders pour couches NORMALES (pas externes)
        document.querySelectorAll('.opacity-slider').forEach(slider => {
            const item = slider.closest('.layer-item');
            if (item.dataset.external) return;
            
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
    },

    toggleLayer(layerId, show) {
        if (show) {
            this.activeLayerIds.add(layerId);
        } else {
            this.activeLayerIds.delete(layerId);
        }
        
        if (layerId === 'points') {
            show ? this.loadDemoPoints() : this.markerClusters.clearLayers();
        } else if (layerId === 'zones') {
            if (show) {
                this.loadDemoZones();
            } else if (this.overlayLayers['zones']) {
                GeoflowMap.map.removeLayer(this.overlayLayers['zones']);
            }
        }
    },

    loadDemoPoints() {
        const points = GeoflowConfig.demoData.points;

        points.forEach(p => {
            const marker = L.marker([p.lat, p.lng]);
            marker.bindPopup(`<div class="feature-popup"><h6>${p.name}</h6><table><tr><td>Type</td><td>${p.type}</td></tr></table></div>`);
            this.markerClusters.addLayer(marker);
        });

        GeoflowUtils.showToast(`${points.length} points chargés`, 'success');
    },

    loadDemoZones() {
        const zoneData = GeoflowConfig.demoData.zone;
        const zone = L.polygon(zoneData.coordinates, { 
            color: zoneData.color, 
            fillOpacity: zoneData.fillOpacity 
        });
        
        zone.bindPopup(`<div class="feature-popup"><h6>${zoneData.name}</h6></div>`);
        this.overlayLayers['zones'] = zone;
        zone.addTo(GeoflowMap.map);
        GeoflowUtils.showToast('Zone chargée', 'success');
    },

    applyLayerOpacity(layerId, opacity) {
        this.layerOpacities[layerId] = opacity;
        
        if (layerId === 'zones' && this.overlayLayers['zones']) {
            this.overlayLayers['zones'].setStyle({ 
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