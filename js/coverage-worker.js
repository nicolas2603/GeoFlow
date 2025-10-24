/**
 * Geoflow Coverage Tracing Module
 * Port of QGIS SolarPanelGenerator tracing_logic.py
 * SOLUTION: Generate segments correctly (iterative), then assemble smartly
 */

const GeoflowCoverageTracing = {
    
    toleranceBuffer: 0.1,
    maxIterations: 10000,
    DEBUG_MODE: false,
    debugLayer: null,
    debugMap: null,
    state: null,
    
    enableDebug(map, layer) {
        this.DEBUG_MODE = true;
        this.debugMap = map;
        this.debugLayer = layer;
        console.log('🛠️ DEBUG MODE ENABLED');
    },
    
    disableDebug() {
        this.DEBUG_MODE = false;
    },
    
    /**
     * Main entry point
     */
    traceCoverageBoundary(panels, hSpacing, vSpacing, orientation) {
        try {
            //console.log(`🎯 Starting coverage tracing: ${panels.length} panels`);
            const startTime = performance.now();
            
            this.resetState();
            
            const tolX = hSpacing + this.toleranceBuffer;
            const tolY = vSpacing + this.toleranceBuffer;
            const isTracker = Math.abs((orientation % 180) - 90) < 1e-6;
            
            this.tolerance = {
                x: isTracker ? tolY : tolX,
                y: isTracker ? tolX : tolY
            };
            this.isTracker = isTracker;
            
            //console.log(`📏 Tolerances: X=${this.tolerance.x.toFixed(3)}m, Y=${this.tolerance.y.toFixed(3)}m`);
            
            const preparedPanels = this.preparePanels(panels, isTracker);
            if (preparedPanels.length === 0) return null;
            
            const rows = this.organizePanelsIntoRows(preparedPanels);
            //console.log(`📊 Organized into ${rows.length} rows`);
            
            const panelPositions = new Map();
            rows.forEach((row, i) => {
                row.forEach((panel, j) => {
                    panelPositions.set(panel.id, { row: i, col: j });
                });
            });
            
            const firstPanel = rows[0][0];
            const startPoint = this.getStartingPoint(firstPanel, isTracker);
            
            //console.log(`🚀 Starting from panel ${firstPanel.id} and point ${startPoint}`);
            
            this.generateSegmentsIterative(firstPanel, startPoint, rows, panelPositions);
            
            //console.log(`📦 Generated ${this.state.segments.length} segments`);
            
            if (this.state.segments.length === 0) {
                console.error('❌ NO SEGMENTS GENERATED');
                return null;
            }
            
            const assembledPoints = this.assembleSegmentsSmartly(startPoint);
            
            //this.exportSegmentsToGeoJSON();
            
            if (!assembledPoints || assembledPoints.length < 3) {
                console.warn('Failed to assemble valid polygon');
                return null;
            }
            
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            
            return assembledPoints;
            
        } catch (error) {
            console.error('❌ Error in coverage tracing:', error);
            return null;
        }
    },
    
    resetState() {
        this.state = {
            s: 0,
            p: 0,
            context: { origin: null },
            segmentsVisited: new Set(),
            segments: [],
            segmentId: 1,
            iterations: 0,
            callStack: []
        };
    },
    
    generateSegmentsIterative(firstPanel, startPoint, rows, panelPositions) {
        this.state.callStack = [];
        this.state.callStack.push(['tracer_recouvrement', firstPanel, startPoint, rows, panelPositions, false]);
        
        while (this.state.callStack.length > 0) {
            this.state.iterations++;
            
            if (this.state.iterations > this.maxIterations) {
                break;
            }
            
            const call = this.state.callStack.pop();
            const [method, ...args] = call;
            
            //console.log('Method:', method, 'args:', args);
            
            switch(method) {
                case 'tracer_recouvrement': this._tracerRecouvrement(...args); break;
                case 'panneau_a_droite': this._panneauADroite(...args); break;
                case 'panneau_au_dessus': this._panneauAuDessus(...args); break;
                case 'panneau_en_dessous': this._panneauEnDessous(...args); break;
                case 'panneau_a_gauche': this._panneauAGauche(...args); break;
                case 'panneau_projection_haut': this._panneauProjectionHaut(...args); break;
                case 'panneau_projection_bas': this._panneauProjectionBas(...args); break;
                case 'panneau_sens_1': this._panneauSens1(...args); break;
                case 'panneau_sens_2': this._panneauSens2(...args); break;
                case 'calcul_projection': this._calculProjection(...args); break;
            }
        }
    },
    
    _addCall(method, ...args) {
        this.state.callStack.push([method, ...args]);
    },
    
    /**
     * SMART ASSEMBLY using graph traversal
     */
    assembleSegmentsSmartly(forcedStartPoint = null) {
        const segments = this.state.segments;
        
        if (segments.length === 0) return null;
        
        // Build adjacency graph
        const graph = new Map();
        
        segments.forEach(seg => {
            const key1 = this._pointKey(seg.p1);
            const key2 = this._pointKey(seg.p2);
            
            if (!graph.has(key1)) graph.set(key1, []);
            if (!graph.has(key2)) graph.set(key2, []);
            
            graph.get(key1).push({ to: seg.p2, segId: seg.id, forward: true });
            graph.get(key2).push({ to: seg.p1, segId: seg.id, forward: false });
        });
        
        // Find starting point
        let startPoint = forcedStartPoint;
        let startKey = forcedStartPoint ? this._pointKey(forcedStartPoint) : null;
        
        if (!startPoint) {
            for (const [key, edges] of graph.entries()) {
                if (edges.length === 1) {
                    startKey = key;
                    const coords = key.split(',');
                    startPoint = [parseFloat(coords[0]), parseFloat(coords[1])];
                    break;
                }
            }
        }
        
        if (!startPoint) {
            startPoint = segments[0].p1;
            startKey = this._pointKey(startPoint);
        }
        
        //console.log(`🚦 Starting assembly from [${startPoint[0].toFixed(6)}, ${startPoint[1].toFixed(6)}]`);
        
        // Traverse graph
        const path = [[...startPoint]];
        const usedSegments = new Set();
        let currentKey = startKey;
        let iterations = 0;
        const maxIterations = segments.length * 2;
        
        while (usedSegments.size < segments.length && iterations < maxIterations) {
            iterations++;
            
            const edges = graph.get(currentKey) || [];
            
            let nextEdge = null;
            for (const edge of edges) {
                if (!usedSegments.has(edge.segId)) {
                    nextEdge = edge;
                    break;
                }
            }
            
            if (!nextEdge) {
                for (const seg of segments) {
                    if (!usedSegments.has(seg.id)) {
                        //console.warn(`⚠️ Gap at iteration ${iterations}, jumping to segment ${seg.id}`);
                        path.push([...seg.p1]);
                        path.push([...seg.p2]);
                        usedSegments.add(seg.id);
                        currentKey = this._pointKey(seg.p2);
                        break;
                    }
                }
                if (usedSegments.size >= segments.length) break;
                continue;
            }
            
            usedSegments.add(nextEdge.segId);
            path.push([...nextEdge.to]);
            currentKey = this._pointKey(nextEdge.to);
        }
        
        // Close polygon
        if (path.length > 0) {
            const first = path[0];
            const last = path[path.length - 1];
            if (!this._pointsEqual(first, last)) {
                path.push([...first]);
            }
        }
        
        //console.log(`✅ Assembled ${path.length} points (${usedSegments.size}/${segments.length} segments)`);
        
        return path;
    },
    
    exportSegmentsToGeoJSON() {
        if (!this.state || !this.state.segments || this.state.segments.length === 0) {
            console.warn('⚠️ Aucun segment à exporter');
            return null;
        }

        const features = this.state.segments.map(seg => ({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [seg.p1, seg.p2],
            },
            properties: {
                id: seg.id,
                note: seg.note || '',
                order: seg.order || 0,
            },
        }));

        const geojson = {
            type: 'FeatureCollection',
            features: features,
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], {
            type: 'application/geo+json',
        });
        const url = URL.createObjectURL(blob);

        // Force download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'coverage_segments_debug.geojson';
        a.click();

        console.log(`💾 Exported ${features.length} segments to coverage_segments_debug.geojson`);
        return geojson;
    },
    
    _pointKey(point) {
        return `${point[0].toFixed(9)},${point[1].toFixed(9)}`;
    },
    
    _pointsEqual(p1, p2) {
        return Math.abs(p1[0] - p2[0]) < 1e-9 && Math.abs(p1[1] - p2[1]) < 1e-9;
    },
    
    addSegment(p1, p2, note) {
        if (Math.abs(p1[0] - p2[0]) < 1e-10 && Math.abs(p1[1] - p2[1]) < 1e-10) return;
        
        const key = `${p1[0].toFixed(8)},${p1[1].toFixed(8)}-${p2[0].toFixed(8)},${p2[1].toFixed(8)}`;
        const keyReverse = `${p2[0].toFixed(8)},${p2[1].toFixed(8)}-${p1[0].toFixed(8)},${p1[1].toFixed(8)}`;
        
        if (this.state.segmentsVisited.has(key) || this.state.segmentsVisited.has(keyReverse)) return;
        
        this.state.segmentsVisited.add(key);
        
        this.state.segments.push({
            id: this.state.segmentId,
            p1: [p1[0], p1[1]],
            p2: [p2[0], p2[1]],
            note: note,
            order: this.state.segmentId
        });
        
        if (this.DEBUG_MODE && this.debugMap && this.debugLayer) {
            this.visualizeSegment(p1, p2, note);
        }
        
        this.state.segmentId++;
    },
    
    visualizeSegment(p1, p2, note) {
        const colors = {
            'Bord droite': '#ef4444', 'Bord gauche': '#3b82f6', 'Bord haut': '#10b981', 'Bord bas': '#f59e0b',
            'Liaison droite': '#8b5cf6', 'Liaison gauche': '#ec4899', 'Liaison haute': '#14b8a6', 'Liaison basse': '#f97316',
            'Liaison haute alternative 1': '#a855f7', 'Liaison haute alternative 2': '#c026d3',
            'Liaison basse alternative 1': '#fb923c', 'Liaison basse alternative 2': '#fbbf24',
            'Bord haut alternatif 1': '#4ade80', 'Bord haut alternatif 2': '#22c55e',
            'Bord bas alternatif 1': '#fb7185', 'Bord bas alternatif 2': '#f43f5e'
        };
        
        const line = L.polyline([[p1[1], p1[0]], [p2[1], p2[0]]], {
            color: colors[note] || '#6b7280', weight: 3, opacity: 0.8
        });
        
        line.bindPopup(`<div style="font-size: 0.75rem;"><b>Segment ${this.state.segmentId}</b><br><span style="color: ${colors[note] || '#6b7280'};">● ${note}</span></div>`);
        this.debugLayer.addLayer(line);
    },
    
    _tracerRecouvrement(panel, coin, rows, panelPositions, forcer) {
        const origin = this.state.context.origin;
        
        if (origin === null || origin === "panneau_au_dessus_None" || origin === "panneau_projection_haut_ko" || origin === "calcul_projection") {
            if (origin === null || origin === "panneau_au_dessus_None" || origin === "panneau_projection_haut_ko") {
                coin = this.bordHaut(panel);
            }
            this._addCall('panneau_a_droite', panel, rows, panelPositions);
        } else if (origin === "panneau_a_droite_ko" || origin === "panneau_a_gauche_ok") {
            this.state.context.origin = null;
            this._addCall('panneau_en_dessous', panel, rows, panelPositions);
        } else if (origin === "panneau_a_droite_ok" || origin === "panneau_a_gauche_ko") {
            this.state.context.origin = null;
            this._addCall('panneau_au_dessus', panel, rows, panelPositions);
        } else if (origin === "panneau_au_dessus_ko") {
            this.state.context.origin = null;
            this._addCall('panneau_projection_haut', panel, rows, panelPositions);
        } else if (origin === "panneau_au_dessus_ok") {
            this.state.context.origin = null;
            this._addCall('panneau_sens_2', panel, rows, panelPositions);
        } else if (origin === "panneau_en_dessous_ko") {
            this.state.context.origin = null;
            this._addCall('panneau_projection_bas', panel, rows, panelPositions);
        } else if (origin === "panneau_en_dessous_ok") {
            this.state.context.origin = null;
            this._addCall('panneau_sens_1', panel, rows, panelPositions);
        } else if (origin === "panneau_projection_bas_ko") {
            this.state.context.origin = null;
            this._addCall('panneau_a_gauche', panel, rows, panelPositions);
        }
    },
    
    _panneauADroite(panel, rows, panelPositions) {
        const coords = panel.coords;
        const topRight = coords[2];
        const pos = panelPositions.get(panel.id);
        const row = rows[pos.row];
        
        for (let i = pos.col + 1; i < row.length; i++) {
            const nextPanel = row[i];
            const dx = nextPanel.coords[1][0] - topRight[0];
            if (dx >= 0 && dx <= this.tolerance.x) {
                this.state.context.origin = "panneau_a_droite_ok";
                this.liaisonDroite(panel, nextPanel);
                this._addCall('tracer_recouvrement', nextPanel, nextPanel.coords[1], rows, panelPositions, false);
                return;
            }
        }
        
        this.state.context.origin = "panneau_a_droite_ko";
        const coin = this.bordDroite(panel);
        this._addCall('tracer_recouvrement', panel, coin, rows, panelPositions, false);
    },
    
    _panneauAuDessus(panel, rows, panelPositions) {
        const coords = panel.coords;
        const topLeft = coords[1];
        const [xRef, yRef] = topLeft;
        const pos = panelPositions.get(panel.id);
        
        if (pos.row - 1 < 0) {
            this.state.s = 0;
            this.state.context.origin = "panneau_au_dessus_None";
            this._addCall('tracer_recouvrement', panel, coords[2], rows, panelPositions, false);
            return;
        }
        
        const rowAbove = rows[pos.row - 1];
        for (const panelAbove of rowAbove) {
            const bottomLeft = panelAbove.coords[0];
            const [x2, y2] = bottomLeft;
            if (Math.abs(xRef - x2) < 1e-6 && (y2 - yRef) > 0 && (y2 - yRef) <= this.tolerance.y) {
                this.state.context.origin = "panneau_au_dessus_ok";
                this.liaisonHaute(panel, panelAbove);
                this._addCall('tracer_recouvrement', panelAbove, bottomLeft, rows, panelPositions, false);
                return;
            }
        }
        
        this.state.context.origin = "panneau_au_dessus_ko";
        this._addCall('tracer_recouvrement', panel, topLeft, rows, panelPositions, true);
    },
    
    _panneauEnDessous(panel, rows, panelPositions) {
        const coords = panel.coords;
        const bottomRight = coords[3];
        const [xRef, yRef] = bottomRight;
        const pos = panelPositions.get(panel.id);
        
        if (pos.row + 1 >= rows.length) {
            const coin = this.bordBas(panel);
            this.state.s = 1;
            this.state.context.origin = 'panneau_projection_bas_ko';
            this._addCall('tracer_recouvrement', panel, coin, rows, panelPositions, false);
            return;
        }
        
        const rowBelow = rows[pos.row + 1];
        for (const panelBelow of rowBelow) {
            const topRight = panelBelow.coords[2];
            const [x2, y2] = topRight;
            if (Math.abs(xRef - x2) < 1e-6 && (yRef - y2) > 0 && (yRef - y2) <= this.tolerance.y) {
                this.state.context.origin = "panneau_en_dessous_ok";
                this.liaisonBasse(panel, panelBelow);
                this._addCall('tracer_recouvrement', panelBelow, topRight, rows, panelPositions, false);
                return;
            }
        }
        
        this.state.context.origin = "panneau_en_dessous_ko";
        this._addCall('tracer_recouvrement', panel, bottomRight, rows, panelPositions, true);
    },
    
    _panneauAGauche(panel, rows, panelPositions) {
        const coords = panel.coords;
        const bottomLeft = coords[0];
        const [xRef, yRef] = bottomLeft;
        const pos = panelPositions.get(panel.id);
        const row = rows[pos.row];
        
        if (pos.col - 1 >= 0) {
            for (let i = pos.col - 1; i >= 0; i--) {
                const prevPanel = row[i];
                const dx = xRef - prevPanel.coords[3][0];
                if (dx > 0 && dx <= this.tolerance.x) {
                    this.state.context.origin = "panneau_a_gauche_ok";
                    this.liaisonGauche(panel, prevPanel);
                    this._addCall('tracer_recouvrement', prevPanel, prevPanel.coords[3], rows, panelPositions, false);
                    return;
                }
            }
        }
        
        const coin = this.bordGauche(panel);
        this.state.context.origin = "panneau_a_gauche_ko";
        this._addCall('tracer_recouvrement', panel, coin, rows, panelPositions, false);
    },
    
    _panneauProjectionHaut(panel, rows, panelPositions) {
        const coords = panel.coords;
        const x1 = coords[1][0], x2 = coords[2][0], y = coords[1][1];
        const pos = panelPositions.get(panel.id);
        
        if (pos.row - 1 < 0) {
            this.state.s = 0;
            this.state.context.origin = "panneau_projection_haut_ko";
            this._addCall('tracer_recouvrement', panel, coords[2], rows, panelPositions, false);
            return;
        }
        
        const rowAbove = rows[pos.row - 1];
        for (const panelAbove of rowAbove) {
            const coordsAbove = panelAbove.coords;
            const x1Target = coordsAbove[0][0], x2Target = coordsAbove[3][0], yTarget = coordsAbove[0][1];
            
            if (this.chevauchementSurX(x1, x2, x1Target, x2Target) && Math.abs(yTarget - y) <= this.tolerance.y) {
                if (x1 < x1Target) this.state.s = 0;
                else if (x1 > x1Target) this.state.s = 1;
                this.state.p = 1;
                this._addCall('calcul_projection', panel, rows, panelPositions, panelAbove);
                return;
            }
        }
        
        this.state.s = 0;
        this.state.context.origin = "panneau_projection_haut_ko";
        this._addCall('tracer_recouvrement', panel, coords[2], rows, panelPositions, false);
    },
    
    _panneauProjectionBas(panel, rows, panelPositions) {
        const coords = panel.coords;
        const x1 = coords[0][0], x2 = coords[3][0], y = coords[0][1];
        const pos = panelPositions.get(panel.id);
        
        if (pos.row + 1 >= rows.length) {
            const coin = this.bordBas(panel);
            this.state.context.origin = 'panneau_projection_bas_ko';
            this._addCall('tracer_recouvrement', panel, coin, rows, panelPositions, false);
            return;
        }
        
        const rowBelow = rows[pos.row + 1];
        for (let i = rowBelow.length - 1; i >= 0; i--) {
            const panelBelow = rowBelow[i];
            const coordsBelow = panelBelow.coords;
            const x1Target = coordsBelow[1][0], x2Target = coordsBelow[2][0], yTarget = coordsBelow[1][1];
            
            if (this.chevauchementSurX(x1, x2, x1Target, x2Target) && Math.abs(yTarget - y) <= this.tolerance.y) {
                if (x2 < x2Target) this.state.s = 0;
                else if (x2 > x2Target) this.state.s = 1;
                this.state.p = 2;
                this._addCall('calcul_projection', panel, rows, panelPositions, panelBelow);
                return;
            }
        }
        
        const coin = this.bordBas(panel);
        const xMax = Math.max(...rows.flat().map(p => Math.max(p.coords[2][0], p.coords[3][0])));
        if (Math.abs(Math.max(coords[2][0], coords[3][0]) - xMax) < 0.1) this.state.s = 1;
        this.state.context.origin = 'panneau_projection_bas_ko';
        this._addCall('tracer_recouvrement', panel, coin, rows, panelPositions, false);
    },
    
    _panneauSens1(panel, rows, panelPositions) {
        if (this.state.s === 0) {
            this._addCall('panneau_a_droite', panel, rows, panelPositions);
        } else {
            this.bordDroite(panel);
            this._addCall('panneau_en_dessous', panel, rows, panelPositions);
        }
    },
    
    _panneauSens2(panel, rows, panelPositions) {
        if (this.state.s === 0 && !this.isTracker) {
            this.bordGauche(panel);
            this._addCall('panneau_au_dessus', panel, rows, panelPositions);
        } else {
            this._addCall('panneau_a_gauche', panel, rows, panelPositions);
        }
    },
    
    _calculProjection(panel, rows, panelPositions, targetPanel) {
        const coords = panel.coords;
        const coordsTarget = targetPanel.coords;
        
        if (this.state.s === 0 && this.state.p === 1) {
            const startPoint = coordsTarget[0];
            const xProj = startPoint[0], yStart = startPoint[1];
            const [x1, y1] = coords[1], [x2, y2] = coords[2];
            
            if (x1 <= xProj && xProj <= x2 && Math.abs(y1 - yStart) <= this.tolerance.y) {
                const projPoint = [xProj, y1];
                this.addSegment(startPoint, projPoint, "Liaison haute alternative 1");
                this.addSegment(projPoint, coords[1], "Bord haut alternatif 1");
                this.bordGauche(targetPanel);
                this._addCall('panneau_au_dessus', targetPanel, rows, panelPositions);
                return;
            }
        } else if (this.state.s === 0 && this.state.p === 2) {
            const startPoint = coords[3];
            const xProj = startPoint[0], yStart = startPoint[1];
            const [x1, y1] = coordsTarget[1], [x2, y2] = coordsTarget[2];
            
            if (x1 <= xProj && xProj <= x2 && Math.abs(yStart - y1) <= this.tolerance.y) {
                const projPoint = [xProj, y1];
                this.addSegment(startPoint, projPoint, "Liaison haute alternative 2");
                this.addSegment(projPoint, coordsTarget[2], "Bord haut alternatif 2");
                this.state.context.origin = 'calcul_projection';
                this._addCall('tracer_recouvrement', targetPanel, coordsTarget[2], rows, panelPositions, false);
                return;
            }
        } else if (this.state.s === 1 && this.state.p === 1) {
            const startPoint = coords[1];
            const xProj = startPoint[0], yStart = startPoint[1];
            const [x1, y1] = coordsTarget[0], [x2, y2] = coordsTarget[3];
            
            if (x1 <= xProj && xProj <= x2 && Math.abs(yStart - y1) <= this.tolerance.y) {
                const projPoint = [xProj, y1];
                this.addSegment(startPoint, projPoint, "Liaison basse alternative 1");
                this.addSegment(projPoint, coordsTarget[0], "Bord bas alternatif 1");
                this._addCall('panneau_a_gauche', targetPanel, rows, panelPositions);
                return;
            }
        } else if (this.state.s === 1 && this.state.p === 2) {
            const startPoint = coordsTarget[2];
            const xProj = startPoint[0], yStart = startPoint[1];
            const [x1, y1] = coords[0], [x2, y2] = coords[3];
            
            if (x1 <= xProj && xProj <= x2 && Math.abs(y1 - yStart) <= this.tolerance.y) {
                const projPoint = [xProj, y1];
                this.addSegment(startPoint, projPoint, "Liaison basse alternative 2");
                this.addSegment(projPoint, coords[3], "Bord bas alternatif 2");
                const coin = this.bordDroite(targetPanel);
                this.state.context.origin = 'panneau_a_droite_ko';
                this._addCall('tracer_recouvrement', targetPanel, coin, rows, panelPositions, false);
                return;
            }
        }
    },
    
    chevauchementSurX(x1, x2, x1Target, x2Target) {
        return Math.max(x1, x1Target) <= Math.min(x2, x2Target);
    },
    
    bordDroite(panel) {
        const coords = panel.coords;
        this.addSegment(coords[2], coords[3], "Bord droite");
        return coords[3];
    },
    
    bordGauche(panel) {
        const coords = panel.coords;
        this.addSegment(coords[0], coords[1], "Bord gauche");
        return coords[1];
    },
    
    bordHaut(panel) {
        const coords = panel.coords;
        this.addSegment(coords[1], coords[2], "Bord haut");
        return coords[2];
    },
    
    bordBas(panel) {
        const coords = panel.coords;
        this.addSegment(coords[3], coords[0], "Bord bas");
        return coords[0];
    },
    
    liaisonDroite(panel1, panel2) {
        this.addSegment(panel1.coords[2], panel2.coords[1], "Liaison droite");
        return panel2.coords[1];
    },
    
    liaisonGauche(panel1, panel2) {
        this.addSegment(panel1.coords[0], panel2.coords[3], "Liaison gauche");
        return panel2.coords[3];
    },
    
    liaisonBasse(panel1, panel2) {
        this.addSegment(panel1.coords[3], panel2.coords[2], "Liaison basse");
        return panel2.coords[2];
    },
    
    liaisonHaute(panel1, panel2) {
        this.addSegment(panel1.coords[1], panel2.coords[0], "Liaison haute");
        return panel2.coords[0];
    },
    
    preparePanels(panels, isTracker) {
        return panels.map((panel, index) => {
            const coords = panel.geometry.geometry.coordinates[0];
            let normalizedCoords = coords.slice(0, 4);
            
            if (isTracker) {
                normalizedCoords = [normalizedCoords[3], normalizedCoords[0], normalizedCoords[1], normalizedCoords[2]];
            }
            
            const sumX = normalizedCoords.reduce((sum, c) => sum + c[0], 0);
            const sumY = normalizedCoords.reduce((sum, c) => sum + c[1], 0);
            const centroid = [sumX / 4, sumY / 4];
            
            return {
                id: `panel_${index}_${panel.type}`,
                coords: normalizedCoords,
                centroid: centroid,
                meanY: sumY / 4,
                meanX: sumX / 4,
                type: panel.type,
                originalPanel: panel
            };
        });
    },
    
    organizePanelsIntoRows(panels) {
        const rows = [];
        const sortedPanels = [...panels].sort((a, b) => b.meanY - a.meanY);
        
        const panelHeights = panels.map(p => {
            const coords = p.coords;
            const ys = coords.map(c => c[1]);
            return Math.max(...ys) - Math.min(...ys);
        });
        
        const minPanelHeight = Math.min(...panelHeights);
        const tolerance = minPanelHeight * 0.3;
        
        while (sortedPanels.length > 0) {
            const basePanel = sortedPanels.shift();
            const row = [basePanel];
            
            const indicesToRemove = [];
            sortedPanels.forEach((panel, i) => {
                const yDiff = Math.abs(panel.meanY - basePanel.meanY);
                if (yDiff < tolerance) {
                    row.push(panel);
                    indicesToRemove.push(i);
                }
            });
            
            indicesToRemove.reverse().forEach(i => sortedPanels.splice(i, 1));
            row.sort((a, b) => a.centroid[0] - b.centroid[0]);
            rows.push(row);
        }
        
        return rows;
    },
    
    getStartingPoint(panel, isTracker) {
        const coords = panel.coords;
        
        if (isTracker) {
            return coords.reduce((min, pt) => {
                if (pt[0] < min[0] || (pt[0] === min[0] && pt[1] > min[1])) {
                    return pt;
                }
                return min;
            }, coords[0]);
        } else {
            return coords.reduce((min, pt) => {
                if (pt[1] > min[1] || (pt[1] === min[1] && pt[0] < min[0])) {
                    return pt;
                }
                return min;
            }, coords[0]);
        }
    }
};