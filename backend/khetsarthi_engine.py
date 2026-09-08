import pandas as pd
import requests
from sqlalchemy import create_engine, text

# 1. Database Connection
DB_URL = "postgresql://postgres:12345@127.0.0.1:5432/khetsaarthi_db"
engine = create_engine(DB_URL)


def get_user_inputs():
    """Collects inputs directly from the user in the terminal."""
    print("\n==========================================================")
    print("      🌱 WELCOME TO KHETSAARTHI ADVISORY SYSTEM 🌱       ")
    print("==========================================================")

    farmer_name = (
        input("Enter Farmer's Name                         : ").strip()
        or "Farmer"
    )
    region_id = (
        input("Enter Region ID (e.g., REG-WB-001)          : ").strip()
        or "REG-WB-001"
    )
    location_id = (
        input("Enter Location ID (e.g., LOC-WB-PM-001)    : ").strip()
        or "LOC-WB-PM-001"
    )

    try:
        lat = float(input("Enter Latitude (e.g., 22.5726)               : "))
    except ValueError:
        lat = 22.5726

    try:
        lon = float(input("Enter Longitude (e.g., 88.3639)              : "))
    except ValueError:
        lon = 88.3639

    try:
        temperature = float(
            input("Enter Air Temperature (°C) [e.g., 28.0]     : ")
        )
    except ValueError:
        temperature = 28.0

    try:
        soil_moisture = float(
            input("Enter Soil Moisture (%) [e.g., 48.0]       : ")
        )
    except ValueError:
        soil_moisture = 48.0

    try:
        ph = float(input("Enter Soil pH [e.g., 6.5]                    : "))
    except ValueError:
        ph = 6.5

    try:
        light_lux = float(
            input("Enter Light Intensity (Lux) [e.g., 45000]   : ")
        )
    except ValueError:
        light_lux = 45000.0

    preferred_crop = (
        input("Enter Preferred Crop Choice (e.g., Rice)   : ").strip().title()
    )

    return {
        "farmer_name": farmer_name,
        "region_id": region_id,
        "location_id": location_id,
        "lat": lat,
        "lon": lon,
        "temperature": temperature,
        "soil_moisture": soil_moisture,
        "ph": ph,
        "light_lux": light_lux,
        "preferred_crop": preferred_crop,
    }


def sync_live_climate_api(lat, lon, region_id, location_id):
    """Fetches real-time 16-day forecast from Open-Meteo API, evaluates weather risk thresholds,

    and logs the snapshot into PostgreSQL table 'climate_live_data'.
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto"

    try:
        res = requests.get(url, timeout=6)
        daily = res.json()["daily"]

        avg_temp = round(
            sum(daily["temperature_2m_mean"]) / len(daily["temperature_2m_mean"]),
            2,
        )
        max_temp = round(max(daily["temperature_2m_max"]), 2)
        min_temp = round(min(daily["temperature_2m_min"]), 2)
        total_rain = round(sum(daily["precipitation_sum"]), 2)
        max_daily_rain = round(max(daily["precipitation_sum"]), 2)
        max_wind_speed = round(max(daily["wind_speed_10m_max"]), 2)

        heavy_rain_days = sum(
            1 for p in daily["precipitation_sum"] if p >= 30.0
        )

        cyclone_alert = (
            (max_daily_rain > 70.0)
            or (total_rain > 250.0)
            or (max_wind_speed > 60.0)
        )

        if cyclone_alert:
            risk_level = "EXTREME"
        elif heavy_rain_days >= 2 or total_rain > 120.0:
            risk_level = "ELEVATED"
        else:
            risk_level = "NORMAL"

        query = text("""
            INSERT INTO climate_live_data (
                region_id, location_id, latitude, longitude, forecast_days,
                avg_predicted_temp_c, max_predicted_temp_c, min_predicted_temp_c,
                total_predicted_rain_mm, max_single_day_rain_mm, heavy_rain_days,
                cyclone_warning, disaster_risk_level, fetched_at
            ) VALUES (
                :region_id, :location_id, :lat, :lon, 16,
                :avg_temp, :max_temp, :min_temp,
                :total_rain, :max_daily_rain, :heavy_rain,
                :cyclone, :risk_level, NOW()
            )
            RETURNING id;
        """)

        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "region_id": region_id,
                    "location_id": location_id,
                    "lat": lat,
                    "lon": lon,
                    "avg_temp": avg_temp,
                    "max_temp": max_temp,
                    "min_temp": min_temp,
                    "total_rain": total_rain,
                    "max_daily_rain": max_daily_rain,
                    "heavy_rain": heavy_rain_days,
                    "cyclone": cyclone_alert,
                    "risk_level": risk_level,
                },
            )
            record_id = result.fetchone()[0]

        return {
            "record_id": record_id,
            "avg_temp": avg_temp,
            "total_rain": total_rain,
            "max_daily_rain": max_daily_rain,
            "heavy_rain_days": heavy_rain_days,
            "cyclone_warning": cyclone_alert,
            "risk_level": risk_level,
        }

    except Exception as e:
        print(
            f"\n⚠️ Live Weather API Connection Failed ({e}). Proceeding with historical database tables."
        )
        return None


def fetch_database_knowledge(region_id):
    """
    Executes multi-table SQL join across knowledge tables, mapping percentage columns accurately.
    """
    query = text("""
        SELECT 
            cm.crop_id, cm.crop_name,
            cr.min_opt_temp, cr.max_opt_temp,
            cr."min_soil_moisture_%" AS min_soil_moisture_pct, 
            cr."max_soil_moisture_%" AS max_soil_moisture_pct,
            cr.min_ph, cr.max_ph, cr.waterlogging_tolerance,
            cr.min_light_lux, cr.max_light_lux,
            rc.suitability, yp.observed_yield_mt_ha, i.primary_irrigation_method,
            f.fertilizer_type, f.recommended_dose AS fert_dose,
            p.disease, p.pesticide_type, p.recommended_dose AS pest_dose,
            ins.insect_pest, ins.insecticide_type, ins.recommended_dose AS insect_dose,
            r.primary_risk, r.risk_level, l.loss_percentage
        FROM "crop_knowledge_(1)_crop_master" cm
        JOIN "crop_knowledge_(1)_crop_requirements" cr ON cm.crop_id = cr.crop_id
        LEFT JOIN regional_crop_regional_crop rc ON cm.crop_id = rc.crop_id AND rc.region_id = :region_id
        LEFT JOIN regional_crop_yield_performance yp ON cm.crop_id = yp.crop_id AND yp.region_id = :region_id
        LEFT JOIN regional_crop_regional_irrigation i ON cm.crop_id = i.crop_id AND i.region_id = :region_id
        LEFT JOIN agricultural_input_fertilizers f ON cm.crop_id = f.crop_id
        LEFT JOIN agricultural_input_presticides p ON cm.crop_id = p.crop_id
        LEFT JOIN agricultural_input_insecticides ins ON cm.crop_id = ins.crop_id
        LEFT JOIN regional_crop_regional_crop_risk r ON cm.crop_id = r.crop_id AND r.region_id = :region_id
        LEFT JOIN regional_crop_post_harvest_loss l ON cm.crop_id = l.crop_id AND l.region_id = :region_id
    """)
    
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"region_id": region_id})
        
    return df
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"region_id": region_id})

    return df


def run_recommendation_engine():
    inputs = get_user_inputs()

    # 1. Fetch live climate API data and insert snapshot into PostgreSQL
    live_climate = sync_live_climate_api(
        inputs["lat"],
        inputs["lon"],
        inputs["region_id"],
        inputs["location_id"],
    )

    # 2. Fetch multi-table database knowledge
    df = fetch_database_knowledge(inputs["region_id"])
    if df.empty:
        print(f"❌ No matching database records for region {inputs['region_id']}")
        return

    # Coerce columns to numeric, replacing invalid strings/nulls with NaN
    numeric_cols = [
        "min_opt_temp", "max_opt_temp", 
        "min_soil_moisture_pct", "max_soil_moisture_pct",
        "min_ph", "max_ph", 
        "min_light_lux", "max_light_lux"
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    unique_crops = df.drop_duplicates(subset=["crop_id"]).copy()

    # 3. Environmental Threshold Verification
    unique_crops["temp_ok"] = unique_crops.apply(
        lambda r: (pd.notna(r["min_opt_temp"]) and pd.notna(r["max_opt_temp"])) and 
              (r["min_opt_temp"] <= float(inputs["temperature"]) <= r["max_opt_temp"]),
        axis=1,
    )
    unique_crops["moisture_ok"] = unique_crops.apply(
        lambda r: (pd.notna(r["min_soil_moisture_pct"]) and pd.notna(r["max_soil_moisture_pct"])) and
              (r["min_soil_moisture_pct"] <= float(inputs["soil_moisture"]) <= r["max_soil_moisture_pct"]),
        axis=1,
    )
    unique_crops["ph_ok"] = unique_crops.apply(
        lambda r: (pd.notna(r["min_ph"]) and pd.notna(r["max_ph"])) and
              (r["min_ph"] <= float(inputs["ph"]) <= r["max_ph"]),
        axis=1
    )

    # Light Lux check if available, otherwise default True
    unique_crops["lux_ok"] = unique_crops.apply(
        lambda r: True if (pd.isna(r["min_light_lux"]) or pd.isna(r["max_light_lux"])) else 
              (r["min_light_lux"] <= float(inputs["light_lux"]) <= r["max_light_lux"]),
        axis=1,
    )

    # 4. Disaster Circuit Breaker Override Check
    disaster_override = False
    if live_climate and (
        live_climate["cyclone_warning"] or live_climate["risk_level"] == "EXTREME"
    ):
        disaster_override = True

    # Penalize crops sensitive to waterlogging under severe rain forecasts
    if disaster_override:

        def calc_disaster_score(r):
            base = (
                int(r["temp_ok"])
                + int(r["moisture_ok"])
                + int(r["ph_ok"])
                + int(r["lux_ok"])
            )
            if (
                str(r["waterlogging_tolerance"]).strip().lower()
                in ["low", "none", "sensitive"]
            ):
                return base - 2  # Demote score for vulnerable crops
            return base + 1  # Boost score for resilient crops

        unique_crops["final_score"] = unique_crops.apply(
            calc_disaster_score, axis=1
        )
    else:
        unique_crops["final_score"] = unique_crops[
            ["temp_ok", "moisture_ok", "ph_ok", "lux_ok"]
        ].sum(axis=1)

    # Sort crops by highest evaluation score, then highest observed yield
    ranked_crops = unique_crops.sort_values(
        by=["final_score", "observed_yield_mt_ha"], ascending=[False, False]
    ).reset_index(drop=True)

    # 5. Preferred Crop Choice Alignment Logic
    top_3 = ranked_crops.iloc[:3].copy()
    preferred_crop_name = inputs["preferred_crop"].strip().lower()

    # Check if preferred crop appears in top 3 choices
    match_in_top_3 = top_3[
        top_3["crop_name"].str.strip().str.lower().str.contains(preferred_crop_name , na=False)
    ]

    final_display_list = []

    if not match_in_top_3.empty:
        # Preferred crop is already in the top 3, keep ranking as usual
        final_display_list = ranked_crops.head(3).to_dict("records")
    else:
        # Preferred crop is not in top 3; fetch it from full list or keep top 3 + 4th slot
        preferred_match = ranked_crops[
            ranked_crops["crop_name"].str.strip().str.lower().str.contains(preferred_crop_name , na=False)
        ]

        final_display_list = top_3.to_dict("records")

        if not preferred_match.empty:
            preferred_record = preferred_match.iloc[0].to_dict()
            preferred_record["is_user_choice_override"] = True
            final_display_list.append(preferred_record)
        else:
            print(
                f"\n⚠️ Note: User choice '{preferred_crop_name}' not found in database records. Showing top 3 regional recommendations."
            )

    # 6. Terminal Output Payload
    print(
        "\n=========================================================================="
    )
    print(
        f"      🌾 KHETSAARTHI ADVISORY REPORT FOR: {inputs['farmer_name'].upper()} 🌾"
    )
    print(
        "=========================================================================="
    )
    print(
        f"📍 Location Coordinates : {inputs['lat']}, {inputs['lon']} ({inputs['location_id']})"
    )
    print(
        f"🧪 Measured Parameters  : Temp: {inputs['temperature']}°C | Soil Moisture: {inputs['soil_moisture']}% | pH: {inputs['ph']}"
    )

    if live_climate:
        print(
            f"📡 Live 16-Day Forecast : Avg Temp: {live_climate['avg_temp']}°C | Total Rain: {live_climate['total_rain']}mm"
        )
        print(
            f"🚨 Weather Risk Level   : {live_climate['risk_level']} (Max 1-Day Rain: {live_climate['max_daily_rain']}mm)"
        )

    if disaster_override:
        print(
            "\n🚨🚨 CRITICAL WEATHER WARNING: CYCLONE / HEAVY DOWNPOUR PREDICTED 🚨🚨"
        )
        print("⚡ Waterlogging-sensitive crops have been demoted for safety.")

    print(
        "--------------------------------------------------------------------------\n"
    )

    for idx, item in enumerate(final_display_list, 1):
        cid = item["crop_id"]
        crop_rows = df[df["crop_id"] == cid]

        # Formatting position labels
        is_choice = item.get("is_user_choice_override", False)
        pos_label = (
            f"[{idx}] (FARMER PREFERRED CHOICE)" if is_choice else f"[{idx}]"
        )

        # Recommendation status tag
        if is_choice:
            status_tag = "📌 USER CHOICE (PLACED AT POSITION 4)"
        elif item["final_score"] >= 3:
            status_tag = "✅ HIGHLY RECOMMENDED"
        elif item["final_score"] == 2:
            status_tag = "⚠️ MODERATELY SUITABLE"
        else:
            status_tag = "❌ HIGH RISK / NOT RECOMMENDED"

        print(f"{pos_label} {item['crop_name']} ({cid}) — Status: {status_tag}")
        print(
            f"    • Evaluation Score : {item['final_score']}/4 (Temp: {item['temp_ok']} | Moisture: {item['moisture_ok']} | pH: {item['ph_ok']})"
        )
        print(
            f"    • Waterlog Safety  : {item['waterlogging_tolerance']} Tolerance"
        )
        print(
            f"    • Expected Yield   : {item['observed_yield_mt_ha']} MT/Ha"
        )
        print(
            f"    • Irrigation Plan  : {item['primary_irrigation_method']}"
        )

        fert_info = (
            crop_rows[["fertilizer_type", "fert_dose"]].dropna().drop_duplicates()
        )
        if not fert_info.empty:
            f_row = fert_info.iloc[0]
            print(
                f"    • Recommended Fert : {f_row['fertilizer_type']} ({f_row['fert_dose']})"
            )

        pest_info = (
            crop_rows[["disease", "pesticide_type"]].dropna().drop_duplicates()
        )
        if not pest_info.empty:
            p_row = pest_info.iloc[0]
            print(
                f"    • Disease Control   : Target: {p_row['disease']} | Chemical: {p_row['pesticide_type']}"
            )

        print("")


if __name__ == "__main__":
    run_recommendation_engine()