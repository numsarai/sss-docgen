import re
from datetime import datetime

def post_process_variables(variables: dict) -> dict:
    """
    Format dates and apply basic Thai conversions to extracted variables.
    """
    out = {}
    today = datetime.now()
    thai_year = today.year + 543
    thai_months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ]
    current_date_th = f"{today.day} {thai_months[today.month - 1]} {thai_year}"

    for k, v in variables.items():
        if not v:
            # Auto-fill date if it looks like a "Date" field
            key_lower = k.lower()
            if any(term in key_lower for term in ["date", "วันที่"]):
                out[k] = current_date_th
                continue
            out[k] = v
            continue

        # If it's a 4-digit year starting with 202x, convert to Thai Year
        # (e.g., 2024 -> 2567)
        def replace_year(match):
            ad_year = int(match.group(0))
            if 2000 <= ad_year <= 2100:
                return str(ad_year + 543)
            return str(ad_year)

        new_val = re.sub(r'\b20[0-9]{2}\b', replace_year, str(v))
        out[k] = new_val

    return out
