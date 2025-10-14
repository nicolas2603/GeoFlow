/**
 * GeoFlow Draw Module
 * Handles drawing tools and geometry creation
 */

const GeoFlowDraw = {
    drawnItems: null,
    drawControl: null,

    /**
     * Initialize drawing tools
     */
    init() {
        this.drawnItems = new L.FeatureGroup();
        GeoFlowMap.map.addLayer(this.drawnItems);

        this.drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polyline: { shapeOptions: { color: '#2563eb', weight: 3 } },
                polygon: { shapeOptions: { color: '#2563eb', fillOpacity: 0.3 } },
                circle: { shapeOptions: { color: '#2563eb', fillOpacity: 0.3 } },
                rectangle: { shapeOptions: { color: '#2563eb', fillOpacity: 0.3 } },
                marker: true,
                circlemarker: false
            },
            edit: { 
                featureGroup: this.drawnItems, 
                remove: true 
            }
        });

        // Listen for created shapes
        GeoFlowMap.map.on(L.Draw.Event.CREATED, (e) => {
            this.drawnItems.addLayer(e.layer);
            const type = e.layerType;
            let info = `Type: ${type}`;
            
            if (type === 'polyline') {
                const length = GeoFlowUtils.calculateLength(e.layer.getLatLngs());
                info += `<br>Longueur: ${GeoFlowUtils.formatDistance(length)}`;
            } else if (type === 'polygon' || type === 'rectangle') {
                const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
                info += `<br>Surface: ${GeoFlowUtils.formatArea(area)}`;
            }
            
            e.layer.bindPopup(info);
            GeoFlowUtils.showToast('Géométrie ajoutée', 'success');
        });

        // Listen for edited shapes
        GeoFlowMap.map.on(L.Draw.Event.EDITED, (e) => {
            GeoFlowUtils.showToast(`${e.layers.getLayers().length} géométrie(s) modifiée(s)`, 'success');
        });

        // Listen for deleted shapes
        GeoFlowMap.map.on(L.Draw.Event.DELETED, (e) => {
            GeoFlowUtils.showToast(`${e.layers.getLayers().length} géométrie(s) supprimée(s)`, 'success');
        });
    },

    /**
     * Get draw panel content HTML
     */
    getPanelContent() {
        return `
            <div class="tool-grid">
                <div class="tool-card" data-draw="marker">
                    <i class="fa-solid fa-location-dot"></i>
                    <div class="tool-card-label">Point</div>
                </div>
                <div class="tool-card" data-draw="polyline">
                    <i class="fa-solid fa-bezier-curve"></i>
                    <div class="tool-card-label">Ligne</div>
                </div>
                <div class="tool-card" data-draw="polygon">
                    <i class="fa-solid fa-draw-polygon"></i>
                    <div class="tool-card-label">Polygone</div>
                </div>
                <div class="tool-card" data-draw="rectangle">
                    <i class="fa-regular fa-square"></i>
                    <div class="tool-card-label">Rectangle</div>
                </div>
                <div class="tool-card" data-draw="circle">
                    <i class="fa-regular fa-circle"></i>
                    <div class="tool-card-label">Cercle</div>
                </div>
                <div class="tool-card" data-draw="edit">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <div class="tool-card-label">Éditer</div>
                </div>
                <div class="tool-card" data-draw="delete">
                    <i class="fa-solid fa-trash"></i>
                    <div class="tool-card-label">Supprimer</div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px;">
                <label class="btn btn-sm btn-outline-primary" style="font-size: 0.8rem; padding: 6px 10px; cursor: pointer; margin: 0;">
                    <i class="fa-solid fa-file-import"></i> Importer GeoJSON
                    <input type="file" id="import-geojson" accept=".geojson,.json" style="display: none;">
                </label>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-sm btn-primary flex-fill" id="export-geojson" style="font-size: 0.8rem; padding: 6px 10px;">
                        <i class="fa-solid fa-file-export"></i> Exporter
                    </button>
                    <button class="btn btn-sm btn-outline-danger flex-fill" id="clear-all" style="font-size: 0.8rem; padding: 6px 10px;">
                        <i class="fa-solid fa-circle-xmark"></i> Effacer
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        // Add draw control to map
        if (!GeoFlowMap.map.hasLayer(this.drawControl)) {
            GeoFlowMap.map.addControl(this.drawControl);
        }

        // Drawing tools
        document.querySelectorAll('[data-draw]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.draw;
                if (type === 'edit') {
                    new L.EditToolbar.Edit(GeoFlowMap.map, { 
                        featureGroup: this.drawnItems 
                    }).enable();
                } else if (type === 'delete') {
                    new L.EditToolbar.Delete(GeoFlowMap.map, { 
                        featureGroup: this.drawnItems 
                    }).enable();
                } else {
                    const drawType = type.charAt(0).toUpperCase() + type.slice(1);
                    new L.Draw[drawType](GeoFlowMap.map, this.drawControl.options.draw[type]).enable();
                }
            });
        });

        // Import button
        const importBtn = document.getElementById('import-geojson');
        if (importBtn) {
            importBtn.addEventListener('change', (e) => this.importGeoJSON(e));
        }

        // Export button
        const exportBtn = document.getElementById('export-geojson');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportGeoJSON());
        }

        // Clear all button
        const clearBtn = document.getElementById('clear-all');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAll());
        }
    },

    /**
     * Import GeoJSON file
     * @param {Event} event - File input change event
     */
    importGeoJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const geojson = JSON.parse(e.target.result);
                
                // Check for CRS/projection information
                let needsReprojection = false;
                let sourceCRS = null;
                
                // Check CRS in the GeoJSON
                if (geojson.crs && geojson.crs.properties) {
                    const crsName = geojson.crs.properties.name;
                    
                    // Detect EPSG:2154 (Lambert 93) or other non-WGS84 projections
                    if (crsName.includes('2154') || 
                        crsName.includes('EPSG:2154') || 
                        crsName.includes('Lambert_Conformal_Conic_2SP')) {
                        needsReprojection = true;
                        sourceCRS = 'EPSG:2154';
                    }
                }
                
                // If reprojection needed, show warning
                if (needsReprojection) {
                    GeoFlowUtils.showToast(`Projection détectée: ${sourceCRS}. La reprojection automatique n'est pas disponible. Veuillez convertir en EPSG:4326 (WGS84).`, 'warning');
                    console.warn('GeoJSON uses non-WGS84 projection. Automatic reprojection not available.');
                    console.warn('Please convert your GeoJSON to EPSG:4326 using tools like ogr2ogr or QGIS.');
                    console.warn('Command example: ogr2ogr -f GeoJSON -t_srs EPSG:4326 output.geojson input.geojson');
                    
                    // Still try to load but coordinates will likely be wrong
                    GeoFlowUtils.showToast('Les coordonnées peuvent être incorrectes. Conversion recommandée.', 'error');
                }
                
                // Add GeoJSON to map using Leaflet's native support
                const layer = L.geoJSON(geojson, {
                    onEachFeature: (feature, layer) => {
                        // Add to drawn items so it can be edited
                        this.drawnItems.addLayer(layer);
                        
                        // Create popup content
                        let popupContent = '<div class="feature-popup"><h6>Géométrie importée</h6><table>';
                        if (feature.properties) {
                            Object.entries(feature.properties).forEach(([key, value]) => {
                                popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                            });
                        }
                        popupContent += '</table></div>';
                        layer.bindPopup(popupContent);
                    },
                    style: (feature) => {
                        return {
                            color: '#2563eb',
                            weight: 3,
                            fillOpacity: 0.3
                        };
                    },
                    pointToLayer: (feature, latlng) => {
                        return L.marker(latlng);
                    }
                });

                // Fit bounds to imported features
                if (layer.getBounds && layer.getBounds().isValid()) {
                    GeoFlowMap.map.fitBounds(layer.getBounds(), { padding: [50, 50] });
                } else {
                    GeoFlowUtils.showToast('Impossible de zoomer sur les géométries', 'warning');
                }

                // Count features
                let featureCount = 0;
                if (geojson.type === 'FeatureCollection') {
                    featureCount = geojson.features.length;
                } else if (geojson.type === 'Feature') {
                    featureCount = 1;
                } else {
                    featureCount = 1; // Single geometry
                }
                
                if (!needsReprojection) {
                    GeoFlowUtils.showToast(`${featureCount} géométrie(s) importée(s)`, 'success');
                }
                
            } catch (error) {
                console.error('Error importing GeoJSON:', error);
                GeoFlowUtils.showToast('Erreur lors de l\'import du fichier', 'error');
            }
        };
        
        reader.readAsText(file);
        // Reset input to allow reimporting the same file
        event.target.value = '';
    },

    /**
     * Export drawn geometries as GeoJSON
     */
    exportGeoJSON() {
        const layers = this.drawnItems.getLayers();
        if (layers.length === 0) {
            GeoFlowUtils.showToast('Rien à exporter', 'warning');
            return;
        }

        const geojson = {
            type: 'FeatureCollection',
            features: layers.map((layer, i) => ({
                type: 'Feature',
                properties: { id: i + 1 },
                geometry: layer.toGeoJSON().geometry
            }))
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `geoflow_${Date.now()}.geojson`;
        a.click();
        URL.revokeObjectURL(url);

        GeoFlowUtils.showToast('Export réussi', 'success');
    },

    /**
     * Clear all drawn geometries
     */
    clearAll() {
        if (confirm('Effacer toutes les géométries ?')) {
            this.drawnItems.clearLayers();
            GeoFlowUtils.showToast('Géométries effacées', 'success');
        }
    }
};