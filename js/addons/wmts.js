/**
 * Geoflow External Sources Module - VERSION WMTS UNIQUEMENT
 * Handles adding WMTS layers from external sources
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
     * Get legend data for external WMTS layers
     */
    getExternalLayersLegend() {
        const sections = [];
        
        this.externalLayers.forEach(layerInfo => {
            // Only include active layers
            if (!GeoflowLayers.activeLayerIds.has(layerInfo.id)) {
                return;
            }
            
            sections.push({
                title: layerInfo.name,
                items: [{
                    symbol: 'polygon',
                    color: '#8b5cf6',
                    label: 'Couche de tuiles WMTS'
                }]
            });
        });
        
        return sections;
    },

    getPanelContent() {
        return `
            <!-- Header avec description -->
            <div style="margin-bottom: 16px; padding: 12px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1)); border-radius: 8px; border-left: 3px solid var(--primary);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <i class="fa-solid fa-plus" style="color: var(--primary); font-size: 1.1rem;"></i>
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">
                        Ajout WMTS
                    </span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                    Cette section vous permet d'importer des couches issues de service WMTS externes. Par soucis de fluidité, les WMS et WFS ne sont pas pris en charge.
                </p>
            </div>
			
			<div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    URL du service
                </label>
                <input type="text" id="external-service-url" class="form-control form-control-sm" 
                       placeholder="https://data.geopf.fr/wmts?...">
            </div>

            <button id="btn-fetch-capabilities" class="btn btn-sm btn-primary w-100" style="margin-bottom: 14px;">
                <i class="fa-solid fa-list"></i> Lister les couches disponibles
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
                        Couches disponibles (<span id="layer-count">0</span>)
                    </label>
                    <select id="available-layers" class="form-select form-select-sm" size="6"></select>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                        Nom de la couche
                    </label>
                    <input type="text" id="layer-custom-name" class="form-control form-control-sm" placeholder="Ma couche WMTS">
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
                <i class="fa-solid fa-plus"></i> Ajouter une couche WMTS
            </button>
        `;
    },

    filterLayers(query) {
        const select = document.getElementById('available-layers');
        const options = select.querySelectorAll('option');
        const lowerQuery = query.toLowerCase();

        let visibleCount = 0;
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            const value = option.value.toLowerCase();
            const matches = text.includes(lowerQuery) || value.includes(lowerQuery);
            option.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        document.getElementById('layer-count').textContent = visibleCount;
    },

    async fetchCapabilities() {
        const url = document.getElementById('external-service-url').value.trim();

        if (!url) {
            GeoflowUtils.showToast('Veuillez entrer une URL WMTS', 'warning');
            return;
        }

        GeoflowUtils.showLoadingOverlay('Récupération des couches WMTS...');

        try {
            // Nettoyer l'URL des paramètres REQUEST existants
            const urlObj = new URL(url);
            urlObj.searchParams.delete('REQUEST');
            let capabilitiesUrl = urlObj.toString();
            
            // Déterminer le séparateur correct
            const separator = capabilitiesUrl.includes('?') ? '&' : '?';
            capabilitiesUrl += `${separator}SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0`;

            const response = await fetch(capabilitiesUrl);
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            // Vérifier les erreurs XML
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Réponse XML invalide du serveur');
            }

            const layers = this.parseWMTSCapabilities(xmlDoc);

            if (layers.length === 0) {
                GeoflowUtils.showToast('Aucune couche WMTS trouvée', 'warning');
                GeoflowUtils.hideLoadingOverlay();
                return;
            }

            this.availableLayersData = layers;

            const select = document.getElementById('available-layers');
            select.innerHTML = layers.map(l => {
                const displayText = l.title ? `${l.title} (${l.name})` : l.name;
                return `<option value="${l.name}" data-style="${l.style}" data-tilematrixset="${l.tileMatrixSet}">${displayText}</option>`;
            }).join('');

            document.getElementById('layer-count').textContent = layers.length;
            document.getElementById('capabilities-result').style.display = 'block';
            
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast(`${layers.length} couche(s) WMTS trouvée(s)`, 'success');

        } catch (error) {
            console.error('WMTS Capabilities error:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur lors de la récupération: ' + error.message, 'error');
        }
    },

    parseWMTSCapabilities(xmlDoc) {
        const layers = [];
        const layerElements = xmlDoc.querySelectorAll('Layer');
        
        layerElements.forEach(layer => {
            const name = layer.querySelector('Identifier')?.textContent;
            const title = layer.querySelector('Title')?.textContent;
            
            // Récupérer le style (premier disponible)
            const styleElement = layer.querySelector('Style Identifier');
            const style = styleElement?.textContent || 'normal';
            
            // Récupérer le TileMatrixSet (premier disponible)
            const tileMatrixSetLink = layer.querySelector('TileMatrixSetLink TileMatrixSet');
            const tileMatrixSet = tileMatrixSetLink?.textContent || 'PM';
            
            // Récupérer le format (premier disponible)
            const formatElement = layer.querySelector('Format');
            const format = formatElement?.textContent || 'image/png';
            
            if (name) {
                layers.push({ 
                    name, 
                    title: title || name, 
                    style,
                    tileMatrixSet,
                    format
                });
            }
        });

        return layers;
    },

    addLayer() {
        const baseUrl = document.getElementById('external-service-url').value.trim();
        const selectElement = document.getElementById('available-layers');
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        
        const layerName = selectElement.value;
        const customName = document.getElementById('layer-custom-name').value.trim() || layerName;
        
        if (!layerName) {
            GeoflowUtils.showToast('Sélectionnez une couche', 'warning');
            return;
        }

        // Récupérer les métadonnées de la couche
        const layerData = this.availableLayersData.find(l => l.name === layerName);
        const style = layerData?.style || selectedOption.dataset.style || 'normal';
        const tileMatrixSet = layerData?.tileMatrixSet || selectedOption.dataset.tilematrixset || 'PM';
        const format = layerData?.format || 'image/png';

        const layerId = 'wmts_' + Date.now();
        
        // Nettoyer l'URL de base
        let cleanBaseUrl = baseUrl.split('?')[0];
        
        // Construire l'URL WMTS complète
        const separator = cleanBaseUrl.includes('?') ? '&' : '?';
        const wmtsUrl = cleanBaseUrl + separator +
            `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
            `&LAYER=${layerName}` +
            `&STYLE=${style}` +
            `&TILEMATRIXSET=${tileMatrixSet}` +
            `&TILEMATRIX={z}` +
            `&TILEROW={y}` +
            `&TILECOL={x}` +
            `&FORMAT=${encodeURIComponent(format)}`;
        
        //console.log('WMTS URL construite:', wmtsUrl);
        
        const layer = L.tileLayer(wmtsUrl, {
            attribution: customName,
            keepBuffer: 2,
            updateWhenZooming: false,
            maxZoom: 19,
            crossOrigin: true
        });

        layer.addTo(GeoflowMap.map);

        this.externalLayers.push({
            id: layerId,
            name: customName,
            type: 'wmts',
            url: cleanBaseUrl,
            layerName: layerName,
            style: style,
            tileMatrixSet: tileMatrixSet,
            format: format,
            layer: layer
        });

        GeoflowLayers.activeLayerIds.add(layerId);
        GeoflowLayers.overlayLayers[layerId] = layer;

        GeoflowUtils.showToast(`Couche WMTS "${customName}" ajoutée`, 'success');

        // Retourner au panneau des couches
        if (GeoflowPanels.currentPanel === 'external-source') {
            GeoflowPanels.showPanel('layers');
        }

        // Mettre à jour la légende
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    getExternalLayersHTML() {
        if (this.externalLayers.length === 0) return '';

        let html = `
            <div class="layer-theme expanded" data-theme="external">
                <div class="layer-theme-header">
                    <div class="layer-theme-title">
                        <i class="fa-solid fa-plus layer-theme-icon"></i>
                        <span>Couches externes</span>
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

        if (confirm(`Supprimer la couche WMTS "${layerInfo.name}" ?`)) {
            GeoflowMap.map.removeLayer(layerInfo.layer);
            this.externalLayers = this.externalLayers.filter(l => l.id !== layerId);
            GeoflowLayers.activeLayerIds.delete(layerId);
            delete GeoflowLayers.overlayLayers[layerId];

            if (GeoflowPanels.currentPanel === 'layers') {
                GeoflowPanels.showPanel('layers');
            }

            GeoflowUtils.showToast('Couche WMTS supprimée', 'success');

            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
        }
    }
};