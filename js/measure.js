/**
 * GeoFlow Measure Module
 * Handles distance and area measurements
 */

const GeoFlowMeasure = {
    measureLayer: null,

    /**
     * Get measure panel content HTML
     */
    getPanelContent() {
        return `
            <div class="tool-grid" style="grid-template-columns: repeat(2, 1fr);">
                <div class="tool-card" data-measure="distance">
                    <i class="bi bi-rulers"></i>
                    <div class="tool-card-label">Distance</div>
                </div>
                <div class="tool-card" data-measure="area">
                    <i class="bi bi-bounding-box"></i>
                    <div class="tool-card-label">Surface</div>
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
                this.startMeasure(type);
            });
        });
    },

    /**
     * Start measurement tool
     * @param {string} type - 'distance' or 'area'
     */
    startMeasure(type) {
        // Remove previous measurement
        if (this.measureLayer) {
            GeoFlowMap.map.removeLayer(this.measureLayer);
        }

        const options = { 
            shapeOptions: { 
                color: '#ef4444', 
                weight: 3, 
                fillOpacity: 0.2 
            } 
        };
        
        if (type === 'distance') {
            new L.Draw.Polyline(GeoFlowMap.map, options).enable();
        } else {
            new L.Draw.Polygon(GeoFlowMap.map, options).enable();
        }

        // Listen for measurement completion
        GeoFlowMap.map.once(L.Draw.Event.CREATED, (e) => {
            this.measureLayer = e.layer;
            GeoFlowMap.map.addLayer(this.measureLayer);

            const resultDiv = document.getElementById('measure-result');
            const valueDiv = document.getElementById('measure-value');
            resultDiv.style.display = 'block';

            if (type === 'distance') {
                const length = GeoFlowUtils.calculateLength(this.measureLayer.getLatLngs());
                valueDiv.textContent = GeoFlowUtils.formatDistance(length);
            } else {
                const area = L.GeometryUtil.geodesicArea(this.measureLayer.getLatLngs()[0]);
                valueDiv.textContent = GeoFlowUtils.formatArea(area);
            }
        });
    }
};