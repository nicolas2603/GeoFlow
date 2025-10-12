/**
 * GeoFlow Basemap Module
 * Handles basemap gallery and switching
 */

const GeoFlowBasemap = {
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
        const baseLayers = GeoFlowConfig.map.baseLayers;
        
        let html = '';
        Object.entries(baseLayers).forEach(([key, config]) => {
            const isDefault = config.default ? 'active' : '';
            html += `
                <div class="basemap-item ${isDefault}" data-basemap="${key}">
                    <img src="${config.preview}" alt="${config.name}">
                    <span class="tooltip-custom tooltip-top">${config.name}</span>
                </div>
            `;
        });
        
        gallery.innerHTML = html;

        // Set preview image for default basemap
        const defaultBasemap = Object.entries(baseLayers).find(([, config]) => config.default);
        if (defaultBasemap) {
            const previewImg = document.getElementById('basemap-preview');
            previewImg.src = defaultBasemap[1].preview;
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
        GeoFlowMap.switchBasemap(type);
        
        // Update preview image
        const previewImg = document.getElementById('basemap-preview');
        previewImg.src = item.querySelector('img').src;
        
        // Close gallery
        document.getElementById('basemap-gallery').classList.remove('active');
    }
};