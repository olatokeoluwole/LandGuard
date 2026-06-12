import React, { useState } from 'react';
import { 
  Satellite, Calendar, UploadCloud, Map as MapIcon, 
  MapPin, Loader2, Download, CheckCircle, BarChart3, AlertTriangle, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { useMap, MapContainer, TileLayer, GeoJSON, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pythonFiles } from './pythonData';
import bbox from '@turf/bbox';
import bboxPolygon from '@turf/bbox-polygon';
import booleanIntersects from '@turf/boolean-intersects';

const MapBoundsUpdater = ({ geoData }: { geoData: any }) => {
  const map = useMap();
  React.useEffect(() => {
    if (geoData && map) {
      try {
        const geoJsonLayer = L.geoJSON(geoData);
        if (geoJsonLayer) {
          const bounds = geoJsonLayer.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { animate: true, padding: [20, 20] });
          }
        }
      } catch (err) {
        console.error("Could not fit bounds:", err);
      }
    }
  }, [geoData, map]);
  return null;
};

import { toJpeg } from 'html-to-image';

// Simulates the Python script's outputs in browser for MVP
const App = () => {
  const [geojson, setGeojson] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  
  const [parsedGeo, setParsedGeo] = useState<any>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [apiError, setApiError] = useState("");

  const steps = [
    "Querying STAC endpoints for Sentinel-1 & Sentinel-2...",
    "Downloading L2A Optical Datacubes...",
    "Computing NDVI and NDBI indices...",
    "Downloading Sentinel-1 SAR GRD...",
    "Calculating VV Backscatter Temporal Coherence...",
    "Merging Multimodal Evidence & Morphological Filtering...",
    "Generating Output Maps and Reports..."
  ];

  const handleGeoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeojson(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      setParsedGeo(parsed);
    } catch (err) {
      setParsedGeo(null);
    }
  };

  const startAnalysis = async () => {
    if(!parsedGeo || !startDate || !endDate) {
      alert("Please provide valid GeoJSON and dates.");
      return;
    }
    setIsProcessing(true);
    setProgressIdx(0);
    setResults(null);
    setApiError("");

    if (backendUrl) {
      // Connect to Real Deployed Server
      try {
        const payload = {
          geojson: parsedGeo,
          start_date: startDate,
          end_date: endDate
        };

        const res = await fetch(`${backendUrl.replace(/\/$/, '')}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        
        if (data.status === 'success') {
          // Calculate stats based on returned features
          const features = data.data.features || [];
          let tArea = 0;
          let maxConf = 0;
          
          // Filter out features outside the provided GeoJSON
          const filteredFeatures = features.filter((f: any) => {
            try {
              if (parsedGeo && parsedGeo.features && parsedGeo.features.length > 0) {
                 return booleanIntersects(f, parsedGeo.features[0]);
              }
              return true;
            } catch (e) {
              return true;
            }
          });

          // Convert changes to Bounding Boxes
          const boundingBoxFeatures = filteredFeatures.map((f: any) => {
             try {
                const fBox = bbox(f);
                const poly = bboxPolygon(fBox);
                poly.properties = f.properties;
                return poly;
             } catch (e) {
                return f;
             }
          });

          boundingBoxFeatures.forEach((f: any) => {
             tArea += (f.properties.area_m2 || 0);
             if (f.properties.confidence_score > maxConf) {
               maxConf = f.properties.confidence_score;
             }
          });
          
          setResults({
            changes: {
              type: "FeatureCollection",
              features: boundingBoxFeatures
            },
            stats: {
              totalArea: tArea.toFixed(1),
              polygonCount: boundingBoxFeatures.length,
              maxConfidence: maxConf > 0 ? `${maxConf}%` : 'N/A'
            }
          });
        } else {
          setApiError(data.message || "Failed to analyze data on server.");
        }
      } catch (err: any) {
        setApiError("Error connecting to Python backend: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Mock Fallback
      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        if (currentStep < steps.length) {
          setProgressIdx(currentStep);
        } else {
          clearInterval(timer);
          setIsProcessing(false);
          generateMockResults();
        }
      }, 1500);
    }
  };

  const generateMockResults = () => {
    // We mock generated changes based on the input bounds
    // Adding some random variation to simulate different analysis results for the MVP
    const randomMultiplier = 0.5 + Math.random();
    const area1 = +(450.5 * randomMultiplier).toFixed(1);
    const area2 = +(125.0 * randomMultiplier).toFixed(1);
    const totalArea = +(area1 + area2).toFixed(1);
    const conf1 = Math.floor(85 + Math.random() * 14); // 85-98
    const conf2 = Math.floor(70 + Math.random() * 19); // 70-88
    
    // Select dates somewhat randomly within the start/end bounds if possible,
    // or just use static dates for the mock
    const detectionDate1 = startDate || "2026-04-18";
    const detectionDate2 = endDate || "2026-05-02";

    let bounds;
    try {
      if (parsedGeo) {
        bounds = L.geoJSON(parsedGeo).getBounds();
      }
    } catch (err) {}

    let centerLat = 0;
    let centerLon = 0;
    let latSpan = 0.002;
    let lonSpan = 0.002;

    if (bounds && bounds.isValid()) {
       const center = bounds.getCenter();
       centerLat = center.lat;
       centerLon = center.lng;
       // We use a small fraction of the polygon's size to ensure the mock changes stay inside
       latSpan = (bounds.getNorth() - bounds.getSouth()) * 0.15; 
       lonSpan = (bounds.getEast() - bounds.getWest()) * 0.15;
    } else {
       const centerNode = parsedGeo?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || [0, 0];
       centerLon = centerNode[0] || 0;
       centerLat = centerNode[1] || 0;
    }

    // Creating Bounding Boxes. A bounding box is a rectangular polygon.
    // Box 1: Box near the center
    const b1_s = centerLat - latSpan/2;
    const b1_n = centerLat + latSpan/2;
    const b1_w = centerLon - lonSpan/2;
    const b1_e = centerLon + lonSpan/2;

    // Box 2: Slightly offset, still small
    const b2_s = centerLat + latSpan;
    const b2_n = centerLat + latSpan*1.5;
    const b2_w = centerLon + lonSpan;
    const b2_e = centerLon + lonSpan*1.5;

    let mockChangePolys = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { area_m2: area1, confidence_score: conf1, confidence_category: "VERY HIGH", first_detected_date: detectionDate1 },
          geometry: { 
            type: "Polygon", 
            coordinates: [[[b1_w, b1_s], [b1_w, b1_n], [b1_e, b1_n], [b1_e, b1_s], [b1_w, b1_s]]] 
          }
        },
        {
          type: "Feature",
          properties: { area_m2: area2, confidence_score: conf2, confidence_category: "HIGH", first_detected_date: detectionDate2 },
          geometry: { 
            type: "Polygon", 
            coordinates: [[[b2_w, b2_s], [b2_w, b2_n], [b2_e, b2_n], [b2_e, b2_s], [b2_w, b2_s]]] 
          } 
        }
      ]
    };
    
    // Filter to ensure mock polys also respect boundaries
    if (parsedGeo && parsedGeo.features && parsedGeo.features.length > 0) {
      mockChangePolys.features = mockChangePolys.features.filter((f: any) => {
         try {
           return booleanIntersects(f, parsedGeo.features[0]);
         } catch { return true; }
      });
    }

    // Recalculate stats based on what survived
    let newArea = 0;
    mockChangePolys.features.forEach((f:any) => { newArea += f.properties.area_m2; });

    setResults({
      changes: mockChangePolys,
      stats: {
        totalArea: newArea.toFixed(1),
        polygonCount: mockChangePolys.features.length,
        maxConfidence: mockChangePolys.features.length > 0 ? `${conf1}%` : 'N/A'
      }
    });
  };

  const downloadPythonEngine = async () => {
    try {
      const zip = new JSZip();
      
      Object.entries(pythonFiles).forEach(([filename, content]) => {
        zip.file(filename, content);
      });
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "landguard_python_core.zip");
    } catch (err) {
      console.error(err);
      alert("Error generating zip: " + (err as Error).message);
    }
  };

  const downloadGeoJSON = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results.changes, null, 2)], { type: "application/json" });
    saveAs(blob, "change_polygons.geojson");
  }

  const downloadReport = async () => {
    if (!results) return;
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text("LandGuard Monitoring Report", 20, 30);
      
      doc.setFontSize(14);
      doc.text("Executive Summary", 20, 50);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Analysis Period: ${startDate} to ${endDate}`, 20, 60);
      doc.text(`The LandGuard system identified ${results.stats.polygonCount} instances of likely`, 20, 70);
      doc.text(`development or structural change within the target boundary.`, 20, 78);
      
      doc.text(`Total Changed Area: ${results.stats.totalArea} sq meters`, 20, 95);
      doc.text(`Highest Confidence: ${results.stats.maxConfidence}`, 20, 103);

      const mapElem = document.getElementById("map-capture-container");
      if (mapElem) {
        // html-to-image to avoid oklab color parse issues
        const dataUrl = await toJpeg(mapElem, { quality: 0.7 });
        doc.text("Map Context (Changes Circled Red)", 20, 120);
        doc.addImage(dataUrl, "JPEG", 20, 125, 170, 90);
      }
      
      autoTable(doc, {
        startY: 220,
        head: [['ID', 'Area (m2)', 'Confidence', 'Detected']],
        body: results.changes.features.map((f: any, i: number) => [
          (i + 1).toString(),
          f.properties.area_m2.toString(),
          f.properties.confidence_category,
          f.properties.first_detected_date
        ]),
      });
      
      doc.save("landguard_report.pdf");
    } catch (err) {
      console.error(err);
      alert("Error printing PDF");
    }
  };

  const center = parsedGeo?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || [0, 0];
  const flipCoord = [center[1] || 51.505, center[0] || -0.09] as [number, number];
  const initialZoom = parsedGeo ? 13 : 2;

  const onDrawCreated = (e: any) => {
    const layer = e.layer;
    const geojsonObj = layer.toGeoJSON();
    
    // Ensure the polygon is strictly closed for external parsers
    if (geojsonObj.geometry && geojsonObj.geometry.type === 'Polygon') {
      const rings = geojsonObj.geometry.coordinates;
      rings.forEach((ring: any[]) => {
        if (ring.length > 0) {
          const firstPoint = ring[0];
          const lastPoint = ring[ring.length - 1];
          if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
            ring.push([...firstPoint]);
          }
        }
      });
    }

    const fc = {
      type: "FeatureCollection",
      features: [geojsonObj]
    };
    const fcStr = JSON.stringify(fc, null, 2);
    setGeojson(fcStr);
    setParsedGeo(fc);
  };

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-[#D1D1D1] font-sans flex flex-col">
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 lg:px-8 bg-[#080808] shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Satellite className="w-6 h-6 text-emerald-500" />
          <h1 className="text-2xl font-serif italic text-white tracking-tight">LandGuard</h1>
          <span className="ml-2 px-2 py-0.5 border border-emerald-500/30 text-emerald-500 text-[10px] font-semibold rounded uppercase tracking-widest hidden sm:inline-block">Geospatial Intelligence</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-white/50 uppercase tracking-widest">System Active</span>
          </div>
          <button 
            onClick={downloadPythonEngine}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 transition border border-white/10 rounded text-[10px] text-white uppercase tracking-widest font-bold flex items-center gap-2"
          >
            <Download className="w-3 h-3" />
            Engine
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: Input Form */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-xl shadow-2xl flex flex-col">
            <h2 className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-2 mb-6">
               <UploadCloud className="w-4 h-4 text-emerald-500" /> Active Boundary
            </h2>
            
            <div className="space-y-6">
              <section>
                <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-3">Target Boundary (GeoJSON)</label>
                <textarea 
                  value={geojson}
                  onChange={handleGeoChange}
                  placeholder='{"type": "FeatureCollection", ...}'
                  className="w-full h-32 bg-white/5 rounded-lg p-3 border border-white/10 text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none transition placeholder-white/20 resize-none"
                />
                {!parsedGeo && geojson.length > 0 && <p className="text-red-400 text-xs mt-2 font-mono">Invalid GeoJSON format</p>}
                {parsedGeo && <p className="text-emerald-400 text-[10px] uppercase tracking-widest mt-2 flex items-center gap-1 font-bold"><CheckCircle className="w-3 h-3"/> Valid geometry detected</p>}
              </section>

              <section>
                <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-3">Analysis Period</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10 focus-within:border-emerald-500/50 transition">
                    <p className="text-[10px] text-white/30 uppercase mb-1">Start</p>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-transparent text-sm text-white font-mono outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10 focus-within:border-emerald-500/50 transition">
                    <p className="text-[10px] text-white/30 uppercase mb-1">End</p>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-transparent text-sm text-white font-mono outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
              </section>

              <section>
                <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-3">Live Server API (Optional)</label>
                <input 
                  type="text" 
                  value={backendUrl}
                  onChange={e => setBackendUrl(e.target.value)}
                  placeholder="https://your-python-api.onrender.com"
                  className="w-full bg-white/5 rounded-lg p-3 border border-white/10 text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none transition placeholder-white/20"
                />
                <p className="text-[10px] text-white/40 mt-2 leading-relaxed">
                  Provide your deployed Python backend URL to process real satellite imagery. Leave empty to use local prototype simulation.
                </p>
              </section>

              {apiError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-400 font-mono leading-relaxed">{apiError}</p>
                </div>
              )}

              <div className="pt-2">
                <button 
                  onClick={startAnalysis}
                  disabled={isProcessing || !parsedGeo || !startDate || !endDate}
                  className="w-full py-3 bg-white text-black text-xs font-bold uppercase tracking-widest rounded transition hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin"/> Processing Stage</> : <><MapIcon className="w-4 h-4"/> Generate Report</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Map & Results visually representing the outputs */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Status Panel */}
          {isProcessing && (
            <div className="bg-white/5 border border-white/10 rounded-lg px-6 py-5 animate-pulse">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-2">
                     <Loader2 className="w-4 h-4 animate-spin text-emerald-500"/>
                     Processing Stage: <span className="text-white font-mono normal-case tracking-normal">{steps[progressIdx]}</span>
                   </h3>
                   <span className="text-xs font-mono font-bold text-emerald-500">{Math.round((progressIdx / steps.length) * 100)}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                   <div 
                     className="bg-emerald-500 h-full transition-all duration-1000 ease-in-out" 
                     style={{ width: `${(progressIdx / steps.length) * 100}%`}}
                    />
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0F0F11] border border-white/5 p-5 rounded-xl shadow-2xl flex flex-col items-center justify-center text-center">
                 <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Detected Polygons</p>
                 <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-serif text-white">{String(results.stats.polygonCount).padStart(2, '0')}</span>
                   <span className="text-xs text-white/40 tracking-wider uppercase">Clusters</span>
                 </div>
              </div>
              <div className="bg-[#0F0F11] border border-white/5 p-5 rounded-xl shadow-2xl flex flex-col items-center justify-center text-center">
                 <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Total Changed Area</p>
                 <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-serif text-white">{results.stats.totalArea}</span>
                   <span className="text-xs text-emerald-400/60 font-mono">m²</span>
                 </div>
              </div>
              <div className="bg-[#0F0F11] border border-white/5 p-5 rounded-xl shadow-2xl flex flex-col gap-3 justify-center">
                 <button onClick={downloadReport} className="w-full py-2.5 border border-white/10 rounded text-[10px] text-white hover:bg-white hover:text-black transition uppercase font-bold tracking-widest flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4"/> PDF Report
                 </button>
                 <button onClick={downloadGeoJSON} className="w-full py-2.5 border border-white/10 rounded text-[10px] text-white hover:bg-white hover:text-black transition uppercase font-bold tracking-widest flex items-center justify-center gap-2">
                    <MapPin className="w-4 h-4"/> GeoJSON
                 </button>
              </div>
            </div>
          )}

          <div id="map-capture-container" className="bg-[#0F0F11] border border-white/5 rounded-xl overflow-hidden h-full min-h-[500px] lg:h-[600px] flex flex-col relative z-0 shadow-2xl">
              <MapContainer center={flipCoord} zoom={initialZoom} style={{ height: '100%', width: '100%', backgroundColor: '#0A0A0A' }} zoomControl={false}>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                  className="opacity-70 saturate-50 contrast-125"
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  attribution="&copy; Esri"
                />
                
                <FeatureGroup>
                  <EditControl
                    position="topright"
                    onCreated={onDrawCreated}
                    draw={{
                      circle: false,
                      circlemarker: false,
                      marker: false,
                      polyline: false,
                    }}
                  />
                </FeatureGroup>

                <MapBoundsUpdater geoData={parsedGeo} />

                {parsedGeo && (
                <GeoJSON 
                  key={JSON.stringify(parsedGeo)} // to force re-render when geodata changes
                  data={parsedGeo} 
                  style={() => ({
                    color: '#22c55e', // emerald-500
                    weight: 2,
                    dashArray: '4 4',
                    fillColor: '#22c55e',
                    fillOpacity: 0.05
                  })} 
                />
                )}

                {results && results.changes && (
                  <GeoJSON
                    key={"results-layer-"+Date.now()}
                    data={results.changes}
                    pointToLayer={(feature, latlng) => {
                       return L.circleMarker(latlng, {
                         radius: 12,
                         fillColor: "#ef4444",
                         color: "#ef4444",
                         weight: 2,
                         opacity: 1,
                         fillOpacity: 0.4
                       });
                    }}
                    style={() => ({
                       color: '#ef4444',
                       weight: 3,
                       fill: true,
                       fillOpacity: 0.05
                    })}
                  />
                )}

                {/* We would render results here visually in a real map, using Leaflet bounding boxes to trick the view for the MVP */}
                {results && (
                   <div className="absolute top-4 right-4 z-[1000] bg-[#0A0A0A]/90 backdrop-blur-md p-4 rounded-lg shadow-2xl border border-white/10 font-mono text-[10px] text-white min-w-[200px] mt-12">
                      <div className="flex items-center gap-2 text-red-500 mb-3 border-b border-white/10 pb-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full block animate-pulse drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]"></span>
                        <span className="font-bold uppercase tracking-wider text-xs">Detected Encroachment</span>
                      </div>
                      <div className="space-y-1.5 text-white/60">
                         <div className="flex justify-between"><span className="text-white/40">Total Area:</span> <span className="text-white font-bold">{results.stats.totalArea} m²</span></div>
                         <div className="flex justify-between"><span className="text-white/40">Earliest Detection:</span> <span className="text-emerald-400">{results.changes.features[0].properties.first_detected_date}</span></div>
                         <div className="flex justify-between"><span className="text-white/40">Confidence:</span> <span className="text-white">{results.stats.maxConfidence}</span></div>
                      </div>
                   </div>
                )}
              </MapContainer>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
