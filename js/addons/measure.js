/**
 * Geoflow Measure Module
 * Handles distance and area measurements
 */

const GeoflowMeasure = {
    measureLayer: null,
    measureGroup: null, // Separate group for measure layers
    activeMeasureHandler: null, // Store active measure handler
    measureCompleteHandler: null, // Store the event handler reference

    /**
     * Initialize measure module
     */
    init() {
        // Create a separate feature group for measurements
        this.measureGroup = new L.FeatureGroup();
        GeoflowMap.map.addLayer(this.measureGroup);
    },

    /**
     * Get measure panel content HTML
     */
    getPanelContent() {
        return `
            <div class="tool-grid">
                <div class="tool-card" data-measure="distance">
                    <i class="fa-solid fa-ruler"></i>
                    <div class="tool-card-label">Distance</div>
                </div>
                <div class="tool-card" data-measure="area">
                    <i class="fa-solid fa-vector-square"></i>
                    <div class="tool-card-label">Surface</div>
                </div>
                <div class="tool-card" data-measure="clear" style="border-color: #ef4444;">
                    <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                    <div class="tool-card-label" style="color: #ef4444;">Effacer</div>
                </div>
            </div>

            <div id="measure-result" style="display: none; margin-top: 14px;">
                <div class="stat-card">
                    <div class="stat-label">Résultat</div>
                    <div class="stat-value" id="measure-value" style="font-size: 1.1rem;">-</div>
                </div>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        document.querySelectorAll('[data-measure]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.measure;
                
                if (type === 'clear') {
                    this.clearMeasure();
                } else {
                    this.startMeasure(type);
                }
            });
        });
    },

    /**
     * Start measurement tool
     * @param {string} type - 'distance' or 'area'
     */
    startMeasure(type) {
        // Disable any active measurement first
        this.disableActiveMeasure();

        // Remove previous measurement layer
        if (this.measureLayer) {
            GeoflowMap.map.removeLayer(this.measureLayer);
            this.measureLayer = null;
        }

        // Hide previous result
        const resultDiv = document.getElementById('measure-result');
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }

        const options = { 
            shapeOptions: { 
                color: '#ef4444', 
                weight: 3, 
                fillOpacity: 0.2 
            } 
        };
        
        if (type === 'distance') {
            this.activeMeasureHandler = new L.Draw.Polyline(GeoflowMap.map, options);
            this.activeMeasureHandler.enable();
        } else {
            this.activeMeasureHandler = new L.Draw.Polygon(GeoflowMap.map, options);
            this.activeMeasureHandler.enable();
        }

        // Create a named handler function so we can remove it specifically
        const measureCompleteHandler = (e) => {
            this.measureLayer = e.layer;
            
            // Add to measureGroup instead of map directly
            this.measureGroup.addLayer(this.measureLayer);

            const resultDiv = document.getElementById('measure-result');
            const valueDiv = document.getElementById('measure-value');
            
            if (resultDiv && valueDiv) {
                resultDiv.style.display = 'block';

                if (type === 'distance') {
                    const length = GeoflowUtils.calculateLength(this.measureLayer.getLatLngs());
                    valueDiv.textContent = GeoflowUtils.formatDistance(length);
                    GeoflowUtils.showToast(`Distance: ${GeoflowUtils.formatDistance(length)}`, 'success');
                } else {
                    const area = L.GeometryUtil.geodesicArea(this.measureLayer.getLatLngs()[0]);
                    valueDiv.textContent = GeoflowUtils.formatArea(area);
                    GeoflowUtils.showToast(`Surface: ${GeoflowUtils.formatArea(area)}`, 'success');
                }
            }

            // Clean up after measurement is complete
            this.disableActiveMeasure();
            
            // Remove THIS specific handler
            GeoflowMap.map.off(L.Draw.Event.CREATED, measureCompleteHandler);
        };

        // Store reference to the handler
        this.measureCompleteHandler = measureCompleteHandler;

        // Listen for measurement completion
        GeoflowMap.map.on(L.Draw.Event.CREATED, measureCompleteHandler);
    },

    /**
     * Clear current measurement
     */
    clearMeasure() {
        // Remove measurement layer
        if (this.measureLayer) {
            this.measureGroup.removeLayer(this.measureLayer);
            this.measureLayer = null;
        }

        // Disable any active measurement
        this.disableActiveMeasure();

        // Hide result
        const resultDiv = document.getElementById('measure-result');
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }

        GeoflowUtils.showToast('Mesure effacée', 'success');
    },

    /**
     * Disable any active measurement
     */
    disableActiveMeasure() {
        if (this.activeMeasureHandler) {
            try {
                if (typeof this.activeMeasureHandler.disable === 'function') {
                    this.activeMeasureHandler.disable();
                }
            } catch (e) {
                console.warn('Error disabling measure handler:', e);
            }
            this.activeMeasureHandler = null;
        }

        // Remove ONLY the measure-specific event listener
        if (this.measureCompleteHandler) {
            GeoflowMap.map.off(L.Draw.Event.CREATED, this.measureCompleteHandler);
            this.measureCompleteHandler = null;
        }

        // Reset cursor
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.style.cursor = '';
        }
    }
};