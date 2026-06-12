from config import WEIGHTS

def calculate_confidence(gdf, optical_mask, sar_mask):
    """
    Assign a confidence score to each polygon based on multimodality evidence.
    """
    scores = []
    categories = []
    
    for idx, row in gdf.iterrows():
        # Extent of polygon
        geom = row.geometry
        
        # In a real pipeline, we extract raster values underneath the polygon.
        # Here we mock the integration of metrics based on the features defined.
        base_score = 50.0  # Base score for passing morph criteria
        
        # Add weights (Using fixed values here simulating integration step)
        score = base_score + (WEIGHTS["ndbi_increase"] * 100) + (WEIGHTS["sar_evidence"] * 50)
        score = min(100.0, score)
        
        if score > 85:
            cat = "VERY HIGH"
        elif score > 70:
            cat = "HIGH"
        elif score > 50:
            cat = "MEDIUM"
        else:
            cat = "LOW"
            
        scores.append(round(score, 1))
        categories.append(cat)
        
    gdf["confidence_score"] = scores
    gdf["confidence_category"] = categories
    # Mocking first_detected_date for the MVP output format
    gdf["first_detected_date"] = "2026-04-18"
    
    return gdf