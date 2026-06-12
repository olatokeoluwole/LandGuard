import xarray as xr
import numpy as np

def detect_sar_change(data):
    """
    Detect change using Sentinel-1 SAR GRD VV backscatter.
    Looks for persistent increased backscatter (structures/earthworks).
    """
    # Convert digital numbers to dB
    data_db = 10 * np.log10(data.vv.where(data.vv > 0) + 1e-8)
    
    # Split into early and late temporal composites
    midpoint = len(data_db.time) // 2
    early = data_db.isel(time=slice(0, midpoint)).median(dim='time')
    late = data_db.isel(time=slice(midpoint, None)).median(dim='time')
    
    # Significant increase in backscatter often indicates new structures
    vv_increase = late - early
    
    # Thresholding for significant SAR change (> 2.5 dB rise)
    sar_mask = vv_increase > 2.5
    
    return sar_mask, vv_increase