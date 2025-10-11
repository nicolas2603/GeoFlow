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
    },

    /**
     * Get draw panel content HTML
     */
    getPanelContent() {
        return `
            <div class="tool-grid">
                <div class="tool-card" data-draw="marker">
                    <i class="bi bi-geo-alt"></i>
                    <div class="tool-card-label">Point</div>
                </div>
                <div class="tool-card" data-draw="polyline">
                    <i class="bi bi-bezier2"></i>
                    <div class="tool-card-label">Ligne</div>
                </div>
                <div class="tool-card" data-draw="polygon">
                    <i class="bi bi-pentagon"></i>
                    <div class="tool-card-label">Polygone</div>
                </div>
                <div class="tool-card" data-draw="rectangle">
                    <i class="bi bi-square"></i>
                    <div class="tool-card-label">Rectangle</div>
                </div>
                <div class="tool-card" data-draw="circle">
                    <i class="bi bi-circle"></i>
                    <div class="tool-card-label">Cercle</div>
                </div>
                <div class="tool-card" data-draw="delete">
                    <i class="bi bi-trash"></i>
                    <div class="tool-card-label">Supprimer</div>
                </div>
            </div>

            <div style="display: flex; gap: 6px; margin-top: 12px;">
                <button class="btn btn-sm btn-primary flex-fill" id="export-geojson" style="font-size: 0.8rem; padding: 6px 10px;">
                    <i class="bi bi-download"></i> Exporter
                </button>
                <button class="btn btn-sm btn-outline-danger flex-fill" id="clear-all" style="font-size: 0.8rem; padding: 6px 10px;">
                    <i class="bi bi-x-circle"></i> Effacer
                </button>
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
                if (type === 'delete') {
                    new L.EditToolbar.Delete(GeoFlowMap.map, { 
                        featureGroup: this.drawnItems 
                    }).enable();
                } else {
                    const drawType = type.charAt(0).toUpperCase() + type.slice(1);
                    new L.Draw[drawType](GeoFlowMap.map, this.drawControl.options.draw[type]).enable();
                }
            });
        });

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