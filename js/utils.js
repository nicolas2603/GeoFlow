/**
 * GeoFlow Utilities Module
 * Common utility functions used across the application
 */

const GeoFlowUtils = {
    /**
     * Show loading spinner with custom message
     * @param {string} message - The message to display (default: 'Chargement de l'application...')
     */
    showLoading(message = 'Chargement de l\'application...') {
        const loading = document.getElementById('loading');
        
        if (loading) {
            // Update message if loading already exists
            const loadingText = loading.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            loading.classList.add('active');
        } else {
            // Create loading overlay if it doesn't exist
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'loading';
            loadingDiv.className = 'active';
            loadingDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(4px);
            `;
            
            loadingDiv.innerHTML = `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <div class="loading-text" style="margin-top: 1rem; font-size: 1rem; color: var(--text-primary); font-weight: 500;">
                        ${message}
                    </div>
                </div>
            `;
            
            document.body.appendChild(loadingDiv);
        }
    },

    /**
     * Hide loading spinner
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('active');
        }
    },

    /**
     * Show toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of toast (success, error, warning, info)
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: 'circle-check',
            error: 'circle-xmark',
            warning: 'triangle-exclamation',
            info: 'circle-info'
        };

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid fa-${icons[type]} toast-icon" style="color: ${colors[type]}"></i>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     */
    copyToClipboard(text) {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    },

    /**
     * Calculate length of a polyline
     * @param {Array} latlngs - Array of lat/lng coordinates
     * @returns {number} Length in meters
     */
    calculateLength(latlngs) {
        let length = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            length += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        return length;
    },

    /**
     * Format distance for display
     * @param {number} meters - Distance in meters
     * @returns {string} Formatted distance string
     */
    formatDistance(meters) {
        return meters > 1000 
            ? `${(meters/1000).toFixed(2)} km`
            : `${meters.toFixed(0)} m`;
    },

    /**
     * Format area for display
     * @param {number} squareMeters - Area in square meters
     * @returns {string} Formatted area string
     */
    formatArea(squareMeters) {
        return squareMeters > 10000
            ? `${(squareMeters/10000).toFixed(2)} ha`
            : `${squareMeters.toFixed(0)} m²`;
    },

    /**
     * Toggle theme (light/dark)
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('geoflow-theme', newTheme);
        
        this.showToast(`Thème ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`, 'success');
        
        return newTheme;
    },

    /**
     * Load saved theme from localStorage
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('geoflow-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        return savedTheme;
    },

    /**
     * Debounce function for performance optimization
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};