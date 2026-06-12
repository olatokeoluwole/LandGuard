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
    fig, ax = plt.subplots(figsize=(10,10))
    boundary_gdf.plot(ax=ax, facecolor='none', edgecolor='yellow', linewidth=2)
    if not change_gdf.empty:
        change_gdf.plot(ax=ax, color='red', alpha=0.6)
    
    plt.axis("off")
    fig.savefig(f"{out_dir}/change_map.png", bbox_inches='tight', dpi=300)
    plt.close()

