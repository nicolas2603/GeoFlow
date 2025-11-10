/**
 * Geoflow Draw Module
 * Handles drawing tools and geometry creation
 * With automatic projection support (EPSG:2154 → EPSG:4326)
 */

const GeoflowDraw = {
    drawnItems: null,
    drawControl: null,
    activeDrawHandler: null, // Store active drawing handler

    /**
     * Initialize drawing tools
     */
    init() {
        this.drawnItems = new L.FeatureGroup();
        GeoflowMap.map.addLayer(this.drawnItems);

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
            this.drawnItems.addLayer(e.layer);
            const type = e.layerType;
            let info = `Type: ${type}`;
            
            if (type === 'polyline') {
                const length = GeoflowUtils.calculateLength(e.layer.getLatLngs());
                info += `<br>Longueur: ${GeoflowUtils.formatDistance(length)}`;
            } else if (type === 'polygon' || type === 'rectangle') {
                const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
                info += `<br>Surface: ${GeoflowUtils.formatArea(area)}`;
            }
            
            e.layer.bindPopup(info);
            GeoflowUtils.showToast('Géométrie ajoutée', 'success');
            
            // Clean up after drawing is complete
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
            // Define Lambert 93 (EPSG:2154) - France
            proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
            
            // Define WGS84 (EPSG:4326)
            proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
            
            //console.log('✅ Projections initialized (EPSG:2154, EPSG:4326)');
        } else {
            console.warn('⚠️ proj4 not loaded - automatic reprojection disabled');
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
        // Add draw control to map
        if (!GeoflowMap.map.hasLayer(this.drawControl)) {
            GeoflowMap.map.addControl(this.drawControl);
        }

        // Drawing tools
        document.querySelectorAll('[data-draw]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.draw;
                
                // Disable any active drawing handler first
                this.disableActiveDrawing();
                
                if (type === 'edit') {
                    // Enable edit mode
                    this.activeDrawHandler = new L.EditToolbar.Edit(GeoflowMap.map, { 
                        featureGroup: this.drawnItems 
                    });
                    this.activeDrawHandler.enable();
                    
                } else if (type === 'delete') {
                    // Clear all geometries
                    this.clearAll();
                    
                } else if (type === 'import') {
                    // Trigger file input
                    document.getElementById('import-geojson-input').click();
                    
                } else if (type === 'export') {
                    // Export geometries
                    this.exportGeoJSON();
                    
                } else {
                    // Enable drawing mode for shapes
                    const drawType = type.charAt(0).toUpperCase() + type.slice(1);
                    this.activeDrawHandler = new L.Draw[drawType](GeoflowMap.map, this.drawControl.options.draw[type]);
                    this.activeDrawHandler.enable();
                }
            });
        });

        // Hidden file input listener
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
        
        // Reset cursor
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.style.cursor = '';
        }
    },

    /**
     * Reproject coordinates from one CRS to another
     * @param {Array} coords - Coordinates to reproject
     * @param {string} sourceCRS - Source CRS (e.g., 'EPSG:2154')
     * @param {string} targetCRS - Target CRS (e.g., 'EPSG:4326')
     * @returns {Array} Reprojected coordinates
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
                // It's a point [x, y]
                return reprojectPoint(arr);
            } else {
                // It's an array of coordinates
                return arr.map(reprojectArray);
            }
        };

        return reprojectArray(coords);
    },

    /**
     * Detect CRS from GeoJSON
     * @param {Object} geojson - GeoJSON object
     * @returns {string|null} CRS identifier (e.g., 'EPSG:2154') or null
     */
    detectCRS(geojson) {
        if (geojson.crs && geojson.crs.properties) {
            const crsName = geojson.crs.properties.name;
            
            // Extract EPSG code
            const epsgMatch = crsName.match(/EPSG[:\s]*(\d+)/i);
            if (epsgMatch) {
                return `EPSG:${epsgMatch[1]}`;
            }
            
            // Check for Lambert_Conformal_Conic_2SP (Lambert 93)
            if (crsName.includes('Lambert_Conformal_Conic_2SP')) {
                return 'EPSG:2154';
            }
        }
        
        return null;
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
                
                // Detect CRS
                const sourceCRS = this.detectCRS(geojson);
                let needsReprojection = false;
                let reprojectedGeojson = geojson;

                if (sourceCRS && sourceCRS !== 'EPSG:4326') {
                    needsReprojection = true;
                    //console.log(`Detected CRS: ${sourceCRS}`);

                    // Check if proj4 is available
                    if (typeof proj4 !== 'undefined') {
                        //console.log(`Reprojecting from ${sourceCRS} to EPSG:4326...`);
                        
                        // Reproject the GeoJSON
                        reprojectedGeojson = JSON.parse(JSON.stringify(geojson)); // Deep clone
                        
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
                            // Single geometry
                            reprojectedGeojson.coordinates = this.reprojectCoordinates(
                                reprojectedGeojson.coordinates,
                                sourceCRS,
                                'EPSG:4326'
                            );
                        }

                        // Remove CRS from reprojected GeoJSON
                        delete reprojectedGeojson.crs;
                        
                        GeoflowUtils.showToast(`Reprojection ${sourceCRS} → WGS84 effectuée`, 'success');
                    } else {
                        // proj4 not available
                        GeoflowUtils.showToast(`Projection ${sourceCRS} détectée. Installez proj4 pour la reprojection automatique.`, 'warning');
                        console.error('proj4 not loaded. Cannot reproject automatically.');
                        console.log('Add proj4 to your HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js"></script>');
                        return;
                    }
                }
                
                // Add GeoJSON to map
                L.geoJSON(reprojectedGeojson, {
                    onEachFeature: (feature, layer) => {
                        // Handle MultiPolygon - convert to separate Polygons
                        if (feature.geometry.type === 'MultiPolygon') {
                            feature.geometry.coordinates.forEach((polygonCoords, index) => {
                                const singlePolygon = L.polygon(
                                    polygonCoords.map(ring => 
                                        ring.map(coord => [coord[1], coord[0]]) // [lng, lat] → [lat, lng]
                                    ),
                                    {
                                        color: '#10b981',
                                        weight: 3,
                                        fillOpacity: 0.3
                                    }
                                );
                                
                                this.drawnItems.addLayer(singlePolygon);
                                
                                // Create popup for each polygon part
                                let popupContent = '<div class="feature-popup">';
                                popupContent += `<h6>Géométrie importée</h6>`;
                                if (feature.geometry.coordinates.length > 1) {
                                    popupContent += `<div style="font-size:0.7rem;color:#6b7280;margin-bottom:4px;">Partie ${index + 1}/${feature.geometry.coordinates.length}</div>`;
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
                                singlePolygon.bindPopup(popupContent);
                            });
                        } 
                        // Handle MultiLineString - convert to separate LineStrings
                        else if (feature.geometry.type === 'MultiLineString') {
                            feature.geometry.coordinates.forEach((lineCoords, index) => {
                                const singleLine = L.polyline(
                                    lineCoords.map(coord => [coord[1], coord[0]]),
                                    {
                                        color: '#10b981',
                                        weight: 3
                                    }
                                );
                                
                                this.drawnItems.addLayer(singleLine);
                                
                                let popupContent = '<div class="feature-popup">';
                                popupContent += `<h6>Géométrie importée</h6>`;
                                if (feature.geometry.coordinates.length > 1) {
                                    popupContent += `<div style="font-size:0.7rem;color:#6b7280;margin-bottom:4px;">Partie ${index + 1}/${feature.geometry.coordinates.length}</div>`;
                                }
                                popupContent += '</table></div>';
                                singleLine.bindPopup(popupContent);
                            });
                        }
                        // Handle MultiPoint - convert to separate Points
                        else if (feature.geometry.type === 'MultiPoint') {
                            feature.geometry.coordinates.forEach((pointCoord, index) => {
                                const singleMarker = L.marker([pointCoord[1], pointCoord[0]]);
                                
                                this.drawnItems.addLayer(singleMarker);
                                
                                let popupContent = '<div class="feature-popup">';
                                popupContent += `<h6>Géométrie importée</h6>`;
                                if (needsReprojection) {
                                    popupContent += `<div style="font-size:0.7rem;color:#10b981;margin-bottom:4px;">✓ Reprojetée en WGS84</div>`;
                                }
                                if (feature.geometry.coordinates.length > 1) {
                                    popupContent += `<div style="font-size:0.7rem;color:#6b7280;margin-bottom:4px;">Point ${index + 1}/${feature.geometry.coordinates.length}</div>`;
                                }
                                popupContent += '</table></div>';
                                singleMarker.bindPopup(popupContent);
                            });
                        }
                        // Handle regular geometries (Polygon, LineString, Point, etc.)
                        else {
                            this.drawnItems.addLayer(layer);
                            
                            // Create popup content
                            let popupContent = '<div class="feature-popup">';
                            popupContent += `<h6>Géométrie importée</h6>`;
                            if (needsReprojection) {
                                popupContent += `<div style="font-size:0.7rem;color:#10b981;margin-bottom:4px;">✓ Reprojetée en WGS84</div>`;
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
                        }
                    },
                    style: (feature) => {
                        return {
                            color: '#10b981',
                            weight: 3,
                            fillOpacity: 0.3
                        };
                    },
                    pointToLayer: (feature, latlng) => {
                        return L.marker(latlng);
                    }
                });

                // Fit bounds to imported features
                const bounds = this.drawnItems.getBounds();
                if (bounds.isValid()) {
                    GeoflowMap.map.fitBounds(bounds, { padding: [50, 50] });
                } else {
                    GeoflowUtils.showToast('Impossible de zoomer sur les géométries', 'warning');
                }

                // Count features
                let featureCount = 0;
                if (reprojectedGeojson.type === 'FeatureCollection') {
                    featureCount = reprojectedGeojson.features.length;
                } else if (reprojectedGeojson.type === 'Feature') {
                    featureCount = 1;
                } else {
                    featureCount = 1;
                }

                GeoflowUtils.showToast(`${featureCount} géométrie(s) importée(s)`, 'success');

                // Update legend after import
				if (typeof GeoflowLegend !== 'undefined') {
					GeoflowLegend.requestUpdate();
				}
            } catch (error) {
                console.error('Error importing GeoJSON:', error);
                GeoflowUtils.showToast('Erreur lors de l\'import du fichier', 'error');
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
            GeoflowUtils.showToast('Rien à exporter', 'warning');
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
        a.download = `geoflow_draw_${Date.now()}.geojson`;
        a.click();
        URL.revokeObjectURL(url);

        GeoflowUtils.showToast(`${layers.length} géométrie(s) exportée(s)`, 'success');
    },

    /**
     * Clear all drawn geometries
     */
    clearAll() {
        const layers = this.drawnItems.getLayers();
        
        if (layers.length === 0) {
            GeoflowUtils.showToast('Aucune géométrie à effacer', 'info');
            return;
        }
        
        if (confirm(`Effacer toutes les géométries (${layers.length}) ?`)) {
            this.drawnItems.clearLayers();
            GeoflowUtils.showToast('Géométries effacées', 'success');

            // Update legend
			if (typeof GeoflowLegend !== 'undefined') {
				GeoflowLegend.requestUpdate();
			}
        }
    }
};