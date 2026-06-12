import numpy as np
from skimage.measure import label, regionprops
from skimage.morphology import closing, square, remove_small_objects
from shapely.geometry import Polygon
import geopandas as gpd

def filter_and_polygonize(binary_mask, transform, min_area_m2, resolution):
    """
    Apply morphological filtering to remove noise, and convert contiguous
    changed pixels into Shapely polygons.
    """
    # Morphological closing to fill small holes
    closed = closing(binary_mask, square(3))
    
    # Area threshold in terms of pixels
    pixel_area_m2 = resolution ** 2
    min_pixels = max(1, int(min_area_m2 / pixel_area_m2))
    cleaned = remove_small_objects(closed, min_size=min_pixels)
    
    # Connected component labeling
    labeled = label(cleaned, connectivity=2)
    regions = regionprops(labeled)
    
    polygons = []
    properties = []
    
    for r in regions:
        # Extract boundary coordinates for each region to create a bounding box
        minr, minc, maxr, maxc = r.bbox
        
        # Convert pixel bounds to real-world coordinates via transform
        xs = [minc, maxc, maxc, minc]
        ys = [minr, minr, maxr, maxr]
        lon, lat = transform * (xs, ys)
        
        poly = Polygon(zip(lon, lat))
        polygons.append(poly)
        
        # Store area as property
        properties.append({
            "area_m2": r.area * pixel_area_m2,
            "region_id": r.label
        })
        
    gdf = gpd.GeoDataFrame(properties, geometry=polygons, crs="EPSG:4326")
    return gdf