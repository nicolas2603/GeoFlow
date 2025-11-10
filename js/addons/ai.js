/**
 * Geoflow Layer Search Module
 * Recherche de couches en langage naturel avec apprentissage
 */

const GeoflowLayerSearch = {
    searchTimeout: null,
    currentResults: [],
    currentQuery: '',
    
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
                    Décrivez la couche que vous cherchez en langage naturel. Le système apprend de vos choix pour améliorer les résultats.
                </p>
            </div>

            <!-- Zone de recherche -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Que recherchez-vous ?
                </label>
                <div style="position: relative;">
                    <input 
                        type="text" 
                        id="ai-search-input" 
                        class="form-control form-control-sm" 
                        placeholder="Ex: Je veux les parcelles cadastrales..."
                        style="padding-right: 36px;"
                    >
                    <i class="fa-solid fa-sparkles" 
                       style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--primary); font-size: 0.9rem; pointer-events: none;">
                    </i>
                </div>
            </div>

            <!-- Suggestions populaires -->
            <div id="ai-search-suggestions" style="margin-bottom: 16px;">
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
                    <i class="fa-solid fa-fire" style="color: #f59e0b; margin-right: 4px;"></i>
                    Suggestions populaires
                </div>
                <div id="suggestions-chips" style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <!-- Généré dynamiquement -->
                </div>
            </div>

            <!-- Résultats de recherche -->
            <div id="ai-search-results" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">
                        <i class="fa-solid fa-list" style="margin-right: 4px;"></i>
                        Résultats
                    </div>
                    <div id="result-count" style="font-size: 0.75rem; color: var(--text-secondary);">
                    </div>
                </div>
                <div id="results-list"></div>
            </div>

            <!-- Message vide -->
            <div id="ai-search-empty" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                <div style="font-size: 0.85rem;">
                    Commencez par décrire la couche recherchée
                </div>
            </div>
        `;
    },
    
    /**
     * Attach listeners
     */
    attachListeners() {
        // Input de recherche avec debounce
        const searchInput = document.getElementById('ai-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                
                const query = e.target.value.trim();
                this.currentQuery = query;
                
                if (query.length < 3) {
                    this.hideResults();
                    this.showSuggestions();
                    this.showEmpty();
                    return;
                }
                
                this.hideEmpty();
                this.searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 500);
            });
            
            // Focus automatique sur l'input
            setTimeout(() => searchInput.focus(), 100);
        }
        
        // Charger les suggestions
        this.loadSuggestions();
    },
    
    /**
     * Perform search
     */
    async performSearch(query) {
        try {
            GeoflowUtils.showLoadingOverlay('Analyse de votre demande...');
            
            const bounds = GeoflowMap.map.getBounds();
            
            const response = await fetch(`${GeoflowConfig.api.backend}/api/layers/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query,
                    bounds: {
                        _southWest: bounds.getSouthWest(),
                        _northEast: bounds.getNorthEast()
                    }
                })
            });
            
            if (!response.ok) throw new Error('Erreur de recherche');
            
            const data = await response.json();
            this.currentResults = data.results;
            
            // Afficher les mots-clés détectés
            console.log('🎯 Mots-clés détectés:', data.keywords);
            console.log('🔄 Mots-clés étendus:', data.expanded_keywords);
            console.log('💡 Intention:', data.intent);
            
            this.displayResults(data.results, data.keywords);
            
            GeoflowUtils.hideLoadingOverlay();
        } catch (error) {
            console.error('Search error:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur lors de la recherche', 'error');
        }
    },
    
    /**
     * Display results
     */
    displayResults(results, keywords) {
        const resultsContainer = document.getElementById('ai-search-results');
		const resultsList = document.getElementById('results-list');
		const resultCount = document.getElementById('result-count');
		
		this.hideSuggestions();
        
		// Afficher les mots-clés détectés
		const keywordsBadge = keywords && keywords.length > 0 ? `
			<div style="margin-bottom: 12px; padding: 8px 12px; background: rgba(37, 99, 235, 0.1); border-radius: 6px; border-left: 3px solid var(--primary);">
				<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
					🎯 Recherche détectée :
				</div>
				<div style="display: flex; gap: 6px; flex-wrap: wrap;">
					${keywords.map(kw => `
						<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
							${kw}
						</span>
					`).join('')}
				</div>
			</div>
		` : '';
		
        if (results.length === 0) {
			resultCount.textContent = 'Aucun résultat';
			resultsList.innerHTML = keywordsBadge + `
				<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 0.85rem; background: var(--hover-bg); border-radius: 8px;">
					<i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; opacity: 0.5; margin-bottom: 8px; display: block;"></i>
					Aucune couche trouvée pour cette recherche.<br>
					<span style="font-size: 0.75rem;">Essayez avec d'autres mots-clés</span>
				</div>
			`;
		} else {
			resultCount.textContent = `${results.length} couche${results.length > 1 ? 's' : ''}`;
			
			resultsList.innerHTML = keywordsBadge + results.map((layer, index) => `
                <div class="ai-search-result-card" data-layer-id="${layer.id}" style="
                    padding: 12px;
                    background: var(--hover-bg);
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 2px solid transparent;
                    position: relative;
                " onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateY(-2px)'"
                   onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
                    
                    <!-- Badge de score -->
                    ${layer.final_score > 50 ? `
                        <div style="position: absolute; top: 8px; right: 8px; background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                            <i class="fa-solid fa-star" style="font-size: 0.6rem;"></i> Pertinent
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 12px; align-items: start;">
                        <!-- Icône de type -->
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: var(--primary);
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            color: white;
                            font-size: 1.1rem;
                        ">
                            <i class="fa-solid fa-${this.getLayerIcon(layer.type)}"></i>
                        </div>
                        
                        <div style="flex: 1; min-width: 0;">
                            <!-- Nom -->
                            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                                ${layer.name}
                                ${layer.official_source ? '<i class="fa-solid fa-certificate" style="color: var(--primary); font-size: 0.75rem;" title="Source officielle"></i>' : ''}
                            </div>
                            
                            <!-- Description -->
                            ${layer.description ? `
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px; line-height: 1.3;">
                                    ${layer.description}
                                </div>
                            ` : ''}
                            
                            <!-- Métadonnées -->
                            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
                                <span style="background: rgba(37, 99, 235, 0.1); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">
                                    ${layer.type.toUpperCase()}
                                </span>
                                ${layer.official_source ? `
                                    <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">
                                        Officiel
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- Bouton d'ajout -->
                        <button class="btn-add-ai-layer" data-layer-id="${layer.id}" style="
                            background: var(--primary);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 14px;
                            font-size: 0.8rem;
                            cursor: pointer;
                            white-space: nowrap;
                            transition: all 0.2s;
                            font-weight: 500;
                        " onmouseover="this.style.transform='scale(1.05)'"
                           onmouseout="this.style.transform='scale(1)'">
                            <i class="fa-solid fa-plus" style="margin-right: 4px;"></i>
                            Ajouter
                        </button>
                    </div>
                </div>
            `).join('');
            
            // Attacher les listeners d'ajout
            resultsList.querySelectorAll('.btn-add-ai-layer').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const layerId = btn.dataset.layerId;
                    this.addLayerFromCatalog(layerId);
                });
            });
        }
        
        resultsContainer.style.display = 'block';
    },
    
    /**
     * Get icon for layer type
     */
    getLayerIcon(type) {
        const icons = {
            'wms': 'layer-group',
            'wmts': 'border-all',
            'wfs': 'vector-square',
            'geojson': 'file-code'
        };
        return icons[type] || 'layer-group';
    },
    
    /**
     * Add layer from catalog
     */
    async addLayerFromCatalog(layerId) {
        const layer = this.currentResults.find(l => l.id == layerId);
        if (!layer) return;
        
        try {
            GeoflowUtils.showLoadingOverlay('Ajout de la couche...');
            
            // Enregistrer la sélection (apprentissage)
            await fetch(`${GeoflowConfig.api.backend}/api/layers/${layerId}/select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: this.currentQuery })
            });
            
            // Ajouter la couche
            const externalLayerId = 'catalog_' + Date.now();
            let leafletLayer;
            
            if (layer.type === 'wmts') {
                const separator = layer.url.includes('?') ? '&' : '?';
                leafletLayer = L.tileLayer(
                    layer.url + separator + `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer.layer_name}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`,
                    { attribution: layer.name, maxZoom: 19 }
                );
            } else if (layer.type === 'wms') {
                leafletLayer = L.tileLayer.wms(layer.url, {
                    layers: layer.layer_name,
                    format: 'image/png',
                    transparent: true,
                    attribution: layer.name
                });
            } else if (layer.type === 'wfs') {
                await this.loadWFSFromCatalog(layer, externalLayerId);
                GeoflowUtils.hideLoadingOverlay();
                return;
            }
            
            if (leafletLayer) {
                leafletLayer.addTo(GeoflowMap.map);
                
                GeoflowExternalSources.externalLayers.push({
                    id: externalLayerId,
                    name: layer.name,
                    type: layer.type,
                    url: layer.url,
                    layerName: layer.layer_name,
                    layer: leafletLayer,
                    fromCatalog: true,
                    catalogId: layerId
                });
                
                GeoflowLayers.activeLayerIds.add(externalLayerId);
                GeoflowLayers.overlayLayers[externalLayerId] = leafletLayer;
            }
            
            // Retour au panel layers
            GeoflowPanels.showPanel('layers');
            
            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
            
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast(`✨ "${layer.name}" ajoutée`, 'success');
            
        } catch (error) {
            console.error('Error adding layer:', error);
            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('Erreur lors de l\'ajout', 'error');
        }
    },
    
    /**
     * Load WFS layer
     */
    async loadWFSFromCatalog(layer, externalLayerId) {
        try {
            const separator = layer.url.includes('?') ? '&' : '?';
            const wfsUrl = layer.url + `${separator}SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAME=${layer.layer_name}&OUTPUTFORMAT=application/json`;
            
            const response = await fetch(wfsUrl);
            if (!response.ok) throw new Error('Erreur WFS');
            
            const geojson = await response.json();
            
            const leafletLayer = L.geoJSON(geojson, {
                style: { color: '#3b82f6', weight: 2, fillOpacity: 0.3 },
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        let popup = `<div class="feature-popup"><h6>${layer.name}</h6><table>`;
                        Object.entries(feature.properties).forEach(([key, value]) => {
                            if (value !== null && !key.startsWith('_')) {
                                popup += `<tr><td>${key}</td><td>${value}</td></tr>`;
                            }
                        });
                        popup += '</table></div>';
                        layer.bindPopup(popup);
                    }
                }
            });
            
            leafletLayer.addTo(GeoflowMap.map);
            
            GeoflowExternalSources.externalLayers.push({
                id: externalLayerId,
                name: layer.name,
                type: 'wfs',
                url: layer.url,
                layerName: layer.layer_name,
                layer: leafletLayer,
                fromCatalog: true,
                catalogId: layer.id
            });
            
            GeoflowLayers.activeLayerIds.add(externalLayerId);
            GeoflowLayers.overlayLayers[externalLayerId] = leafletLayer;
            
            const bounds = leafletLayer.getBounds();
            if (bounds.isValid()) {
                GeoflowMap.map.fitBounds(bounds);
            }
            
            GeoflowPanels.showPanel('layers');
            
            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
            
            GeoflowUtils.showToast(`✨ "${layer.name}" ajoutée (${geojson.features.length} entités)`, 'success');
            
        } catch (error) {
            throw error;
        }
    },
    
    /**
     * Load suggestions
     */
    async loadSuggestions() {
        try {
            const response = await fetch(`${GeoflowConfig.api.backend}/api/layers/suggestions`);
            const data = await response.json();
            
            const container = document.getElementById('suggestions-chips');
            if (!container) return;
            
            container.innerHTML = data.suggestions.slice(0, 8).map(layer => `
                <button class="suggestion-chip" data-query="${layer.name}" style="
                    background: var(--hover-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 6px 12px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-primary);
                    white-space: nowrap;
                " onmouseover="this.style.background='var(--primary)'; this.style.color='white'; this.style.borderColor='var(--primary)'"
                   onmouseout="this.style.background='var(--hover-bg)'; this.style.color='var(--text-primary)'; this.style.borderColor='var(--border-color)'">
                    <i class="fa-solid fa-layer-group" style="font-size: 0.7rem; margin-right: 4px;"></i>
                    ${layer.name}
                </button>
            `).join('');
            
            // Listeners sur les suggestions
            container.querySelectorAll('.suggestion-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const query = chip.dataset.query;
                    const input = document.getElementById('ai-search-input');
                    if (input) {
                        input.value = query;
                        this.performSearch(query);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading suggestions:', error);
        }
    },
    
    hideResults() {
        const results = document.getElementById('ai-search-results');
        if (results) results.style.display = 'none';
    },
    
    showSuggestions() {
        const suggestions = document.getElementById('ai-search-suggestions');
        if (suggestions) suggestions.style.display = 'block';
    },
    
    hideSuggestions() {
        const suggestions = document.getElementById('ai-search-suggestions');
        if (suggestions) suggestions.style.display = 'none';
    },
    
    showEmpty() {
        const empty = document.getElementById('ai-search-empty');
        if (empty) empty.style.display = 'block';
    },
    
    hideEmpty() {
        const empty = document.getElementById('ai-search-empty');
        if (empty) empty.style.display = 'none';
    }
};