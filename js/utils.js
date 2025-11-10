/**
 * Geoflow Utilities Module
 * Common utility functions used across the application
 */

const GeoflowUtils = {
    /**
     * Show loading spinner with custom message (full screen - for app initialization)
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
     * Show loading overlay (semi-transparent - for operations like export/print)
     * @param {string} message - The message to display
     */
    showLoadingOverlay(message = 'Traitement en cours...') {
        // Remove existing overlay if any
        this.hideLoadingOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(2px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.2s;
        `;
        
        overlay.innerHTML = `
            <div style="
                background: var(--surface);
                padding: 24px 32px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                min-width: 250px;
            ">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(37, 99, 235, 0.1);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                "></div>
                <div style="
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    text-align: center;
                ">${message}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    },

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
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