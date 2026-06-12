# Configuration for LandGuard Pipeline

STAC_API_URL = "https://earth-search.aws.element84.com/v1"
COLLECTIONS_OPTICAL = ["sentinel-2-c1-l2a"]
COLLECTIONS_SAR = ["sentinel-1-grd"]

MAX_CLOUD_COVER = 20
MIN_CHANGE_AREA_M2 = 100

WEIGHTS = {
    "ndbi_increase": 0.25,
    "ndvi_decrease": 0.20,
    "sar_evidence": 0.25,
    "temporal_persistence": 0.20,
    "shape_characteristics": 0.10
}

S2_RESOLUTION = 10  # meters
S1_RESOLUTION = 10  # meters