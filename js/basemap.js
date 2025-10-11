/**
 * GeoFlow Basemap Module
 * Handles basemap gallery and switching
 */

const GeoFlowBasemap = {
    /**
     * Initialize basemap controls
     */
    init() {
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

        // Basemap selection
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