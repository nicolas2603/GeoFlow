/**
 * GeoFlow Print Module - Version simplifiée fonctionnelle
 */

const GeoFlowPrint = {
    printFormats: {
        'a4-portrait': { width: 210, height: 297, label: 'A4 Portrait' },
        'a4-landscape': { width: 297, height: 210, label: 'A4 Paysage' },
        'a3-portrait': { width: 297, height: 420, label: 'A3 Portrait' },
        'a3-landscape': { width: 420, height: 297, label: 'A3 Paysage' }
    },

    currentFormat: 'a4-landscape',

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
                    Titre
                </label>
                <input type="text" id="print-title" class="form-control form-control-sm" placeholder="Titre de la carte" value="Ma carte GeoFlow">
            </div>

            <div style="margin-bottom: 14px;">
                <div class="form-check" style="padding-left: 1.5rem;">
                    <input class="form-check-input" type="checkbox" id="print-legend" checked>
                    <label class="form-check-label" for="print-legend" style="font-size: 0.85rem;">
                        Inclure la légende
                    </label>
                </div>
                <div class="form-check" style="padding-left: 1.5rem; margin-top: 6px;">
                    <input class="form-check-input" type="checkbox" id="print-scale-bar" checked>
                    <label class="form-check-label" for="print-scale-bar" style="font-size: 0.85rem;">
                        Inclure l'échelle graphique
                    </label>
                </div>
                <div class="form-check" style="padding-left: 1.5rem; margin-top: 6px;">
                    <input class="form-check-input" type="checkbox" id="print-north-arrow" checked>
                    <label class="form-check-label" for="print-north-arrow" style="font-size: 0.85rem;">
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

            <div style="margin-top: 12px; padding: 8px 10px; background: var(--hover-bg); border-radius: 6px; font-size: 0.72rem; color: var(--text-secondary);">
                <i class="fa-solid fa-circle-info"></i> Nécessite html2canvas et jsPDF
            </div>
        `;
    },

    attachListeners() {
        const previewBtn = document.getElementById('print-preview');
        const generateBtn = document.getElementById('print-generate');

        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                console.log('Preview clicked');
                this.showPreview();
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                console.log('Generate clicked');
                this.generatePDF();
            });
        }
    },

    showPreview() {
        const config = this.getConfig();
        console.log('Showing preview with config:', config);
        
        // Get active layers from GeoFlowLayers state instead of DOM
        const activeLayerIds = Array.from(GeoFlowLayers.activeLayerIds);
        console.log('Active layer IDs from state:', activeLayerIds);
        
        let legendHTML = '';
        
        if (config.legend && activeLayerIds.length > 0) {
            activeLayerIds.forEach(layerId => {
                const legendData = GeoFlowConfig.legends[layerId];
                
                // Get layer name from config
                let layerName = layerId;
                if (GeoFlowConfig.layersConfig && GeoFlowConfig.layersConfig.themes) {
                    GeoFlowConfig.layersConfig.themes.forEach(theme => {
                        const layer = theme.layers.find(l => l.id === layerId);
                        if (layer) layerName = layer.name;
                    });
                }
                
                console.log('Processing layer:', layerId, 'Name:', layerName, 'Has legend data:', !!legendData);
                
                if (legendData && legendData.items) {
                    console.log('Legend items:', legendData.items.length);
                    legendHTML += `<div style="margin-bottom:10px;">`;
                    legendHTML += `<div style="font-weight:600;font-size:0.8rem;margin-bottom:4px;color:#374151;">${layerName}</div>`;
                    legendData.items.forEach(legendItem => {
                        legendHTML += `
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                                <div style="width:14px;height:14px;background:${legendItem.color};border-radius:2px;flex-shrink:0;"></div>
                                <span style="font-size:0.7rem;">${legendItem.label}</span>
                            </div>
                        `;
                    });
                    legendHTML += `</div>`;
                }
            });
        }
        
        console.log('Legend HTML length:', legendHTML.length);
        
        const logoPath = GeoFlowConfig.theme.logo || 'assets/logo.svg';
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
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
                            <div style="font-size:1.1rem;font-weight:bold;color:#1f2937;">${config.title}</div>
                            ${logoHTML}
                        </div>
                        
                        <!-- BODY: Map + Legend -->
                        <div style="display:flex;gap:12px;min-height:400px;">
                            <!-- Map -->
                            <div style="flex:1;border:2px solid #e5e7eb;display:flex;align-items:center;justify-content:center;background:#f9fafb;position:relative;">
                                <div style="text-align:center;color:#9ca3af;">
                                    <i class="fa-solid fa-map" style="font-size:2.5rem;margin-bottom:8px;"></i>
                                    <div style="font-size:0.85rem;font-weight:600;">Carte capturée</div>
                                    <div style="font-size:0.7rem;margin-top:4px;">Toutes les couches visibles seront incluses</div>
                                </div>
                                ${config.northArrow ? '<div style="position:absolute;top:8px;right:8px;width:35px;height:35px;background:white;border:2px solid #3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);"><i class="fa-solid fa-arrow-up" style="color:#3b82f6;font-size:1rem;"></i></div>' : ''}
                                ${config.scaleBar ? '<div style="position:absolute;bottom:8px;left:8px;background:white;padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:0.7rem;box-shadow:0 2px 4px rgba(0,0,0,0.1);">0____500m</div>' : ''}
                            </div>
                            
                            <!-- Legend -->
                            ${config.legend ? `
                                <div style="width:180px;flex-shrink:0;padding:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;overflow-y:auto;">
                                    <div style="font-weight:700;font-size:0.85rem;color:#1f2937;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">LÉGENDE</div>
                                    ${legendHTML || '<div style="font-size:0.75rem;color:#9ca3af;">Aucune couche active</div>'}
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- FOOTER -->
                        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:0.7rem;color:#6b7280;display:flex;justify-content:space-between;">
                            <div><strong>GeoFlow</strong> © ${new Date().toLocaleDateString('fr-FR')}</div>
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
            console.log('Closing modal');
            modal.remove();
        };

        modal.querySelector('#close-preview').onclick = close;
        modal.querySelector('#cancel-preview').onclick = close;
        modal.onclick = (e) => { if(e.target === modal) close(); };
        modal.querySelector('#confirm-pdf').onclick = () => {
            close();
            this.generatePDF();
        };
    },

    async generatePDF() {
        console.log('=== START PDF GENERATION ===');
        
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

        console.log('Libraries OK');
        GeoFlowUtils.showLoading();

        try {
            const config = this.getConfig();
            console.log('Config:', config);

            const mapElement = document.getElementById('map');
            console.log('Map element:', mapElement);

            // Capture map
            console.log('Starting html2canvas...');
            const canvas = await html2canvas(mapElement, {
                useCORS: true,
                allowTaint: false,
                logging: false,
                scale: 2
            });
            
            console.log('Canvas created:', canvas.width, 'x', canvas.height);

            // Create PDF
            const { jsPDF } = window.jspdf;
            const format = this.printFormats[config.format];
            const width = format.width;
            const height = format.height;
            const orientation = width > height ? 'landscape' : 'portrait';
            
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: [width, height],
                compress: true
            });

            console.log('PDF created');

            const marginX = 10;
            const marginY = 10;
            let currentY = marginY;

            // === HEADER: Title + Logo ===
            const logoPath = GeoFlowConfig.theme.logo || 'assets/logo.svg';
            
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            pdf.text(config.title, marginX, currentY + 8);
            
            // Try to add logo if PNG/JPG
            if (logoPath.endsWith('.png') || logoPath.endsWith('.jpg')) {
                try {
                    const logoImg = await this.loadImage(logoPath);
                    const logoHeight = 12;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    pdf.addImage(logoImg.src, 'PNG', width - marginX - logoWidth, currentY, logoWidth, logoHeight);
                    console.log('Logo added');
                } catch (e) {
                    console.warn('Could not load logo:', e);
                }
            }
            
            currentY += 15;
            
            // Separator line
            pdf.setDrawColor(229, 231, 235);
            pdf.setLineWidth(0.5);
            pdf.line(marginX, currentY, width - marginX, currentY);
            currentY += 5;

            // === BODY: Map + Legend ===
            const footerHeight = 15;
            const availableHeight = height - currentY - marginY - footerHeight;
            const availableWidth = width - (marginX * 2);
            
            // Check for active layers - from GeoFlowLayers state
            const activeLayerIds = Array.from(GeoFlowLayers.activeLayerIds);
            console.log('Active layer IDs in PDF:', activeLayerIds);
            const hasLegend = config.legend && activeLayerIds.length > 0;
            
            let mapWidth, legendWidth, legendX;
            if (hasLegend) {
                legendWidth = 45;
                mapWidth = availableWidth - legendWidth - 5;
                legendX = marginX + mapWidth + 5;
            } else {
                mapWidth = availableWidth;
                legendWidth = 0;
            }

            // Add map image with proper scaling
            const imgData = canvas.toDataURL('image/png', 0.95);
            const canvasAspect = canvas.width / canvas.height;
            const mapAspect = mapWidth / availableHeight;
            
            let finalMapWidth, finalMapHeight;
            if (canvasAspect > mapAspect) {
                finalMapHeight = availableHeight;
                finalMapWidth = availableHeight * canvasAspect;
                if (finalMapWidth > mapWidth) {
                    finalMapWidth = mapWidth;
                    finalMapHeight = mapWidth / canvasAspect;
                }
            } else {
                finalMapWidth = mapWidth;
                finalMapHeight = mapWidth / canvasAspect;
                if (finalMapHeight > availableHeight) {
                    finalMapHeight = availableHeight;
                    finalMapWidth = availableHeight * canvasAspect;
                }
            }
            
            const mapX = marginX + (mapWidth - finalMapWidth) / 2;
            const mapY = currentY + (availableHeight - finalMapHeight) / 2;
            
            pdf.addImage(imgData, 'PNG', mapX, mapY, finalMapWidth, finalMapHeight);
            console.log('Map image added');

            // Add north arrow if enabled
            if (config.northArrow) {
                const arrowSize = 8;
                const arrowX = mapX + finalMapWidth - arrowSize - 3;
                const arrowY = mapY + 3;
                
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
                console.log('North arrow added');
            }

            // Add scale bar if enabled
            if (config.scaleBar) {
                const scaleBarWidth = 25;
                const scaleY = mapY + finalMapHeight - 5;
                const scaleX = mapX + 3;
                
                pdf.setDrawColor(0, 0, 0);
                pdf.setFillColor(255, 255, 255);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(scaleX - 2, scaleY - 4, scaleBarWidth + 10, 6, 1, 1, 'FD');
                
                pdf.setLineWidth(0.5);
                pdf.line(scaleX, scaleY, scaleX + scaleBarWidth, scaleY);
                pdf.line(scaleX, scaleY - 1.5, scaleX, scaleY + 1.5);
                pdf.line(scaleX + scaleBarWidth, scaleY - 1.5, scaleX + scaleBarWidth, scaleY + 1.5);
                
                pdf.setFontSize(7);
                pdf.text('500 m', scaleX + scaleBarWidth + 2, scaleY + 1);
                console.log('Scale bar added');
            }

            // Add legend if enabled and has active layers
            if (hasLegend) {
                console.log('Adding legend to PDF...');
                let legendY = currentY + 5;
                
                pdf.setFontSize(9);
                pdf.setFont(undefined, 'bold');
                pdf.text('LÉGENDE', legendX, legendY);
                legendY += 5;
                
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(7);
                
                let itemsAdded = 0;
                activeLayerIds.forEach(layerId => {
                    const legendData = GeoFlowConfig.legends[layerId];
                    
                    // Get layer name from config
                    let layerName = layerId;
                    if (GeoFlowConfig.layersConfig && GeoFlowConfig.layersConfig.themes) {
                        GeoFlowConfig.layersConfig.themes.forEach(theme => {
                            const layer = theme.layers.find(l => l.id === layerId);
                            if (layer) layerName = layer.name;
                        });
                    }
                    
                    console.log('PDF Legend - Layer:', layerId, 'Name:', layerName, 'Has data:', !!legendData);
                    
                    if (legendData && legendData.items && legendY < currentY + availableHeight - 10) {
                        // Layer name
                        pdf.setFont(undefined, 'bold');
                        const truncatedName = layerName.length > 18 ? layerName.substring(0, 16) + '...' : layerName;
                        pdf.text(truncatedName, legendX, legendY);
                        legendY += 4;
                        pdf.setFont(undefined, 'normal');
                        
                        // Legend items
                        legendData.items.forEach(legendItem => {
                            if (legendY > currentY + availableHeight - 10) return;
                            
                            const rgb = this.hexToRgb(legendItem.color);
                            pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                            pdf.rect(legendX, legendY - 2.5, 3, 3, 'F');
                            
                            const labelText = legendItem.label.length > 16 ? legendItem.label.substring(0, 14) + '...' : legendItem.label;
                            pdf.text(labelText, legendX + 4.5, legendY);
                            legendY += 4;
                            itemsAdded++;
                        });
                        
                        legendY += 2;
                    }
                });
                console.log('Legend items added:', itemsAdded);
            } else {
                console.log('No legend added - hasLegend:', hasLegend, 'config.legend:', config.legend, 'activeLayerIds:', activeLayerIds.length);
            }

            // === FOOTER ===
            pdf.setFontSize(7);
            pdf.setTextColor(107, 114, 128);
            const footerY = height - marginY - 5;
            
            // Line separator
            pdf.setDrawColor(229, 231, 235);
            pdf.setLineWidth(0.3);
            pdf.line(marginX, footerY - 3, width - marginX, footerY - 3);
            
            const date = new Date().toLocaleDateString('fr-FR');
            pdf.setFont(undefined, 'bold');
            pdf.text('GeoFlow', marginX, footerY);
            pdf.setFont(undefined, 'normal');
            pdf.text(`© ${date}`, marginX + 15, footerY);
            pdf.text(`Format: ${this.printFormats[config.format].label}`, width / 2 - 15, footerY);
            
            console.log('Footer added');

            // Save PDF
            const filename = `geoflow_${config.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            console.log('Saving as:', filename);
            pdf.save(filename);

            GeoFlowUtils.hideLoading();
            GeoFlowUtils.showToast('PDF généré avec succès !', 'success');
            console.log('=== PDF GENERATION SUCCESS ===');

        } catch (error) {
            GeoFlowUtils.hideLoading();
            console.error('=== PDF GENERATION ERROR ===', error);
            alert('Erreur: ' + error.message);
            GeoFlowUtils.showToast('Erreur: ' + error.message, 'error');
        }
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    getConfig() {
        return {
            format: document.getElementById('print-format')?.value || 'a4-landscape',
            title: document.getElementById('print-title')?.value || 'Carte GeoFlow',
            legend: document.getElementById('print-legend')?.checked || false,
            scaleBar: document.getElementById('print-scale-bar')?.checked || false,
            northArrow: document.getElementById('print-north-arrow')?.checked || false
        };
    }
};