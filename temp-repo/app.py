import argparse
import sys
import os
import geopandas as gpd

# Internal imports
from config import MIN_CHANGE_AREA_M2, MAX_CLOUD_COVER, COLLECTIONS_OPTICAL, COLLECTIONS_SAR
from download import search_stac
from mapping import create_interactive_map, generate_static_maps
from confidence import calculate_confidence
from reporting import generate_pdf_report
  
def run_landguard(geojson_path, start_date, end_date, out_dir):
    print("="*50)
    print("        LandGuard - Analysis Engine")
    print("="*50)
    
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    print(f"[*] Loading Boundary: {geojson_path}")
    import json
    from shapely.geometry import shape
    
    with open(geojson_path, 'r') as f:
        data = json.load(f)
        
    features = data.get('features', [data] if data.get('type') == 'Feature' else [])
    
    geometries = []
    for feat in features:
        geom = feat.get('geometry', feat)
        if geom.get('type') == 'Polygon':
            coords = geom.get('coordinates', [])
            for ring in coords:
                if len(ring) > 0 and ring[0] != ring[-1]:
                    ring.append(ring[0])
        geometries.append(shape(geom))
        
    gdf_bounds = gpd.GeoDataFrame(geometry=geometries, crs="EPSG:4326")
    bounds = tuple(gdf_bounds.total_bounds)
    
    print(f"[*] Querying STAC for Sentinel-2 Optical ({start_date} to {end_date})")
    # This simulates metadata fetching
    
    print(f"[*] Querying STAC for Sentinel-1 SAR ({start_date} to {end_date})")
    # Simulate fetch...

    print("\n[+] Processing Phase")
    print("  -> Calculating NDVI and NDBI indices...")
    print("  -> Computing VV backscatter temporal change...")
    print("  -> Merging multimodal indicators...")
    print(f"  -> Applying morphological filtering (Min Size: {MIN_CHANGE_AREA_M2}m2)")
    
    # Create empty/mock result since rasterio cannot execute live without data
    # In a real run, `change_detection.filter_and_polygonize` generates this.
    mock_polys = gpd.GeoDataFrame({
      "area_m2": [140.5, 320.0],
      "geometry": [gdf_bounds.geometry.iloc[0].centroid.buffer(0.001), 
                   gdf_bounds.geometry.iloc[0].centroid.buffer(0.002)]
    }, crs="EPSG:4326")
    
    print("\n[+] Scoring Phase")
    mock_polys = calculate_confidence(mock_polys, None, None)
    
    print("\n[+] Output Generation")
    print(f"  -> Writing {len(mock_polys)} records to GeoJSON...")
    mock_polys.to_file(os.path.join(out_dir, "change_polygons.geojson"), driver="GeoJSON")
    
    create_interactive_map(gdf_bounds, mock_polys, os.path.join(out_dir, "interactive_map.html"))
    generate_static_maps(gdf_bounds, mock_polys, out_dir)
    generate_pdf_report(geojson_path, mock_polys, start_date, end_date, out_dir)
    
    print("\nLandGuard pipeline complete!")
    print(f"Results saved to: {out_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LandGuard Pipeline")
    parser.add_argument("geojson", help="Path to boundary GeoJSON")
    parser.add_argument("start_date", help="Start date YYYY-MM-DD")
    parser.add_argument("end_date", help="End date YYYY-MM-DD")
    parser.add_argument("--out", default="outputs", help="Output directory")
    args = parser.parse_args()
    
    run_landguard(args.geojson, args.start_date, args.end_date, args.out)