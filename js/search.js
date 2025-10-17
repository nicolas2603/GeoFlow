/**
 * Geoflow Search Module
 * Handles geocoding and location search
 */

const GeoflowSearch = {
    searchTimeout: null,

    /**
     * Initialize search functionality
     */
    init() {
        const searchInput = document.getElementById('search-input');
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                this.hideResults();
                return;
            }

            this.searchTimeout = setTimeout(() => this.performSearch(query), 500);
        });

        // Close results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-bar')) {
                this.hideResults();
            }
        });
    },

    /**
     * Perform geocoding search
     * @param {string} query - Search query
     */
    async performSearch(query) {
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '<div style="padding: 12px; text-align: center;"><div class="spinner-border spinner-border-sm"></div></div>';
        resultsDiv.classList.add('active');

        try {
            const response = await fetch(
                `${GeoflowConfig.api.nominatim}/search?format=json&q=${encodeURIComponent(query)}&limit=8`
            );
            const results = await response.json();

            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-secondary);">Aucun résultat</div>';
                return;
            }

            this.displayResults(results);
        } catch (error) {
            resultsDiv.innerHTML = '<div style="padding: 16px; text-align: center; color: #ef4444;">Erreur de recherche</div>';
            console.error('Search error:', error);
        }
    },

    /**
     * Display search results
     * @param {Array} results - Search results from Nominatim
     */
    displayResults(results) {
        const resultsDiv = document.getElementById('search-results');
        
        resultsDiv.innerHTML = results.map(r => `
            <div class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}">
                <div class="search-result-name">${r.display_name.split(',')[0]}</div>
                <div class="search-result-address">${r.display_name.split(',').slice(1, 3).join(',')}</div>
            </div>
        `).join('');

        // Add click listeners to results
        resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                
                GeoflowMap.map.setView([lat, lon], 16);
                
                L.marker([lat, lon]).addTo(GeoflowMap.map)
                    .bindPopup('<div class="feature-popup"><h6>Recherche</h6></div>')
                    .openPopup();
                
                this.hideResults();
                document.getElementById('search-input').value = '';
            });
        });
    },

    /**
     * Hide search results
     */
    hideResults() {
        document.getElementById('search-results').classList.remove('active');
    }
};