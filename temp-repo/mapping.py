import folium
import geopandas as gpd

def create_interactive_map(boundary_gdf, change_gdf, out_path):
    """
    Generate folium interactive map with layers.
    """
    # Center map
    centroid = boundary_gdf.geometry.centroid.iloc[0]
    m = folium.Map(location=[centroid.y, centroid.x], zoom_start=14)
    
    # Base Imagery layers (we mock URLs here for illustration)
    folium.TileLayer(
        tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr='Esri',
        name='Satellite Base',
        overlay=False,
        control=True
    ).add_to(m)
    
    # Boundary Layer
    folium.GeoJson(
        boundary_gdf,
        name='Boundary',
        style_function=lambda x: {'fillColor': 'none', 'color': 'yellow', 'weight': 3}
    ).add_to(m)
    
    # Detected Changes Layer
    if not change_gdf.empty:
        folium.GeoJson(
            change_gdf,
            name='Detected Development',
            style_function=lambda x: {'fillColor': 'red', 'color': 'darkred', 'weight': 2, 'fillOpacity': 0.6},
            tooltip=folium.GeoJsonTooltip(fields=['area_m2', 'confidence_score', 'first_detected_date'])
        ).add_to(m)
        
    folium.LayerControl().add_to(m)
    m.save(out_path)
    
def generate_static_maps(boundary_gdf, change_gdf, out_dir):
    """
    Generate static PNGs using matplotlib for the PDF report.
    """
    import matplotlib.pyplot as plt
    try:
        import contextily as ctx
        has_ctx = True
    except ImportError:
        has_ctx = False
        
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(20,10))
    
    # Reproject to Web Mercator for Contextily
    boundary_3857 = boundary_gdf.to_crs(epsg=3857)
    
    # Before Map
    boundary_3857.plot(ax=ax1, facecolor='none', edgecolor='yellow', linewidth=3)
    ax1.set_title("Before (Start Reference)", fontsize=24)
    
    # After Map
    boundary_3857.plot(ax=ax2, facecolor='none', edgecolor='yellow', linewidth=3)
    if not change_gdf.empty:
        change_3857 = change_gdf.to_crs(epsg=3857)
        change_3857.plot(ax=ax2, color='red', alpha=0.6)
        
        # Draw a prominent circle around the detected changes
        centroids = change_3857.centroid
        for x, y in zip(centroids.x, centroids.y):
            ax2.plot(x, y, 'o', markerfacecolor='none', markeredgecolor='red', markersize=60, markeredgewidth=3)
            
    ax2.set_title("After (Detected Changes)", fontsize=24)
        
    if has_ctx:
        try:
            # Force a moderate zoom level to avoid "data not available" from Esri server
            ctx.add_basemap(ax1, source=ctx.providers.Esri.WorldImagery, zoom=14)
            ctx.add_basemap(ax2, source=ctx.providers.Esri.WorldImagery, zoom=14)
        except Exception:
            pass
    
    ax1.axis("off")
    ax2.axis("off")
    fig.savefig(f"{out_dir}/change_map.png", bbox_inches='tight', dpi=300)
    plt.close()