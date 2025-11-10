/**
 * Geoflow Basemap Module
 * Handles basemap gallery and switching
 */

const GeoflowBasemap = {
    /**
     * Initialize basemap controls
     */
    init() {
        // Generate basemap gallery from config
        this.generateGallery();

        // Toggle gallery
        document.getElementById('btn-basemap').addEventListener('click', () => {
            this.toggleGallery();
        });

        // Close gallery when clicking outside
        document.addEventListener('click', (e) => {
            const gallery = document.getElementById('basemap-gallery');
            const basemapBtn = document.getElementById('btn-basemap');
            
            if (!gallery.contains(e.target) && !basemapBtn.contains(e.target)) {
                gallery.classList.remove('active');
            }
        });
    },

    /**
     * Generate basemap gallery from configuration
     */
    generateGallery() {
        const gallery = document.getElementById('basemap-gallery');
        const baseLayers = GeoflowConfig.map.baseLayers;
        
        let html = '';
        Object.entries(baseLayers).forEach(([key, config]) => {
            const isDefault = config.default ? 'active' : '';
            
            // Générer l'URL de la vignette preview
            let previewUrl;
            if (config.preview) {
                // Si une preview personnalisée est définie
                previewUrl = config.preview;
            } else if (config.type === 'wmts') {
                // Générer automatiquement une preview pour WMTS
                // En utilisant des coordonnées centrées sur la France (z=6, x=32, y=22)
                previewUrl = config.url
                    .replace('{z}', '6')
                    .replace('{x}', '32')
                    .replace('{y}', '22')
                    .replace('{TILEMATRIX}', '6')
                    .replace('{TILECOL}', '32')
                    .replace('{TILEROW}', '22');
            } else {
                // Pour les tuiles standards, utiliser la même logique
                previewUrl = config.url
                    .replace('{z}', '6')
                    .replace('{x}', '32')
                    .replace('{y}', '22')
                    .replace('{s}', 'a');
            }
            
            html += `
                <div class="basemap-item ${isDefault}" data-basemap="${key}">
                    <img src="${previewUrl}" alt="${config.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2212%22 text-anchor=%22middle%22 dy=%22.3em%22%3E${config.name}%3C/text%3E%3C/svg%3E'">
                    <span class="tooltip-custom tooltip-top">${config.name}</span>
                </div>
            `;
        });
        
        gallery.innerHTML = html;

        // Set preview image for default basemap
        const defaultBasemap = Object.entries(baseLayers).find(([, config]) => config.default);
        if (defaultBasemap) {
            const previewImg = document.getElementById('basemap-preview');
            const config = defaultBasemap[1];
            
            // Utiliser la même logique pour la preview du bouton
            let previewUrl;
            if (config.preview) {
                previewUrl = config.preview;
            } else if (config.type === 'wmts') {
                previewUrl = config.url
                    .replace('{z}', '6')
                    .replace('{x}', '32')
                    .replace('{y}', '22')
                    .replace('{TILEMATRIX}', '6')
                    .replace('{TILECOL}', '32')
                    .replace('{TILEROW}', '22');
            } else {
                previewUrl = config.url
                    .replace('{z}', '6')
                    .replace('{x}', '32')
                    .replace('{y}', '22')
                    .replace('{s}', 'a');
            }
            
            previewImg.src = previewUrl;
        }

        // Attach click listeners
        document.querySelectorAll('.basemap-item').forEach(item => {
            item.addEventListener('click', () => {
                const basemapType = item.dataset.basemap;
                this.selectBasemap(basemapType, item);
            });
        });
    },

    /**
     * Toggle basemap gallery visibility
     */
    toggleGallery() {
        const gallery = document.getElementById('basemap-gallery');
        gallery.classList.toggle('active');
    },

    /**
     * Select and activate a basemap
     * @param {string} type - Basemap type
     * @param {HTMLElement} item - Clicked basemap item
     */
    selectBasemap(type, item) {
        // Update active state
        document.querySelectorAll('.basemap-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Switch basemap
        GeoflowMap.switchBasemap(type);
        
        // Update preview image
        const previewImg = document.getElementById('basemap-preview');
        previewImg.src = item.querySelector('img').src;
        
        // Close gallery
        document.getElementById('basemap-gallery').classList.remove('active');
    }
};