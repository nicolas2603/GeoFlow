/**
 * Geoflow Export Module
 * Handles map export to image (PNG/JPG)
 */

const GeoflowExport = {
    /**
     * Get export panel content HTML
     */
    getPanelContent() {
        return `
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Format d'image
                </label>
                <select id="export-format" class="form-select form-select-sm">
                    <option value="png">PNG (haute qualité)</option>
                    <option value="jpeg">JPEG (fichier plus léger)</option>
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Qualité
                </label>
                <select id="export-quality" class="form-select form-select-sm">
                    <option value="1">Basse (rapide)</option>
                    <option value="2" selected>Moyenne (recommandé)</option>
                    <option value="3">Haute (lent)</option>
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="export-legend">
                    <label class="form-check-label" for="export-legend">
                        Inclure la légende
                    </label>
                </div>
                <div class="form-check" style="margin-top: 8px;">
                    <input class="form-check-input" type="checkbox" id="export-scale-bar">
                    <label class="form-check-label" for="export-scale-bar">
                        Inclure l'échelle graphique
                    </label>
                </div>
                <div class="form-check" style="margin-top: 8px;">
                    <input class="form-check-input" type="checkbox" id="export-north-arrow">
                    <label class="form-check-label" for="export-north-arrow">
                        Inclure la flèche Nord
                    </label>
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Nom du fichier
                </label>
                <input type="text" id="export-filename" class="form-control form-control-sm" 
                       placeholder="carte_geoflow" value="carte_geoflow_${Date.now()}">
            </div>

            <button class="btn btn-sm btn-primary w-100" id="export-image">
                <i class="fa-solid fa-image"></i> Exporter l'image
            </button>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const exportBtn = document.getElementById('export-image');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportMapImage();
            });
        }
    },

    /**
     * Get export configuration
     */
    getConfig() {
        return {
            format: document.getElementById('export-format')?.value || 'png',
            quality: parseInt(document.getElementById('export-quality')?.value || '2'),
            legend: document.getElementById('export-legend')?.checked || false,
            scaleBar: document.getElementById('export-scale-bar')?.checked || false,
            northArrow: document.getElementById('export-north-arrow')?.checked || false,
            filename: document.getElementById('export-filename')?.value || 'carte_geoflow'
        };
    },

    /**
     * Export map as image
     */
    async exportMapImage() {
        const config = this.getConfig();
        
        GeoflowUtils.showLoadingOverlay('Génération de l\'image en cours...');

        try {
            // Déterminer l'échelle selon la qualité
            const scaleMap = { 1: 1, 2: 2, 3: 3 };
            const scale = scaleMap[config.quality];
            const qualityValue = config.format === 'jpeg' ? 0.92 : 1.0;

            // Masquer les éléments UI temporairement
            const elementsToHide = [
                '.toolbar',
                '.search-bar',
                '.panel',
                '.legend-widget',
                '.actions',
                '.basemap-gallery',
                '.toast-container',
                '.leaflet-control-container'
            ];
            
            const hiddenElements = [];
            elementsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el.style.display !== 'none') {
                        hiddenElements.push({ el, originalDisplay: el.style.display });
                        el.style.display = 'none';
                    }
                });
            });

            // Hide measure layers during capture
            let measureGroupHidden = false;
            if (typeof GeoflowMeasure !== 'undefined' && GeoflowMeasure.measureGroup) {
                if (GeoflowMap.map.hasLayer(GeoflowMeasure.measureGroup)) {
                    GeoflowMap.map.removeLayer(GeoflowMeasure.measureGroup);
                    measureGroupHidden = true;
                }
            }

            // Sauvegarder et neutraliser les transformations SVG
            const svgElements = document.querySelectorAll('.leaflet-overlay-pane svg, .leaflet-pane svg');
            const savedTransforms = [];
            
            svgElements.forEach(svg => {
                savedTransforms.push({
                    element: svg,
                    transform: svg.style.transform,
                    viewBox: svg.getAttribute('viewBox')
                });
                
                svg.style.transform = 'translate3d(0px, 0px, 0px)';
                
                const currentViewBox = svg.getAttribute('viewBox');
                if (currentViewBox) {
                    const values = currentViewBox.split(' ').map(Number);
                    svg.setAttribute('viewBox', `0 0 ${values[2]} ${values[3]}`);
                }
            });

            // Attendre le rendu
            await new Promise(resolve => setTimeout(resolve, 300));

            // Capturer la carte
            const mapContainer = document.getElementById('map');
            const canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: false,
                logging: false,
                scale: scale,
                backgroundColor: '#ffffff',
                foreignObjectRendering: false,
                imageTimeout: 0,
                removeContainer: false
            });

            // Restaurer les transformations SVG
            savedTransforms.forEach(({ element, transform, viewBox }) => {
                element.style.transform = transform;
                if (viewBox) {
                    element.setAttribute('viewBox', viewBox);
                }
            });

            // Restore measure layers
            if (measureGroupHidden && GeoflowMeasure.measureGroup) {
                GeoflowMap.map.addLayer(GeoflowMeasure.measureGroup);
            }

            // Restaurer les éléments UI
            hiddenElements.forEach(({ el, originalDisplay }) => {
                el.style.display = originalDisplay;
            });

            // Créer un canvas final avec les éléments optionnels
            const finalCanvas = await this.addExportElements(canvas, config);

            // Télécharger l'image
            const imageFormat = config.format === 'png' ? 'image/png' : 'image/jpeg';
            const dataUrl = finalCanvas.toDataURL(imageFormat, qualityValue);
            
            const link = document.createElement('a');
            link.download = `${config.filename}.${config.format}`;
            link.href = dataUrl;
            link.click();

            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast(`Image exportée : ${config.filename}.${config.format}`, 'success');

        } catch (error) {
            GeoflowUtils.hideLoadingOverlay();
            console.error('Export error:', error);
            GeoflowUtils.showToast('Erreur lors de l\'export : ' + error.message, 'error');
        }
    },

    /**
     * Add export elements (legend, scale bar, north arrow) to canvas
     * @param {HTMLCanvasElement} sourceCanvas - Source canvas from map capture
     * @param {Object} config - Export configuration
     * @returns {HTMLCanvasElement} Final canvas with elements
     */
    async addExportElements(sourceCanvas, config) {
        // Si aucun élément optionnel, retourner le canvas tel quel
        if (!config.legend && !config.scaleBar && !config.northArrow) {
            return sourceCanvas;
        }

        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');

        // Dimensions du canvas source
        const sourceWidth = sourceCanvas.width;
        const sourceHeight = sourceCanvas.height;

        // Calculer l'espace pour la légende
        let legendWidth = 0;
        if (config.legend && typeof GeoflowLegend !== 'undefined' && GeoflowLegend.hasContent()) {
            legendWidth = Math.min(250, sourceWidth * 0.25); // Max 25% de la largeur
        }

        // Canvas final : carte + légende
        finalCanvas.width = sourceWidth + legendWidth;
        finalCanvas.height = sourceHeight;

        // Fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Dessiner la carte
        ctx.drawImage(sourceCanvas, 0, 0);

        // Ajouter la flèche Nord
        if (config.northArrow) {
            this.drawNorthArrow(ctx, sourceWidth - 50, 30);
        }

        // Ajouter l'échelle graphique
        if (config.scaleBar) {
            this.drawScaleBar(ctx, 30, sourceHeight - 50);
        }

        // Ajouter la légende
        if (config.legend && legendWidth > 0) {
            await this.drawLegend(ctx, sourceWidth, 0, legendWidth, sourceHeight);
        }

        return finalCanvas;
    },

    /**
     * Draw north arrow on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawNorthArrow(ctx, x, y) {
        const size = 40;
        
        // Cercle blanc avec bordure bleue
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Flèche Nord
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑', x, y - 2);
        
        ctx.font = 'bold 10px Arial';
        ctx.fillText('N', x, y + 10);
    },

    /**
     * Draw scale bar on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawScaleBar(ctx, x, y) {
        const barWidth = 150;
        const barHeight = 8;
        
        // Fond blanc avec bordure
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(x - 10, y - 15, barWidth + 60, 35);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 10, y - 15, barWidth + 60, 35);

        // Barre d'échelle
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + barWidth, y);
        ctx.stroke();

        // Marques
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - barHeight / 2);
        ctx.lineTo(x, y + barHeight / 2);
        ctx.moveTo(x + barWidth, y - barHeight / 2);
        ctx.lineTo(x + barWidth, y + barHeight / 2);
        ctx.stroke();

        // Texte (estimation basée sur le zoom)
        const zoom = GeoflowMap.map.getZoom();
        let distance, unit;
        
        if (zoom >= 15) {
            distance = 100;
            unit = 'm';
        } else if (zoom >= 12) {
            distance = 500;
            unit = 'm';
        } else if (zoom >= 10) {
            distance = 1;
            unit = 'km';
        } else if (zoom >= 8) {
            distance = 5;
            unit = 'km';
        } else {
            distance = 10;
            unit = 'km';
        }

        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`0`, x - 5, y + 15);
        ctx.fillText(`${distance} ${unit}`, x + barWidth - 10, y + 15);
    },

    /**
     * Draw legend on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Legend width
     * @param {number} height - Legend height
     */
    async drawLegend(ctx, x, y, width, height) {
        // Fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, height);

        // Bordure
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Titre
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('LÉGENDE', x + 15, y + 15);

        // Contenu de la légende
        const legendSections = GeoflowLegend.getExportData();
        let currentY = y + 40;

        ctx.font = '11px Arial';
        ctx.textAlign = 'left';

        legendSections.forEach(section => {
            if (currentY > y + height - 30) return; // Éviter le débordement

            // Nom de la section
            ctx.fillStyle = '#374151';
            ctx.font = 'bold 11px Arial';
            ctx.fillText(section.title, x + 15, currentY);
            currentY += 18;

            // Items
            ctx.font = '10px Arial';
            section.items.forEach(item => {
                if (currentY > y + height - 20) return;

                // Symbole
                ctx.fillStyle = item.color;
                if (item.symbol === 'point') {
                    ctx.beginPath();
                    ctx.arc(x + 20, currentY + 5, 5, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.symbol === 'line') {
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = item.color;
                    ctx.beginPath();
                    ctx.moveTo(x + 15, currentY + 5);
                    ctx.lineTo(x + 30, currentY + 5);
                    ctx.stroke();
                } else { // polygon
                    ctx.fillRect(x + 15, currentY, 15, 10);
                }

                // Label
                ctx.fillStyle = '#6b7280';
                const labelText = item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label;
                ctx.fillText(labelText, x + 35, currentY + 5);
                currentY += 16;
            });

            currentY += 8; // Espacement entre sections
        });
    }
};