/**
 * Geoflow Share Module
 * Handles map context sharing via URL with QR code generation
 */

const GeoflowShare = {
    /**
     * Get share panel content HTML
     */
    getPanelContent() {
        const shareUrl = this.generateShareUrl();
        
        return `
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Lien de partage
                </label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="share-url" class="form-control form-control-sm" 
                           value="${shareUrl}" readonly style="flex: 1;">
                    <button class="btn btn-sm btn-primary" id="copy-share-url" style="white-space: nowrap;">
                        <i class="fa-solid fa-copy"></i> Copier
                    </button>
                </div>
            </div>

            <div style="margin-bottom: 14px; text-align: center;">
                <div style="background: white; padding: 15px; border-radius: 8px; display: inline-block; border: 1px solid var(--border-color);">
                    <canvas id="qrcode-canvas" style="max-width: 100px;"></canvas>
                </div>
                <div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-secondary);">
                    Scannez ce QR code pour accéder à la carte
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Contexte partagé
                </label>
                <div style="background: var(--hover-bg); padding: 10px; border-radius: 6px; font-size: 0.75rem; color: var(--text-secondary);">
                    ${this.getContextSummary()}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button class="btn btn-sm btn-success" id="download-qr" style="white-space: nowrap;">
                    <i class="fa-solid fa-share-nodes"></i> QR Code
                </button>
                <button class="btn btn-sm btn-secondary" id="refresh-share" style="white-space: nowrap;">
                    <i class="fa-solid fa-rotate"></i> Actualiser
                </button>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        // Copier l'URL
        const copyBtn = document.getElementById('copy-share-url');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const urlInput = document.getElementById('share-url');
                urlInput.select();
                navigator.clipboard.writeText(urlInput.value);
                GeoflowUtils.showToast('Lien copié dans le presse-papiers', 'success');
            });
        }

        // Télécharger le QR code
        const downloadBtn = document.getElementById('download-qr');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadQRCode();
            });
        }

        // Actualiser
        const refreshBtn = document.getElementById('refresh-share');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                GeoflowPanels.showPanel('share', 'tools');
            });
        }

        // Générer le QR code
        this.generateQRCode();
    },

    /**
     * Generate share URL with current map context
     * @returns {string} Share URL
     */
    generateShareUrl() {
        const map = GeoflowMap.map;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const basemap = GeoflowMap.currentBasemap;

        // Récupérer les couches actives
        const activeLayers = Array.from(GeoflowLayers.activeLayerIds);

        // Construire l'URL avec paramètres
        const params = new URLSearchParams();
        params.set('lat', center.lat.toFixed(6));
        params.set('lng', center.lng.toFixed(6));
        params.set('zoom', zoom);
        params.set('basemap', basemap);
        
        if (activeLayers.length > 0) {
            params.set('layers', activeLayers.join(','));
        }

        // URL complète
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?${params.toString()}`;
    },

    /**
     * Get context summary for display
     * @returns {string} HTML summary
     */
    getContextSummary() {
        const map = GeoflowMap.map;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const activeLayers = Array.from(GeoflowLayers.activeLayerIds);

        let summary = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fa-solid fa-location-dot" style="color: var(--primary); width: 16px;"></i>
                <span>Position: ${center.lat.toFixed(4)}°N, ${center.lng.toFixed(4)}°E</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fa-solid fa-magnifying-glass-plus" style="color: var(--primary); width: 16px;"></i>
                <span>Zoom: ${zoom}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fa-solid fa-map" style="color: var(--primary); width: 16px;"></i>
                <span>Fond: ${GeoflowConfig.map.baseLayers[GeoflowMap.currentBasemap]?.name || 'Par défaut'}</span>
            </div>
        `;

        if (activeLayers.length > 0) {
            summary += `
                <div style="display: flex; align-items: start; gap: 6px;">
                    <i class="fa-solid fa-layer-group" style="color: var(--primary); width: 16px; margin-top: 2px;"></i>
                    <span>Couches (${activeLayers.length}): ${activeLayers.slice(0, 3).join(', ')}${activeLayers.length > 3 ? '...' : ''}</span>
                </div>
            `;
        } else {
            summary += `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-layer-group" style="color: var(--text-secondary); width: 16px;"></i>
                    <span>Aucune couche active</span>
                </div>
            `;
        }

        return summary;
    },

    /**
     * Generate QR code using qrcodejs (lightweight library)
     */
    generateQRCode() {
        const canvas = document.getElementById('qrcode-canvas');
        if (!canvas) return;

        const shareUrl = this.generateShareUrl();
        
        // Simple QR code generation using canvas
        // Utilise une bibliothèque légère : on va utiliser l'API gratuite de goqr.me
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 200, 200);
        };
        img.onerror = () => {
            // Fallback : afficher le texte si l'API ne fonctionne pas
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#000000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('QR Code', 100, 95);
            ctx.fillText('non disponible', 100, 110);
        };
        img.src = qrApiUrl;
    },

    /**
     * Download QR code as image
     */
    downloadQRCode() {
        const canvas = document.getElementById('qrcode-canvas');
        if (!canvas) return;

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `geoflow_qr_${Date.now()}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            GeoflowUtils.showToast('QR Code téléchargé', 'success');
        });
    },

    /**
     * Apply shared context from URL parameters
     */
    applySharedContext() {
        const params = new URLSearchParams(window.location.search);
        
        // Vérifier si des paramètres de partage existent
        const lat = params.get('lat');
        const lng = params.get('lng');
        const zoom = params.get('zoom');
        const basemap = params.get('basemap');
        const layersParam = params.get('layers');

        if (lat && lng && zoom) {
            // Appliquer la position et le zoom
            setTimeout(() => {
                GeoflowMap.map.setView([parseFloat(lat), parseFloat(lng)], parseInt(zoom));
                GeoflowUtils.showToast('Contexte partagé chargé', 'success');
            }, 500);

            // Appliquer le fond de carte
            if (basemap && GeoflowConfig.map.baseLayers[basemap]) {
                setTimeout(() => {
                    GeoflowMap.switchBasemap(basemap);
                }, 600);
            }

            // Appliquer les couches actives
            if (layersParam) {
                const layers = layersParam.split(',');
                setTimeout(() => {
                    layers.forEach(layerId => {
                        if (!GeoflowLayers.activeLayerIds.has(layerId)) {
                            GeoflowLayers.toggleLayer(layerId, true);
                        }
                    });
                }, 700);
            }
        }
    }
};