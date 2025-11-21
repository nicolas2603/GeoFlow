/**
 * Geoflow Draw Module - VERSION ANNOTATIONS
 * Handles drawing tools and geometry creation
 * With automatic projection support (EPSG:2154 → EPSG:4326)
 * Integrates with GeoflowAnnotations module
 */

const GeoflowDraw = {
    drawnItems: null,
    drawControl: null,
    activeDrawHandler: null,

    /**
     * Initialize drawing tools
     */
    init() {
        // Initialize annotations module
        if (typeof GeoflowAnnotations !== 'undefined') {
            GeoflowAnnotations.init();
            // Ne PAS lier drawnItems à drawLayerGroup
            // Créer un groupe séparé pour Leaflet.Draw
            this.drawnItems = new L.FeatureGroup();
            GeoflowMap.map.addLayer(this.drawnItems);
        } else {
            // Fallback if annotations module not loaded
            console.warn('⚠️ GeoflowAnnotations not loaded, using fallback');
            this.drawnItems = new L.FeatureGroup();
            GeoflowMap.map.addLayer(this.drawnItems);
        }

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
        GeoflowMap.map.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            const type = e.layerType;
            
            // Add to annotations
            if (typeof GeoflowAnnotations !== 'undefined') {
                GeoflowAnnotations.addDrawnFeature(layer);
            } else {
                this.drawnItems.addLayer(layer);
            }
            
            let info = `Type: ${type}`;
            
            if (type === 'polyline') {
                const length = GeoflowUtils.calculateLength(layer.getLatLngs());
                info += `<br>Longueur: ${GeoflowUtils.formatDistance(length)}`;
            } else if (type === 'polygon' || type === 'rectangle') {
                const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
                info += `<br>Surface: ${GeoflowUtils.formatArea(area)}`;
            }
            
            layer.bindPopup(info);
            GeoflowUtils.showToast('Géométrie ajoutée', 'success');
            
            this.disableActiveDrawing();

            // Update legend
            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
        });

        // Listen for edited shapes
        GeoflowMap.map.on(L.Draw.Event.EDITED, (e) => {
            GeoflowUtils.showToast(`${e.layers.getLayers().length} géométrie(s) modifiée(s)`, 'success');
            this.disableActiveDrawing();
        });

        // Listen for deleted shapes
        GeoflowMap.map.on(L.Draw.Event.DELETED, (e) => {
            GeoflowUtils.showToast(`${e.layers.getLayers().length} géométrie(s) supprimée(s)`, 'success');
            this.disableActiveDrawing();

            // Update UI if no more drawings
            if (typeof GeoflowAnnotations !== 'undefined' && GeoflowAnnotations.getDrawnCount() === 0) {
                GeoflowLayers.activeLayerIds.delete('user-draw');
                if (GeoflowPanels.currentPanel === 'layers') {
                    GeoflowPanels.showPanel('layers');
                }
            }

            // Update legend
            if (typeof GeoflowLegend !== 'undefined') {
                GeoflowLegend.requestUpdate();
            }
        });

        // Initialize proj4 definitions if available
        this.initProjections();
    },

    /**
     * Initialize projection definitions for proj4
     */
    initProjections() {
        if (typeof proj4 !== 'undefined') {
            proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
            proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
        }
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
                <div class="tool-card" data-draw="import">
                    <i class="fa-solid fa-file-import"></i>
                    <div class="tool-card-label">Importer</div>
                </div>
                <div class="tool-card" data-draw="export">
                    <i class="fa-solid fa-file-export"></i>
                    <div class="tool-card-label">Exporter</div>
                </div>
                <div class="tool-card" data-draw="delete" style="border-color: #ef4444;">
                    <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                    <div class="tool-card-label" style="color: #ef4444;">Tout effacer</div>
                </div>
            </div>
            
            <!-- Hidden file input for import -->
            <input type="file" id="import-geojson-input" accept=".geojson,.json" style="display: none;">
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        if (!GeoflowMap.map.hasLayer(this.drawControl)) {
            GeoflowMap.map.addControl(this.drawControl);
        }

        document.querySelectorAll('[data-draw]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.draw;
                
                this.disableActiveDrawing();
                
                if (type === 'edit') {
                    this.activeDrawHandler = new L.EditToolbar.Edit(GeoflowMap.map, { 
                        featureGroup: this.drawnItems 
                    });
                    this.activeDrawHandler.enable();
                    
                } else if (type === 'delete') {
                    this.clearAll();
                    
                } else if (type === 'import') {
                    document.getElementById('import-geojson-input').click();
                    
                } else if (type === 'export') {
                    this.exportGeoJSON();
                    
                } else {
                    const drawType = type.charAt(0).toUpperCase() + type.slice(1);
                    this.activeDrawHandler = new L.Draw[drawType](GeoflowMap.map, this.drawControl.options.draw[type]);
                    this.activeDrawHandler.enable();
                }
            });
        });

        const fileInput = document.getElementById('import-geojson-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.importGeoJSON(e));
        }
    },

    /**
     * Disable any active drawing handler
     */
    disableActiveDrawing() {
        if (this.activeDrawHandler) {
            try {
                if (this.activeDrawHandler.disable) {
                    this.activeDrawHandler.disable();
                }
            } catch (e) {
                console.warn('Error disabling draw handler:', e);
            }
            this.activeDrawHandler = null;
        }
        
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.style.cursor = '';
        }
    },

    /**
     * Reproject coordinates from one CRS to another
     */
    reprojectCoordinates(coords, sourceCRS, targetCRS) {
        if (typeof proj4 === 'undefined') {
            console.error('proj4 not available for reprojection');
            return coords;
        }

        const reprojectPoint = (point) => {
            return proj4(sourceCRS, targetCRS, point);
        };

        const reprojectArray = (arr) => {
            if (typeof arr[0] === 'number') {
                return reprojectPoint(arr);
            } else {
                return arr.map(reprojectArray);
            }
        };

        return reprojectArray(coords);
    },

    /**
     * Detect CRS from GeoJSON
     */
    detectCRS(geojson) {
        if (geojson.crs && geojson.crs.properties) {
            const crsName = geojson.crs.properties.name;
            
            const epsgMatch = crsName.match(/EPSG[:\s]*(\d+)/i);
            if (epsgMatch) {
                return `EPSG:${epsgMatch[1]}`;
            }
            
            if (crsName.includes('Lambert_Conformal_Conic_2SP')) {
                return 'EPSG:2154';
            }
        }
        
        return null;
    },

    /**
     * Import GeoJSON file
     */
    importGeoJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const geojson = JSON.parse(e.target.result);
                
                const sourceCRS = this.detectCRS(geojson);
                let needsReprojection = false;
                let reprojectedGeojson = geojson;

                if (sourceCRS && sourceCRS !== 'EPSG:4326') {
                    needsReprojection = true;

                    if (typeof proj4 !== 'undefined') {
                        reprojectedGeojson = JSON.parse(JSON.stringify(geojson));
                        
                        const reprojectFeature = (feature) => {
                            if (feature.geometry && feature.geometry.coordinates) {
                                feature.geometry.coordinates = this.reprojectCoordinates(
                                    feature.geometry.coordinates,
                                    sourceCRS,
                                    'EPSG:4326'
                                );
                            }
                        };

                        if (reprojectedGeojson.type === 'FeatureCollection') {
                            reprojectedGeojson.features.forEach(reprojectFeature);
                        } else if (reprojectedGeojson.type === 'Feature') {
                            reprojectFeature(reprojectedGeojson);
                        } else if (reprojectedGeojson.type && reprojectedGeojson.coordinates) {
                            reprojectedGeojson.coordinates = this.reprojectCoordinates(
                                reprojectedGeojson.coordinates,
                                sourceCRS,
                                'EPSG:4326'
                            );
                        }

                        delete reprojectedGeojson.crs;
                        
                        GeoflowUtils.showToast(`Reprojection ${sourceCRS} → WGS84 effectuée`, 'success');
                    } else {
                        GeoflowUtils.showToast(`Projection ${sourceCRS} détectée. Installez proj4 pour la reprojection automatique.`, 'warning');
                        console.error('proj4 not loaded. Cannot reproject automatically.');
                        return;
                    }
                }
                
                // Add GeoJSON to map - USE ANNOTATIONS
                L.geoJSON(reprojectedGeojson, {
                    onEachFeature: (feature, layer) => {
                        // Add to import layer via Annotations
                        if (typeof GeoflowAnnotations !== 'undefined') {
                            GeoflowAnnotations.addImportedFeature(layer);
                        } else {
                            this.drawnItems.addLayer(layer);
                        }
                        
                        // Create popup
                        let popupContent = '<div class="feature-popup">';
                        popupContent += `<h6>Import GeoJSON</h6>`;
                        if (needsReprojection) {
                            popupContent += `<div style="font-size:0.7rem;color:#10b981;margin-bottom:4px;">✓ Reprojeté en WGS84</div>`;
                        }
                        popupContent += '<table>';
                        if (feature.properties) {
                            Object.entries(feature.properties).forEach(([key, value]) => {
                                if (value !== null) {
                                    popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                                }
                            });
                        }
                        popupContent += '</table></div>';
                        layer.bindPopup(popupContent);
                    },
                    style: () => ({
                        color: '#10b981',
                        weight: 3,
                        fillOpacity: 0.3
                    }),
                    pointToLayer: (feature, latlng) => {
                        return L.marker(latlng);
                    }
                });

                // Fit bounds
                if (typeof GeoflowAnnotations !== 'undefined') {
                    const bounds = GeoflowAnnotations.importLayerGroup.getBounds();
                    if (bounds.isValid()) {
                        GeoflowMap.map.fitBounds(bounds, { padding: [50, 50] });
                    }
                }

                let featureCount = 0;
                if (reprojectedGeojson.type === 'FeatureCollection') {
                    featureCount = reprojectedGeojson.features.length;
                } else {
                    featureCount = 1;
                }

                GeoflowUtils.showToast(`${featureCount} géométrie(s) importée(s)`, 'success');

                // Update legend
                if (typeof GeoflowLegend !== 'undefined') {
                    GeoflowLegend.requestUpdate();
                }
            } catch (error) {
                console.error('Error importing GeoJSON:', error);
                GeoflowUtils.showToast('Erreur lors de l\'import du fichier', 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    },

    /**
     * Export drawn geometries as GeoJSON
     */
    exportGeoJSON() {
        let allLayers = [];
        
        // Combine draw and import layers
        if (typeof GeoflowAnnotations !== 'undefined') {
            allLayers = [
                ...GeoflowAnnotations.drawLayerGroup.getLayers(),
                ...GeoflowAnnotations.importLayerGroup.getLayers()
            ];
        } else {
            allLayers = this.drawnItems.getLayers();
        }

        if (allLayers.length === 0) {
            GeoflowUtils.showToast('Rien à exporter', 'warning');
            return;
        }

        const geojson = {
            type: 'FeatureCollection',
            features: allLayers.map((layer, i) => ({
                type: 'Feature',
                properties: { id: i + 1 },
                geometry: layer.toGeoJSON().geometry
            }))
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `geoflow_export_${Date.now()}.geojson`;
        a.click();
        URL.revokeObjectURL(url);

        GeoflowUtils.showToast(`${allLayers.length} géométrie(s) exportée(s)`, 'success');
    },

    /**
     * Clear all drawn geometries
     */
    clearAll() {
        if (typeof GeoflowAnnotations !== 'undefined') {
            const drawCount = GeoflowAnnotations.getDrawnCount();
            const importCount = GeoflowAnnotations.getImportedCount();
            const totalCount = drawCount + importCount;
            
            if (totalCount === 0) {
                GeoflowUtils.showToast('Aucune géométrie à effacer', 'info');
                return;
            }
            
            if (confirm(`Effacer toutes les annotations (${totalCount}) ?`)) {
                GeoflowAnnotations.clearDrawnFeatures();
                GeoflowAnnotations.clearImportedFeatures();
            }
        } else {
            const layers = this.drawnItems.getLayers();
            
            if (layers.length === 0) {
                GeoflowUtils.showToast('Aucune géométrie à effacer', 'info');
                return;
            }
            
            if (confirm(`Effacer toutes les géométries (${layers.length}) ?`)) {
                this.drawnItems.clearLayers();
                GeoflowUtils.showToast('Géométries effacées', 'success');

                if (typeof GeoflowLegend !== 'undefined') {
                    GeoflowLegend.requestUpdate();
                }
            }
        }
    }
};