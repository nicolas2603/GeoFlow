/**
 * Geoflow External Sources Module
 * Handles adding WMS/WMTS/WFS layers from external sources
 */

const GeoflowExternalSources = {
    externalLayers: [],
    availableLayersData: [], // Stocker les métadonnées complètes des couches
    
    /**
     * Initialize external sources management
     */
    init() {
        // Nothing to initialize - using sub-panel instead of modal
    },

    /**
     * Get panel content HTML for adding external source
     */
    getPanelContent() {
        return `
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Type de service
                </label>
                <select id="external-service-type" class="form-select form-select-sm">
                    <option value="wms">WMS (Web Map Service)</option>
                    <option value="wmts">WMTS (Web Map Tile Service)</option>
                    <option value="wfs">WFS (Web Feature Service)</option>
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    URL du service
                </label>
                <input type="text" id="external-service-url" class="form-control form-control-sm" placeholder="https://example.com/geoserver/wms">
            </div>

            <button id="btn-fetch-capabilities" class="btn btn-sm btn-primary w-100" style="margin-bottom: 14px;">
                <i class="fa-solid fa-download"></i> Récupérer les capacités
            </button>

            <div id="capabilities-result" style="display: none;">
                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                        Filtrer les couches
                    </label>
                    <input type="text" id="filter-layers" class="form-control form-control-sm" placeholder="Rechercher...">
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                        Couches disponibles
                    </label>
                    <select id="available-layers" class="form-select form-select-sm" size="5"></select>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                        Nom de la couche
                    </label>
                    <input type="text" id="layer-custom-name" class="form-control form-control-sm" placeholder="Ma couche externe">
                </div>

                <div style="margin-bottom: 14px;">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="layer-transparent" checked>
                        <label class="form-check-label" for="layer-transparent">
                            Fond transparent
                        </label>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="btn-add-layer" class="btn btn-sm btn-success flex-fill">
                        <i class="fa-solid fa-plus"></i> Ajouter la couche
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        document.getElementById('btn-fetch-capabilities')?.addEventListener('click', () => {
            this.fetchCapabilities();
        });

        document.getElementById('btn-add-layer')?.addEventListener('click', () => {
            this.addLayer();
        });

        // Filtre sur les couches
        document.getElementById('filter-layers')?.addEventListener('input', (e) => {
            this.filterLayers(e.target.value);
        });

        // Auto-remplissage du nom quand on sélectionne une couche
        document.getElementById('available-layers')?.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const layerTitle = selectedOption.textContent;
            document.getElementById('layer-custom-name').value = layerTitle;
        });
    },

    /**
     * Get the add external source button HTML
     */
    getAddSourceButton() {
        return `
            <button class="btn btn-sm btn-primary w-100" id="btn-add-external-source" style="margin-bottom: 14px;">
                <i class="fa-solid fa-plus"></i> Ajouter une source externe
            </button>
        `;
    },

    /**
     * Filter layers list
     */
    filterLayers(query) {
        const select = document.getElementById('available-layers');
        const options = select.querySelectorAll('option');
        const lowerQuery = query.toLowerCase();

        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            const value = option.value.toLowerCase();
            const matches = text.includes(lowerQuery) || value.includes(lowerQuery);
            option.style.display = matches ? '' : 'none';
        });
    },

    /**
     * Fetch GetCapabilities
     */
    async fetchCapabilities() {
        const type = document.getElementById('external-service-type').value;
        const url = document.getElementById('external-service-url').value.trim();

        if (!url) {
            GeoflowUtils.showToast('Veuillez entrer une URL', 'warning');
            return;
        }

        GeoflowUtils.showLoadingOverlay('Récupération des capacités...');

        try {
            let capabilitiesUrl = url;
            
            // Nettoyer l'URL des paramètres REQUEST existants
            const urlObj = new URL(url);
            urlObj.searchParams.delete('REQUEST');
            capabilitiesUrl = urlObj.toString();
            
            if (type === 'wms') {
                capabilitiesUrl += (capabilitiesUrl.includes('?') ? '&' : '?') + 'SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0';
            } else if (type === 'wmts') {
                capabilitiesUrl += (capabilitiesUrl.includes('?') ? '&' : '?') + 'SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0';
            } else if (type === 'wfs') {
                capabilitiesUrl += (capabilitiesUrl.includes('?') ? '&' : '?') + 'SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0';
            }

            const response = await fetch(capabilitiesUrl);
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            const layers = this.parseCapabilities(xmlDoc, type);

            if (layers.length === 0) {
                GeoflowUtils.showToast('Aucune couche trouvée', 'warning');
                GeoflowUtils.hideLoadingOverlay();
                return;
            }

            // Stocker les données complètes des couches
            this.availableLayersData = layers;

            const select = document.getElementById('available-layers');
            select.innerHTML = layers.map(l => `<option value="${l.name}">${l.title || l.name}</option>`).join('');

            document.getElementById('capabilities-result').style.display = 'block';
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast(`${layers.length} couche(s) trouvée(s)`, 'success');

        } catch (error) {
            console.error('Capabilities error:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur lors de la récupération', 'error');
        }
    },

    /**
     * Parse capabilities XML
     */
    parseCapabilities(xmlDoc, type) {
        const layers = [];

        if (type === 'wms') {
            const layerElements = xmlDoc.querySelectorAll('Layer > Layer');
            layerElements.forEach(layer => {
                const name = layer.querySelector('Name')?.textContent;
                const title = layer.querySelector('Title')?.textContent;
                if (name) layers.push({ name, title });
            });
        } else if (type === 'wmts') {
            const layerElements = xmlDoc.querySelectorAll('Layer');
            layerElements.forEach(layer => {
                const name = layer.querySelector('Identifier')?.textContent;
                const title = layer.querySelector('Title')?.textContent;
                
                // Récupérer le premier style disponible
                const styleElement = layer.querySelector('Style Identifier');
                const style = styleElement?.textContent || 'normal';
                
                // Récupérer le TileMatrixSet
                const tileMatrixSetLink = layer.querySelector('TileMatrixSetLink TileMatrixSet');
                const tileMatrixSet = tileMatrixSetLink?.textContent || 'PM';
                
                if (name) {
                    layers.push({ 
                        name, 
                        title, 
                        style,
                        tileMatrixSet
                    });
                }
            });
        } else if (type === 'wfs') {
            const featureTypes = xmlDoc.querySelectorAll('FeatureType');
            featureTypes.forEach(ft => {
                const name = ft.querySelector('Name')?.textContent;
                const title = ft.querySelector('Title')?.textContent;
                if (name) layers.push({ name, title });
            });
        }

        return layers;
    },

    /**
     * Add layer to map
     */
    addLayer() {
        const type = document.getElementById('external-service-type').value;
        const baseUrl = document.getElementById('external-service-url').value.trim();
        const layerName = document.getElementById('available-layers').value;
        const customName = document.getElementById('layer-custom-name').value.trim() || layerName;
        const transparent = document.getElementById('layer-transparent').checked;

        if (!layerName) {
            GeoflowUtils.showToast('Sélectionnez une couche', 'warning');
            return;
        }

        const layerId = 'external_' + Date.now();
        let layer;

        // Nettoyer l'URL de base - supprimer tous les paramètres sauf le base path
        let cleanBaseUrl = baseUrl.split('?')[0];
        if (!cleanBaseUrl.endsWith('?')) {
            cleanBaseUrl += '?';
        }

        if (type === 'wms') {
            layer = L.tileLayer.wms(cleanBaseUrl, {
                layers: layerName,
                format: 'image/png',
                transparent: transparent,
                version: '1.3.0',
                attribution: customName
            });
        } else if (type === 'wmts') {
            // Récupérer les métadonnées de la couche sélectionnée
            const layerData = this.availableLayersData.find(l => l.name === layerName);
            const style = layerData?.style || 'normal';
            const tileMatrixSet = layerData?.tileMatrixSet || 'PM';
            
            // Construction correcte de l'URL WMTS - UN SEUL JEU DE PARAMÈTRES
            const wmtsUrl = cleanBaseUrl + 
                `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerName}&STYLE=${style}&TILEMATRIXSET=${tileMatrixSet}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`;
            
            layer = L.tileLayer(wmtsUrl, {
                attribution: customName,
                maxZoom: 19
            });
        } else if (type === 'wfs') {
            this.loadWFSLayer(cleanBaseUrl, layerName, customName, layerId);
            return;
        }

        layer.addTo(GeoflowMap.map);

        this.externalLayers.push({
            id: layerId,
            name: customName,
            type: type,
            url: cleanBaseUrl,
            layerName: layerName,
            layer: layer
        });

        GeoflowLayers.activeLayerIds.add(layerId);
        GeoflowLayers.overlayLayers[layerId] = layer;

        GeoflowUtils.showToast(`Couche "${customName}" ajoutée`, 'success');

        // Retour au panel layers
        if (GeoflowPanels.currentPanel === 'external-source') {
            GeoflowPanels.showPanel('layers');
        }

        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    /**
     * Load WFS layer
     */
    async loadWFSLayer(baseUrl, layerName, customName, layerId) {
        GeoflowUtils.showLoadingOverlay('Chargement de la couche WFS...');

        try {
            const wfsUrl = baseUrl + `?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAME=${layerName}&OUTPUTFORMAT=application/json`;
            
            const response = await fetch(wfsUrl);
            const geojson = await response.json();

            const layer = L.geoJSON(geojson, {
                style: {
                    color: '#3b82f6',
                    weight: 2,
                    fillOpacity: 0.3
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        let popup = `<div class="feature-popup"><h6>${customName}</h6><table>`;
                        Object.entries(feature.properties).forEach(([key, value]) => {
                            if (value !== null) {
                                popup += `<tr><td>${key}</td><td>${value}</td></tr>`;
                            }
                        });
                        popup += '</table></div>';
                        layer.bindPopup(popup);
                    }
                }
            });

            layer.addTo(GeoflowMap.map);

            this.externalLayers.push({
                id: layerId,
                name: customName,
                type: 'wfs',
                url: baseUrl,
                layerName: layerName,
                layer: layer
            });

            GeoflowLayers.activeLayerIds.add(layerId);
            GeoflowLayers.overlayLayers[layerId] = layer;

            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                GeoflowMap.map.fitBounds(bounds);
            }

            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast(`Couche WFS "${customName}" ajoutée`, 'success');

            // Retour au panel layers
            if (GeoflowPanels.currentPanel === 'external-source') {
                GeoflowPanels.showPanel('layers');
            }

            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }

        } catch (error) {
            console.error('WFS error:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur lors du chargement WFS', 'error');
        }
    },

    /**
     * Get external layers HTML for panel
     */
    getExternalLayersHTML() {
        if (this.externalLayers.length === 0) return '';

        let html = `
            <div class="layer-theme expanded" data-theme="external">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-globe layer-theme-icon"></i>
                        <span>Sources externes</span>
                        <span class="layer-theme-count">(${this.externalLayers.length})</span>
                    </div>
                    <i class="fa-solid fa-chevron-right layer-theme-chevron"></i>
                </div>
                <div class="layer-theme-content">
                    <div class="layer-group">
        `;

        this.externalLayers.forEach(layerInfo => {
            const isActive = GeoflowLayers.activeLayerIds.has(layerInfo.id);
            const opacity = GeoflowLayers.layerOpacities[layerInfo.id] || 1;
            const opacityPercent = Math.round(opacity * 100);

            html += `
                <div class="layer-item ${isActive ? 'active' : ''}" data-layer="${layerInfo.id}" data-external="true">
                    <div class="layer-item-main">
                        <input type="checkbox" class="layer-checkbox" ${isActive ? 'checked' : ''}>
                        <div class="layer-name">${layerInfo.name}</div>
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
                                <div><strong>Type:</strong> ${layerInfo.type.toUpperCase()}</div>
                                <div><strong>Couche:</strong> ${layerInfo.layerName}</div>
                            </div>
                            <button class="btn btn-sm btn-danger w-100" style="margin-top: 8px;" onclick="GeoflowExternalSources.removeLayer('${layerInfo.id}')">
                                <i class="fa-solid fa-trash"></i> Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Remove external layer
     */
    removeLayer(layerId) {
        const layerInfo = this.externalLayers.find(l => l.id === layerId);
        if (!layerInfo) return;

        if (confirm(`Supprimer la couche "${layerInfo.name}" ?`)) {
            GeoflowMap.map.removeLayer(layerInfo.layer);
            this.externalLayers = this.externalLayers.filter(l => l.id !== layerId);
            GeoflowLayers.activeLayerIds.delete(layerId);
            delete GeoflowLayers.overlayLayers[layerId];

            if (GeoflowPanels.currentPanel === 'layers') {
                GeoflowPanels.showPanel('layers');
            }

            GeoflowUtils.showToast('Couche supprimée', 'success');

            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
        }
    }
};