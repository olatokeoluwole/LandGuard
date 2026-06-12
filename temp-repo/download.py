import pystac_client
import odc.stac
from config import STAC_API_URL, MAX_CLOUD_COVER

def search_stac(collections, bounds, start_date, end_date, max_cloud=None):
    """Search STAC API and return items intersecting the boundary and timeframe."""
    catalog = pystac_client.Client.open(STAC_API_URL)
    
    query_args = {
        "collections": collections,
        "bbox": bounds,
        "datetime": f"{start_date}/{end_date}",
    }
    
    if max_cloud is not None:
        query_args["query"] = {"eo:cloud_cover": {"lt": max_cloud}}
        
    search = catalog.search(**query_args)
    items = list(search.items())
    
    # Sort chronologically
    items.sort(key=lambda x: x.datetime)
    return items

def load_data(items, bounds, resolution, bands):
    """Load datacube covering the bounds using odc-stac."""
    data = odc.stac.load(
        items,
        bbox=bounds,
        bands=bands,
        resolution=resolution,
        chunks={"x": 512, "y": 512, "time": 1},
        groupby="solar_day" # Merge intra-day passes
    )
    return data