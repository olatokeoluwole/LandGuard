from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import pandas as pd
import os

def generate_pdf_report(boundary_path, changes_gdf, start_date, end_date, out_dir):
    """
    Generate the executive PDF report dynamically.
    """
    pdf_path = os.path.join(out_dir, "report.pdf")
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter
    
    # PAGE 1: TITLE / EXECUTIVE SUMMARY
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 80, "LandGuard Monitoring Report")
    
    c.setFont("Helvetica", 14)
    c.drawString(50, height - 120, "Executive Summary")
    
    c.setFont("Helvetica", 12)
    summary = f"""Analysis Period: {start_date} to {end_date}.
    The LandGuard system identified {len(changes_gdf)} instances of likely 
    development or structural change within the target boundary."""
    
    textobject = c.beginText(50, height - 150)
    for line in summary.split('\n'):
        textobject.textLine(line.strip())
    c.drawText(textobject)
    
    # Stats
    total_area = changes_gdf['area_m2'].sum() if not changes_gdf.empty else 0
    c.drawString(50, height - 220, f"Total Changed Area: {total_area:,.1f} sq meters")
    
    # Map Image
    map_img_path = os.path.join(out_dir, "change_map.png")
    if os.path.exists(map_img_path):
        # 1x2 plot has 2:1 aspect ratio
        c.drawImage(map_img_path, 30, height - 520, width=540, height=270, preserveAspectRatio=True)

    c.showPage()
    
    # PAGE 2: CHANGE STATISTICS
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 80, "Detected Development Polygons")
    
    y = height - 120
    c.setFont("Helvetica", 10)
    if not changes_gdf.empty:
        for idx, row in changes_gdf.iterrows():
            if y < 100:
                c.showPage()
                y = height - 80
            c.drawString(50, y, f"ID: {idx+1} | Area: {row['area_m2']:,.1f} m2 | Confidence: {row['confidence_score']} ({row['confidence_category']}) | Detected: {row.get('first_detected_date', 'N/A')}")
            y -= 25
    else:
         c.drawString(50, y, "No significant changes detected matching criteria.")
         
    c.save()