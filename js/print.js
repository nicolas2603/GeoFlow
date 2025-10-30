/**
 * Geoflow Print Module
 * Solution d'impression et d'aperçu
 * Version 2.0 - Utilise le module légende centralisé
 */

const GeoflowPrint = {
    printFormats: {
        'a4-portrait': { width: 210, height: 297, label: 'A4 Portrait' },
        'a4-landscape': { width: 297, height: 210, label: 'A4 Paysage' },
        'a3-portrait': { width: 297, height: 420, label: 'A3 Portrait' },
        'a3-landscape': { width: 420, height: 297, label: 'A3 Paysage' }
    },

    currentFormat: 'a4-landscape',
    previewMapImage: null,

    getPanelContent() {
        return `
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Format
                </label>
                <select id="print-format" class="form-select form-select-sm">
                    ${Object.entries(this.printFormats).map(([key, format]) => `
                        <option value="${key}" ${key === this.currentFormat ? 'selected' : ''}>${format.label}</option>
                    `).join('')}
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Échelle
                </label>
                <select id="print-scale" class="form-select form-select-sm">
                    <option value="free">Emprise actuelle (libre)</option>
                    <option value="5000">1:5 000</option>
                    <option value="10000">1:10 000</option>
                    <option value="25000">1:25 000</option>
                    <option value="50000">1:50 000</option>
                    <option value="100000">1:100 000</option>
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Titre
                </label>
                <input type="text" id="print-title" class="form-control form-control-sm" placeholder="Titre de la carte" value="Ma carte Geoflow">
            </div>

            <div style="margin-bottom: 14px;">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="print-legend">
                    <label class="form-check-label" for="print-legend">
                        Inclure la légende
                    </label>
                </div>
                <div class="form-check" style="margin-top: 8px;">
                    <input class="form-check-input" type="checkbox" id="print-scale-bar">
                    <label class="form-check-label" for="print-scale-bar">
                        Inclure l'échelle graphique
                    </label>
                </div>
                <div class="form-check" style="margin-top: 8px;">
                    <input class="form-check-input" type="checkbox" id="print-north-arrow">
                    <label class="form-check-label" for="print-north-arrow">
                        Inclure la flèche Nord
                    </label>
                </div>
            </div>

            <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm btn-primary flex-fill" id="print-preview">
                    <i class="fa-solid fa-eye"></i> Aperçu
                </button>
                <button class="btn btn-sm btn-success flex-fill" id="print-generate">
                    <i class="fa-solid fa-file-pdf"></i> Générer PDF
                </button>
            </div>
        `;
    },

    attachListeners() {
        const previewBtn = document.getElementById('print-preview');
        const generateBtn = document.getElementById('print-generate');

        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.showPreview();
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generatePDF();
            });
        }
    },

    /**
     * Applique temporairement l'échelle demandée (sans modifier la carte visible)
     * Retourne le zoom original pour restauration
     */
    applyTemporaryScale(scaleValue) {
        const originalZoom = GeoflowMap.map.getZoom();
        
        if (scaleValue === 'free') {
            return originalZoom; // Garder l'emprise actuelle
        }
        
        const scale = parseInt(scaleValue);
        
        // Calculer le zoom correspondant à l'échelle
        // Formule : zoom ≈ log2(156543.04 / scale * cos(lat))
        const center = GeoflowMap.map.getCenter();
        const lat = center.lat * Math.PI / 180;
        const metersPerPixel = scale / 96 * 0.0254; // 96 DPI standard
        const zoom = Math.log2(156543.04 * Math.cos(lat) / metersPerPixel);
        
        const targetZoom = Math.round(zoom);
        GeoflowMap.map.setZoom(targetZoom);
        
        return originalZoom;
    },

    /**
     * Capture la carte avec html2canvas de manière optimisée
     * SANS déformation - respect du ratio original
     */
    async captureMap(options = {}) {
        const defaultOptions = {
            scale: 1,
            quality: 0.8,
            format: 'jpeg'
        };
        
        const opts = { ...defaultOptions, ...options };
                
        // Masquer temporairement les éléments UI
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

        // Sauvegarder et neutraliser les transformations SVG de Leaflet
        const svgElements = document.querySelectorAll('.leaflet-overlay-pane svg, .leaflet-pane svg');
        const savedTransforms = [];
        
        svgElements.forEach(svg => {
            savedTransforms.push({
                element: svg,
                transform: svg.style.transform,
                viewBox: svg.getAttribute('viewBox')
            });
            
            // Neutraliser la transformation
            svg.style.transform = 'translate3d(0px, 0px, 0px)';
            
            // Ajuster le viewBox pour compenser
            const currentViewBox = svg.getAttribute('viewBox');
            if (currentViewBox) {
                const values = currentViewBox.split(' ').map(Number);
                svg.setAttribute('viewBox', `0 0 ${values[2]} ${values[3]}`);
            }
        });

        try {
            // Attendre que les modifications soient appliquées + que les tuiles se chargent
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const mapContainer = document.getElementById('map');
            
            const canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: false,
                logging: false,
                scale: opts.scale,
                backgroundColor: '#ffffff',
                foreignObjectRendering: false,
                imageTimeout: 0,
                removeContainer: false
            });
            
            // Restaurer toutes les transformations SVG
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
            
            // Convertir en data URL
            const imageFormat = opts.format === 'png' ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(imageFormat, opts.quality);
            
            return { canvas, dataUrl };
            
        } catch (error) {
            // Restaurer tout en cas d'erreur
            savedTransforms.forEach(({ element, transform, viewBox }) => {
                element.style.transform = transform;
                if (viewBox) {
                    element.setAttribute('viewBox', viewBox);
                }
            });

            // Restore measure layers on error
            if (measureGroupHidden && GeoflowMeasure.measureGroup) {
                GeoflowMap.map.addLayer(GeoflowMeasure.measureGroup);
            }

            hiddenElements.forEach(({ el, originalDisplay }) => {
                el.style.display = originalDisplay;
            });
            throw error;
        }
    },

    /**
     * Generate legend HTML from centralized legend module
     * @param {Object} config - Print configuration
     * @returns {string} HTML string for legend
     */
    generateLegendHTML(config) {
        if (!config.legend || typeof GeoflowLegend === 'undefined') {
            return '';
        }

        const legendSections = GeoflowLegend.getExportData();
        
        if (legendSections.length === 0) {
            return '';
        }

        let html = '';
        
        legendSections.forEach(section => {
            html += `<div style="margin-bottom:10px;">`;
            html += `<div style="font-weight:600;font-size:0.8rem;margin-bottom:4px;color:#374151;">${section.title}</div>`;
            section.items.forEach(item => {
                html += `
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                        <div style="width:14px;height:14px;background:${item.color};border-radius:2px;flex-shrink:0;"></div>
                        <span style="font-size:0.7rem;">${item.label}</span>
                    </div>
                `;
            });
            html += `</div>`;
        });

        return html;
    },

    async showPreview() {
        const config = this.getConfig();
        
        // Show loading with custom message
        GeoflowUtils.showLoadingOverlay('Génération de l\'aperçu...');
        
        try {
            // Appliquer temporairement l'échelle
            const originalZoom = this.applyTemporaryScale(config.scale);
            
            // Attendre que le zoom soit appliqué et que les tuiles se chargent
            await new Promise(resolve => setTimeout(resolve, 500));
        
            // Calculer le ratio cible exactement comme pour le PDF
            const format = this.printFormats[config.format];
            const width = format.width;
            const height = format.height;
            const marginX = 10;
            const marginY = 10;
            const footerHeight = 12;
            const headerHeight = 18;
            
            const availableWidth = width - (marginX * 2);
            const availableHeight = height - marginY - headerHeight - marginY - footerHeight;
            
            // Check if legend has content using centralized module
            const hasLegend = config.legend && 
                              typeof GeoflowLegend !== 'undefined' && 
                              GeoflowLegend.hasContent();
            
            let mapWidth;
            if (hasLegend) {
                const legendWidth = 50;
                mapWidth = availableWidth - legendWidth - 3;
            } else {
                mapWidth = availableWidth;
            }
            
            const targetAspect = mapWidth / availableHeight;

            // REDIMENSIONNER temporairement la div map pour l'aperçu
            const mapContainer = document.getElementById('map');
            const originalWidth = mapContainer.offsetWidth;
            const originalHeight = mapContainer.offsetHeight;
            
            let newWidth, newHeight;
            if (originalHeight * targetAspect <= originalWidth) {
                newHeight = originalHeight;
                newWidth = Math.round(newHeight * targetAspect);
            } else {
                newWidth = originalWidth;
                newHeight = Math.round(newWidth / targetAspect);
            }
                       
            mapContainer.style.width = newWidth + 'px';
            mapContainer.style.height = newHeight + 'px';
            GeoflowMap.map.invalidateSize();
            
            await new Promise(resolve => setTimeout(resolve, 300));

            // Capture rapide pour l'aperçu avec le bon ratio
            const { dataUrl } = await this.captureMap({
                scale: 0.5,
                quality: 0.7,
                format: 'jpeg'
            });
            
            // RESTAURER la taille ET le zoom originaux immédiatement
            mapContainer.style.width = originalWidth + 'px';
            mapContainer.style.height = originalHeight + 'px';
            GeoflowMap.map.setZoom(originalZoom);
            GeoflowMap.map.invalidateSize();
                        
            this.previewMapImage = dataUrl;
            
            GeoflowUtils.hideLoadingOverlay();
            
            // Build legend HTML from centralized module
            const legendHTML = this.generateLegendHTML(config);
            
            const logoPath = GeoflowConfig.theme.logo || 'assets/logo.png';
            const logoHTML = (logoPath.endsWith('.png') || logoPath.endsWith('.jpg')) 
                ? `<img src="${logoPath}" style="height:40px;width:auto;object-fit:contain;" onerror="this.style.display='none'">`
                : '<div style="color:#6b7280;font-size:0.8rem;">Logo</div>';
            
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
            
            modal.innerHTML = `
                <div style="background:white;border-radius:12px;width:90vw;max-width:1000px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                    <div style="padding:16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                        <h5 style="margin:0;font-size:1rem;color:#111827;">
                            <i class="fa-solid fa-eye"></i> Aperçu - ${config.title}
                        </h5>
                        <button id="close-preview" style="border:none;background:#f3f4f6;width:32px;height:32px;border-radius:6px;cursor:pointer;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="flex:1;overflow:auto;padding:20px;background:#f3f4f6;">
                        <div style="background:white;margin:0 auto;padding:15px;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:900px;">
                            <!-- HEADER -->
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:8px;border:1px solid #000;">
                                <div style="font-size:1.1rem;font-weight:bold;color:#1f2937;">${config.title}</div>
                                ${logoHTML}
                            </div>
                            
                            <!-- BODY: Map + Legend -->
                            <div style="display:flex;gap:3px;min-height:400px;">
                                <!-- Map with REAL capture - 100% fill -->
                                <div style="flex:1;border:1px solid #000;display:flex;align-items:center;justify-content:center;background:#f9fafb;position:relative;overflow:hidden;">
                                    <img src="${this.previewMapImage}" style="width:100%;height:100%;object-fit:fill;" alt="Carte">
                                    ${config.northArrow ? '<div style="position:absolute;top:8px;right:8px;width:35px;height:35px;background:white;border:2px solid #3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);"><i class="fa-solid fa-arrow-up" style="color:#3b82f6;font-size:1rem;"></i></div>' : ''}
                                    ${config.scaleBar ? `<div style="position:absolute;bottom:8px;left:8px;background:white;padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:0.7rem;box-shadow:0 2px 4px rgba(0,0,0,0.1);">${this.getScaleBarText(config.scale)}</div>` : ''}
                                </div>
                                
                                <!-- Legend -->
                                ${config.legend && legendHTML ? `
                                    <div style="width:180px;flex-shrink:0;padding:10px;background:#f9fafb;border:1px solid #000;overflow-y:auto;">
                                        <div style="font-weight:700;font-size:0.85rem;color:#1f2937;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">LÉGENDE</div>
                                        ${legendHTML}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <!-- FOOTER -->
                            <div style="margin-top:3px;padding:8px;border:1px solid #000;font-size:0.7rem;color:#000;display:flex;justify-content:space-between;">
                                <div><strong>Geoflow</strong> © ${new Date().toLocaleDateString('fr-FR')}</div>
                                <div>Format: ${this.printFormats[config.format].label}</div>
                            </div>
                        </div>
                    </div>
                    <div style="padding:16px;border-top:1px solid #e5e7eb;display:flex;gap:10px;justify-content:flex-end;flex-shrink:0;">
                        <button id="cancel-preview" class="btn btn-sm btn-secondary">Fermer</button>
                        <button id="confirm-pdf" class="btn btn-sm btn-success"><i class="fa-solid fa-file-pdf"></i> Générer PDF</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);

            const close = () => {
                modal.remove();
            };

            modal.querySelector('#close-preview').onclick = close;
            modal.querySelector('#cancel-preview').onclick = close;
            modal.onclick = (e) => { if(e.target === modal) close(); };
            modal.querySelector('#confirm-pdf').onclick = () => {
                close();
                this.generatePDF();
            };
                        
        } catch (error) {
            GeoflowUtils.hideLoadingOverlay();
            console.error('=== PREVIEW ERROR ===', error);
            GeoflowUtils.showToast('Erreur lors de la capture: ' + error.message, 'error');
        }
    },

    async generatePDF() {       
        // Check libraries
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas non chargé ! Vérifiez index.html');
            console.error('html2canvas is undefined');
            return;
        }
        
        if (typeof window.jspdf === 'undefined') {
            alert('jsPDF non chargé ! Vérifiez index.html');
            console.error('jsPDF is undefined');
            return;
        }

        GeoflowUtils.showLoadingOverlay('Impression de la carte...');

        try {
            const config = this.getConfig();
            
            // Appliquer temporairement l'échelle
            const originalZoom = this.applyTemporaryScale(config.scale);
            
            // Attendre que le zoom soit appliqué et que les tuiles se chargent
            await new Promise(resolve => setTimeout(resolve, 500));

            // Calculer les dimensions de l'espace carte dans le PDF
            const format = this.printFormats[config.format];
            const width = format.width;
            const height = format.height;
            const marginX = 10;
            const marginY = 10;
            const footerHeight = 12;
            const headerHeight = 18;
            
            const availableWidth = width - (marginX * 2);
            const availableHeight = height - marginY - headerHeight - marginY - footerHeight;
            
            // Check if legend has content using centralized module
            const hasLegend = config.legend && 
                              typeof GeoflowLegend !== 'undefined' && 
                              GeoflowLegend.hasContent();
            
            let mapWidth, legendWidth;
            if (hasLegend) {
                legendWidth = 50;
                mapWidth = availableWidth - legendWidth - 3;
            } else {
                mapWidth = availableWidth;
                legendWidth = 0;
            }
            
            // Ratio cible de l'espace carte dans le PDF
            const targetAspect = mapWidth / availableHeight;

            // REDIMENSIONNER temporairement la div map pour correspondre au ratio PDF
            const mapContainer = document.getElementById('map');
            const originalWidth = mapContainer.offsetWidth;
            const originalHeight = mapContainer.offsetHeight;
                        
            // Calculer les nouvelles dimensions pour avoir le ratio exact
            let newWidth, newHeight;
            if (originalHeight * targetAspect <= originalWidth) {
                newHeight = originalHeight;
                newWidth = Math.round(newHeight * targetAspect);
            } else {
                newWidth = originalWidth;
                newHeight = Math.round(newWidth / targetAspect);
            }
                        
            // Appliquer le redimensionnement temporaire
            mapContainer.style.width = newWidth + 'px';
            mapContainer.style.height = newHeight + 'px';
            GeoflowMap.map.invalidateSize();
            
            // Attendre que Leaflet ait fini de redessiner
            await new Promise(resolve => setTimeout(resolve, 500));

            // Maintenant capturer avec le bon ratio
            const { canvas } = await this.captureMap({
                scale: 2,
                quality: 0.95,
                format: 'png'
            });
                        
            // RESTAURER la taille ET le zoom originaux immédiatement
            mapContainer.style.width = originalWidth + 'px';
            mapContainer.style.height = originalHeight + 'px';
            GeoflowMap.map.setZoom(originalZoom);
            GeoflowMap.map.invalidateSize();
            
            // Create PDF
            const { jsPDF } = window.jspdf;
            const orientation = width > height ? 'landscape' : 'portrait';
            
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: [width, height],
                compress: true
            });

            let currentY = marginY;

            // === HEADER: Title + Logo ===
            const logoPath = GeoflowConfig.theme.logo || 'assets/logo.svg';
            
            // Bordure du header
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.rect(marginX, marginY, availableWidth, 15);
            
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            pdf.text(config.title, marginX + 3, currentY + 8);
            
            // Try to add logo if PNG/JPG
            if (logoPath.endsWith('.png') || logoPath.endsWith('.jpg')) {
                try {
                    const logoImg = await this.loadImage(logoPath);
                    const logoHeight = 10;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    pdf.addImage(logoImg.src, 'PNG', width - marginX - logoWidth - 3, currentY + 2.5, logoWidth, logoHeight);
                } catch (e) {
                    console.warn('Could not load logo:', e);
                }
            }
            
            currentY += 15;
            currentY += 3;

            // === BODY: Map + Legend ===
            const legendX = marginX + mapWidth + 3;

            // Bordure de la carte
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.rect(marginX, currentY, mapWidth, availableHeight);

            // Add map image - MAINTENANT LE CANVAS A EXACTEMENT LE BON RATIO
            const imgData = canvas.toDataURL('image/png', 0.95);
            
            // Remplir 100% de l'espace disponible
            pdf.addImage(imgData, 'PNG', marginX, currentY, mapWidth, availableHeight);

            // Add north arrow if enabled
            if (config.northArrow) {
                const arrowSize = 8;
                const arrowX = marginX + mapWidth - arrowSize - 3;
                const arrowY = currentY + 3;
                
                pdf.setDrawColor(59, 130, 246);
                pdf.setFillColor(255, 255, 255);
                pdf.setLineWidth(0.5);
                pdf.circle(arrowX + arrowSize/2, arrowY + arrowSize/2, arrowSize/2, 'FD');
                
                pdf.setTextColor(59, 130, 246);
                pdf.setFontSize(10);
                pdf.text('↑', arrowX + arrowSize/2 - 1, arrowY + arrowSize/2 + 2);
                pdf.setFontSize(6);
                pdf.text('N', arrowX + arrowSize/2 + 1.5, arrowY + arrowSize/2 + 2);
                pdf.setTextColor(0, 0, 0);
            }

            // Add scale bar if enabled
            if (config.scaleBar) {
                const scaleBarWidth = 25;
                const scaleY = currentY + availableHeight - 5;
                const scaleX = marginX + 3;
                
                pdf.setDrawColor(0, 0, 0);
                pdf.setFillColor(255, 255, 255);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(scaleX - 2, scaleY - 4, scaleBarWidth + 10, 6, 1, 1, 'FD');
                
                pdf.setLineWidth(0.5);
                pdf.line(scaleX, scaleY, scaleX + scaleBarWidth, scaleY);
                pdf.line(scaleX, scaleY - 1.5, scaleX, scaleY + 1.5);
                pdf.line(scaleX + scaleBarWidth, scaleY - 1.5, scaleX + scaleBarWidth, scaleY + 1.5);
                
                pdf.setFontSize(7);
                pdf.text(this.getScaleBarText(config.scale), scaleX + scaleBarWidth + 2, scaleY + 1);
            }

            // Add legend if enabled and has content
            if (hasLegend) {                
                // Bordure de la légende
                pdf.setDrawColor(0, 0, 0);
                pdf.setLineWidth(0.5);
                pdf.rect(legendX, currentY, legendWidth, availableHeight);
                
                let legendY = currentY + 5;
                
                pdf.setFontSize(9);
                pdf.setFont(undefined, 'bold');
                pdf.text('LÉGENDE', legendX + 3, legendY);
                legendY += 6;
                
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(7);
                
                // Get legend data from centralized module
                const legendSections = GeoflowLegend.getExportData();
                let itemsAdded = 0;
                
                legendSections.forEach(section => {
                    if (legendY > currentY + availableHeight - 10) return;
                    
                    // Section name
                    pdf.setFont(undefined, 'bold');
                    const truncatedName = section.title.length > 20 ? section.title.substring(0, 18) + '...' : section.title;
                    pdf.text(truncatedName, legendX + 3, legendY);
                    legendY += 4;
                    pdf.setFont(undefined, 'normal');

                    // Legend items
                    section.items.forEach(item => {
                        if (legendY > currentY + availableHeight - 8) return;
                        
                        const rgb = this.hexToRgb(item.color);
                        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                        pdf.rect(legendX + 3, legendY - 2.5, 3, 3, 'F');
                        
                        const labelText = item.label.length > 18 ? item.label.substring(0, 16) + '...' : item.label;
                        pdf.text(labelText, legendX + 7.5, legendY);
                        legendY += 4;
                        itemsAdded++;
                    });

                    legendY += 2;
                });
            }

            // === FOOTER ===
            pdf.setFontSize(7);
            pdf.setTextColor(107, 114, 128);
            const footerY = height - marginY - 8;
            
            // Bordure du footer
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.rect(marginX, footerY - 1, availableWidth, 8);
            
            const date = new Date().toLocaleDateString('fr-FR');
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text('Geoflow', marginX + 3, footerY + 4);
            pdf.setFont(undefined, 'normal');
            pdf.text(`© ${date}`, marginX + 20, footerY + 4);
            pdf.text(`Format: ${this.printFormats[config.format].label}`, width - marginX - 35, footerY + 4);
            
            // Save PDF
            const filename = `geoflow_${config.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            pdf.save(filename);

            GeoflowUtils.hideLoadingOverlay();
            GeoflowUtils.showToast('PDF généré avec succès !', 'success');

        } catch (error) {
            GeoflowUtils.hideLoadingOverlay();
            console.error('=== PDF GENERATION ERROR ===', error);
            alert('Erreur: ' + error.message);
            GeoflowUtils.showToast('Erreur: ' + error.message, 'error');
        }
    },

    /**
     * Convert hex color to RGB object
     * @param {string} hex - Hex color code
     * @returns {Object} RGB object with r, g, b properties
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    /**
     * Load image and return Promise
     * @param {string} src - Image source URL
     * @returns {Promise} Promise that resolves with loaded image
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    /**
     * Get print configuration from form inputs
     * @returns {Object} Configuration object
     */
    getConfig() {
        return {
            format: document.getElementById('print-format')?.value || 'a4-landscape',
            scale: document.getElementById('print-scale')?.value || 'free',
            title: document.getElementById('print-title')?.value || 'Carte Geoflow',
            legend: document.getElementById('print-legend')?.checked || false,
            scaleBar: document.getElementById('print-scale-bar')?.checked || false,
            northArrow: document.getElementById('print-north-arrow')?.checked || false
        };
    },

    /**
     * Calcule le texte de l'échelle graphique en fonction de l'échelle choisie
     * @param {string} scaleValue - Scale value from config
     * @returns {string} Formatted scale bar text
     */
    getScaleBarText(scaleValue) {
        if (scaleValue === 'free') {
            return '0____500m';
        }
        
        const scale = parseInt(scaleValue);
        
        // Longueur de la barre : ~25mm dans le PDF
        // À l'échelle 1:X, 25mm représente 25 * X millimètres dans la réalité
        const realDistanceMm = 25 * scale;
        const realDistanceM = realDistanceMm / 1000;
        
        // Arrondir à une valeur lisible
        let displayDistance;
        let unit;
        
        if (realDistanceM < 1000) {
            // Afficher en mètres
            if (realDistanceM < 10) {
                displayDistance = Math.round(realDistanceM);
            } else if (realDistanceM < 100) {
                displayDistance = Math.round(realDistanceM / 10) * 10;
            } else {
                displayDistance = Math.round(realDistanceM / 50) * 50;
            }
            unit = 'm';
        } else {
            // Afficher en kilomètres
            const distanceKm = realDistanceM / 1000;
            if (distanceKm < 10) {
                displayDistance = Math.round(distanceKm * 2) / 2; // arrondi à 0.5
            } else {
                displayDistance = Math.round(distanceKm);
            }
            unit = 'km';
        }
        
        return `0____${displayDistance}${unit}`;
    }
};