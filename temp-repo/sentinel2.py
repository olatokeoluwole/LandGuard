import xarray as xr
import numpy as np

def calculate_indices(data):
    """
    Calculate NDVI and NDBI from Sentinel-2 L2A Data.
    Expected bands: 'red', 'nir', 'swir16'
    """
    # Scale optical data to reflectance (typically factor of 10000 in S2)
    data = data / 10000.0
    
    # NDVI = (NIR - RED) / (NIR + RED)
    ndvi = (data.nir - data.red) / (data.nir + data.red + 1e-8)
    
    # NDBI = (SWIR - NIR) / (SWIR + NIR)
    ndbi = (data.swir16 - data.nir) / (data.swir16 + data.nir + 1e-8)
    
    return xr.Dataset({"ndvi": ndvi, "ndbi": ndbi})

def detect_optical_change(ts_indices):
    """
    Identify potential development where NDVI decreases and NDBI increases
    persistently across the temporal axis.
    """
    # Calculate difference between first half and second half of temporal stack
    midpoint = len(ts_indices.time) // 2
    early = ts_indices.isel(time=slice(0, midpoint)).median(dim='time')
    late = ts_indices.isel(time=slice(midpoint, None)).median(dim='time')
    
    ndvi_drop = early.ndvi - late.ndvi
    ndbi_rise = late.ndbi - early.ndbi
    
    # Thresholding
    development_mask = (ndvi_drop > 0.15) & (ndbi_rise > 0.1)
    
    return development_mask, ndvi_drop, ndbi_rise