/**
 * GeoFlow Configuration Module
 */

const GeoFlowConfig = {
    // Map configuration
    map: {
        center: [43.6108, 3.8767],
        zoom: 10,
        minZoom: 3,
        maxZoom: 19
    },

    // API endpoints
    api: {
        backend: 'http://localhost:3001',
        nominatim: 'https://nominatim.openstreetmap.org'
    },

    // Legend definitions
    legends: {
        'points': {
            type: 'categorized',
            items: [
                { symbol: 'point', color: '#e74c3c', label: 'Monument' },
                { symbol: 'point', color: '#3498db', label: 'Culture' },
                { symbol: 'point', color: '#2ecc71', label: 'Parc' },
                { symbol: 'point', color: '#f39c12', label: 'Transport' }
            ],
            metadata: {
                source: 'OpenStreetMap',
                date: '2024'
            }
        },
        'zones': {
            type: 'simple',
            items: [
                { symbol: 'polygon', color: '#2563eb', label: 'Centre-ville' }
            ],
            metadata: {
                source: 'IGN',
                date: '2024'
            }
        },
        'natura2000': {
            type: 'categorized',
            items: [
                { symbol: 'polygon', color: '#8e44ad', label: 'ZPS - Directive oiseaux' },
                { symbol: 'polygon', color: '#16a085', label: 'ZSC - Directive habitats' },
                { symbol: 'polygon', color: '#f39c12', label: 'Zone tampon' },
                { symbol: 'line', color: '#c0392b', label: 'Limites' }
            ],
            metadata: {
                source: 'DREAL 2024',
                date: 'Janvier 2024',
                method: 'Directive 92/43/CEE'
            }
        }
    },

    // Demo data
    demoData: {
        points: [
            { lat: 43.6108, lng: 3.8767, name: 'Place de la Comédie', type: 'Monument' },
            { lat: 43.6119, lng: 3.8738, name: 'Musée Fabre', type: 'Culture' },
            { lat: 43.6097, lng: 3.8720, name: "Arc de Triomphe", type: 'Monument' },
            { lat: 43.6142, lng: 3.8720, name: 'Jardin des Plantes', type: 'Parc' },
            { lat: 43.6205, lng: 3.8597, name: 'Zoo de Lunaret', type: 'Loisirs' },
            { lat: 43.6047, lng: 3.8942, name: 'Gare Saint-Roch', type: 'Transport' }
        ],
        zone: {
            coordinates: [
                [43.615, 3.865],
                [43.615, 3.885],
                [43.605, 3.885],
                [43.605, 3.865]
            ],
            name: 'Centre-ville',
            color: '#2563eb',
            fillOpacity: 0.2
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoFlowConfig;
}