/**
 * Geoflow External Sources Module - VERSION CORRIGÉE FINALE
 * Handles adding WMS/WMTS/WFS layers from external sources
 * 
 * CORRECTIONS:
 * 1. Fix du double '?' dans les URLs WFS ✅
 * 2. Légendes WMS avec GetLegendGraphic ✅
 * 3. Légendes WMTS désactivées (pas supporté par IGN) ✅
 * 4. Légendes WFS avec symboles simples ✅
 */

const GeoflowExternalSources = {
    externalLayers: [],
    availableLayersData: [],
    
    init() {
        // Register legend source for external layers
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.registerSource('external-layers', () => this.getExternalLayersLegend());
        }
    },

    /**
     * Get legend data for external layers
     * CORRECTION: WMTS n'utilise plus GetTile qui ne fonctionne pas
     */
    getExternalLayersLegend() {
        const sections = [];
        
        this.externalLayers.forEach(layerInfo => {
            // Only include active layers
            if (!GeoflowLayers.activeLayerIds.has(layerInfo.id)) {
                return;
            }
            
            if (layerInfo.type === 'wms') {
                // WMS GetLegendGraphic request
                const baseUrl = layerInfo.url.split('?')[0];
                const legendUrl = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layerInfo.layerName}&STYLE=`;
                
                sections.push({
                    title: layerInfo.name,
                    items: [{
                        symbol: 'image',
                        imageUrl: legendUrl,
                        label: 'Légende WMS'
                    }]
                });
            } else if (layerInfo.type === 'wmts') {
                // WMTS - Pas de légende standardisée disponible
                // Utiliser un symbole simple
                sections.push({
                    title: layerInfo.name,
                    items: [{
                        symbol: 'polygon',
                        color: '#8b5cf6',
                        label: 'Couche de tuiles WMTS'
                    }]
                });
            } else if (layerInfo.type === 'wfs') {
                // WFS - simple color indicator
                sections.push({
                    title: layerInfo.name,
                    items: [{
                        symbol: 'polygon',
                        color: '#3b82f6',
                        label: 'Entités WFS'
                    }]
                });
            }
        });
        
        return sections;
    },

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

    attachListeners() {
        document.getElementById('btn-fetch-capabilities')?.addEventListener('click', () => {
            this.fetchCapabilities();
        });

        document.getElementById('btn-add-layer')?.addEventListener('click', () => {
            this.addLayer();
        });

        document.getElementById('filter-layers')?.addEventListener('input', (e) => {
            this.filterLayers(e.target.value);
        });

        document.getElementById('available-layers')?.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const layerTitle = selectedOption.textContent;
            document.getElementById('layer-custom-name').value = layerTitle;
        });
    },

    getAddSourceButton() {
        return `
            <button class="btn btn-sm btn-primary w-100" id="btn-add-external-source" style="margin-bottom: 14px;">
                <i class="fa-solid fa-plus"></i> Ajouter une source externe
            </button>
        `;
    },

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
            
            // Déterminer le séparateur correct
            const separator = capabilitiesUrl.includes('?') ? '&' : '?';
            
            if (type === 'wms') {
                capabilitiesUrl += `${separator}SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`;
            } else if (type === 'wmts') {
                capabilitiesUrl += `${separator}SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0`;
            } else if (type === 'wfs') {
                capabilitiesUrl += `${separator}SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0`;
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

            this.availableLayersData = layers;

            const select = document.getElementById('available-layers');
            select.innerHTML = layers.map(l => `<option value="${l.name}">${l.title || l.name}</option>`).join('');

            document.getElementById('capabilities-result').style.display = 'block';
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast(`${layers.length} couche(s) trouvée(s)`, 'success');

        } catch (error) {
            console.error('Capabilities error:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur lors de la récupération: ' + error.message, 'error');
        }
    },

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
                
                const styleElement = layer.querySelector('Style Identifier');
                const style = styleElement?.textContent || 'normal';
                
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

        let cleanBaseUrl = baseUrl.split('?')[0];

        if (type === 'wms') {
            layer = L.tileLayer.wms(cleanBaseUrl, {
                layers: layerName,
                format: 'image/png',
                transparent: transparent,
                version: '1.3.0',
                attribution: customName
            });
        } else if (type === 'wmts') {
            const layerData = this.availableLayersData.find(l => l.name === layerName);
            const style = layerData?.style || 'normal';
            const tileMatrixSet = layerData?.tileMatrixSet || 'PM';
            
            const separator = cleanBaseUrl.includes('?') ? '&' : '?';
            const wmtsUrl = cleanBaseUrl + separator +
                `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerName}&STYLE=${style}&TILEMATRIXSET=${tileMatrixSet}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`;
            
            layer = L.tileLayer(wmtsUrl, {
                attribution: customName,
				keepBuffer: 2,
				updateWhenZooming: false,
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

        if (GeoflowPanels.currentPanel === 'external-source') {
            GeoflowPanels.showPanel('layers');
        }

        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    async loadWFSLayer(baseUrl, layerName, customName, layerId) {
        GeoflowUtils.showLoadingOverlay('Chargement de la couche WFS...');

        try {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const wfsUrl = baseUrl + `${separator}SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAME=${layerName}&OUTPUTFORMAT=application/json`;
            
            console.log('WFS URL construite:', wfsUrl);
            
            const response = await fetch(wfsUrl);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Response non-JSON:', text);
                throw new Error('La réponse n\'est pas du JSON valide');
            }
            
            const geojson = await response.json();
            
            if (!geojson.features || geojson.features.length === 0) {
                throw new Error('Aucune entité trouvée dans la couche WFS');
            }

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
                            if (value !== null && 
                                key !== 'geom' && 
                                key !== 'geometry' && 
                                key !== 'the_geom' &&
                                !key.startsWith('_')) {
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
            GeoflowUtils.showToast(`Couche WFS "${customName}" ajoutée (${geojson.features.length} entités)`, 'success');

            if (GeoflowPanels.currentPanel === 'external-source') {
                GeoflowPanels.showPanel('layers');
            }

            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }

        } catch (error) {
            console.error('WFS error:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur WFS: ' + error.message, 'error');
        }
    },

    getExternalLayersHTML() {
        if (this.externalLayers.length === 0) return '';

        let html = `
            <div class="layer-theme expanded" data-theme="external">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-plus layer-theme-icon"></i>
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