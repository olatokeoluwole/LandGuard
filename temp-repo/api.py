from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
import os
import tempfile
import json
from app import run_landguard

app = FastAPI(title="LandGuard API", version="1.0.0")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    geojson: Dict[str, Any]
    start_date: str
    end_date: str

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "LandGuard Analysis Engine"}

@app.post("/analyze")
def analyze_boundary(request: AnalysisRequest):
    try:
        # Create a temporary directory for output
        out_dir = tempfile.mkdtemp()
        
        # Save GeoJSON to file
        boundary_file = os.path.join(out_dir, "boundary.geojson")
        with open(boundary_file, "w") as f:
            json.dump(request.geojson, f)
            
        # Run the pipeline module
        run_landguard(boundary_file, request.start_date, request.end_date, out_dir)
        
        # Read the generated result
        result_file = os.path.join(out_dir, "change_polygons.geojson")
        if os.path.exists(result_file):
            with open(result_file, "r") as f:
                results = json.load(f)
            return {"status": "success", "data": results}
        else:
            return {"status": "error", "message": "Pipeline completed but no output file found."}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))