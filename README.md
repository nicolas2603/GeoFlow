# Structure du projet GeoFlow

## 📁 Architecture des fichiers

```
geoflow/
│
├── index.html                 # Point d'entrée HTML
├── config.json                # Configuration de l'application
│
├── css/
│   ├── theme.css             # Variables CSS et thème
│   └── app.css               # Styles de l'application
│
├── js/
│   ├── config.js             # Configuration JavaScript
│   ├── utils.js              # Utilitaires généraux
│   ├── map.js                # Gestion de la carte
│   ├── layers.js             # Gestion des couches
│   ├── draw.js               # Outils de dessin
│   ├── measure.js            # Outils de mesure
│   ├── search.js             # Recherche géocodage
│   ├── basemap.js            # Fonds de carte
│   ├── panels.js             # Gestion des panneaux
│   ├── tools.js              # Outils divers
│   └── app.js                # Application principale
│
└── assets/
    └── logo.svg              # Logo de l'application
```

## 📋 Description des modules

### **index.html**
Point d'entrée de l'application. Contient la structure HTML et charge tous les fichiers CSS et JS dans le bon ordre.

### **config.json**
Configuration centralisée :
- Paramètres de la carte (centre, zoom)
- Définition des fonds de carte
- Configuration des couches thématiques
- Données de légende
- URLs des APIs

### **CSS**

#### `theme.css`
- Variables CSS pour les couleurs et styles
- Thèmes clair et sombre
- Styles des scrollbars

#### `app.css`
- Styles de tous les composants UI
- Layout responsive
- Animations et transitions
- Personnalisation Leaflet

### **JavaScript**

#### `config.js`
- Configuration de la carte
- Endpoints API
- Définitions des légendes
- Données de démonstration

#### `utils.js`
Fonctions utilitaires :
- `showLoading()` / `hideLoading()`
- `showToast(message, type)`
- `copyToClipboard(text)`
- `calculateLength(latlngs)`
- `formatDistance(meters)`
- `formatArea(squareMeters)`
- `toggleTheme()` / `loadTheme()`
- `debounce(func, wait)`

#### `map.js`
Gestion de la carte :
- `init()` - Initialisation de la carte Leaflet
- `switchBasemap(type)` - Changement de fond de carte
- `getView()` / `setView()` - Gestion de la vue
- `resetView()` - Retour à la vue initiale
- `locateUser()` - Géolocalisation
- `toggleFullscreen()` - Mode plein écran
- `updateStats()` - Mise à jour des statistiques

#### `layers.js`
Gestion des couches :
- `init()` - Initialisation du système de couches
- `getPanelContent()` - Génération du HTML du panneau
- `createLayerItem()` - Création d'un élément de couche
- `attachListeners()` - Événements des contrôles
- `toggleLayer()` - Activation/désactivation
- `loadDemoPoints()` / `loadDemoZones()` - Chargement des données
- `applyLayerOpacity()` - Gestion de l'opacité
- `updateLegendWidget()` - Mise à jour de la légende
- `updateStats()` - Statistiques des éléments

#### `draw.js`
Outils de dessin :
- `init()` - Initialisation des outils Leaflet.draw
- `getPanelContent()` - HTML du panneau de dessin
- `attachListeners()` - Événements des outils
- `exportGeoJSON()` - Export des géométries
- `clearAll()` - Effacement de toutes les géométries

#### `measure.js`
Outils de mesure :
- `getPanelContent()` - HTML du panneau de mesure
- `attachListeners()` - Événements des outils
- `startMeasure(type)` - Démarrage de la mesure (distance/surface)

#### `search.js`
Recherche et géocodage :
- `init()` - Initialisation de la recherche
- `performSearch(query)` - Recherche via Nominatim
- `displayResults(results)` - Affichage des résultats
- `hideResults()` - Masquage des résultats

#### `basemap.js`
Gestion des fonds de carte :
- `init()` - Initialisation des contrôles
- `toggleGallery()` - Affichage/masquage de la galerie
- `selectBasemap(type, item)` - Sélection d'un fond

#### `panels.js`
Gestion des panneaux latéraux :
- `init()` - Initialisation des contrôles
- `showPanel(type)` - Affichage d'un panneau spécifique
- `closePanel()` - Fermeture du panneau actif
- `toggleLegend()` - Basculement de la légende

#### `tools.js`
Outils divers :
- `getPanelContent()` - HTML du panneau d'outils
- `attachListeners()` - Événements des outils
- `handleToolAction(tool)` - Gestion des actions (thème, capture, partage, etc.)

#### `app.js`
Application principale :
- `init()` - Initialisation de tous les modules
- `initActionButtons()` - Boutons d'action
- `initKeyboardShortcuts()` - Raccourcis clavier

## 🔄 Flux d'initialisation

1. **Chargement de la page** → `index.html`
2. **Chargement du thème** → `theme.css` + thème sauvegardé
3. **Chargement des styles** → `app.css`
4. **DOMContentLoaded** → `app.js`
5. **Initialisation des modules** :
   - Configuration (`config.js`)
   - Carte (`map.js`)
   - Couches (`layers.js`)
   - Dessin (`draw.js`)
   - Recherche (`search.js`)
   - Fonds de carte (`basemap.js`)
   - Panneaux (`panels.js`)

## 🎯 Dépendances entre modules

```
app.js
  ├── config.js (Configuration)
  ├── utils.js (Utilitaires)
  ├── map.js
  │     └── utils.js
  ├── layers.js
  │     ├── map.js
  │     ├── config.js
  │     └── utils.js
  ├── draw.js
  │     ├── map.js
  │     └── utils.js
  ├── measure.js
  │     ├── map.js
  │     └── utils.js
  ├── search.js
  │     ├── map.js
  │     └── config.js
  ├── basemap.js
  │     └── map.js
  ├── panels.js
  │     ├── layers.js
  │     ├── draw.js
  │     ├── measure.js
  │     └── tools.js
  └── tools.js
        ├── utils.js
        └── draw.js
```

## 🚀 Avantages de cette architecture

1. **Modularité** : Chaque fonctionnalité est isolée dans son propre module
2. **Maintenabilité** : Code organisé et facile à comprendre
3. **Réutilisabilité** : Les modules peuvent être réutilisés ou étendus
4. **Testabilité** : Chaque module peut être testé indépendamment
5. **Évolutivité** : Ajout facile de nouvelles fonctionnalités
6. **Performance** : Chargement optimisé des ressources
7. **Collaboration** : Plusieurs développeurs peuvent travailler sur différents modules

## 📝 Notes d'utilisation

- Les modules communiquent via des objets globaux (GeoFlowMap, GeoFlowLayers, etc.)
- La configuration est centralisée dans `config.js` et `config.json`
- Les utilitaires communs sont dans `utils.js`
- Le thème est géré par CSS variables pour un changement dynamique
- L'ordre de chargement des scripts dans `index.html` est important