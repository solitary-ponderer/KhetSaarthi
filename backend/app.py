import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from typing import Optional


# ============================================================
# 1. DATABASE CONNECTION
# ============================================================

DB_URL = "postgresql://postgres:12345@127.0.0.1:5432/khetsaarthi_db"
engine = create_engine(DB_URL)


app = FastAPI(title="KhetSaarthi Real-Time Backend API")


# Allow the farmer frontend to read live ESP32 data.
# For the hackathon demo the frontend may be served locally or from Vercel.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 2. LATEST ESP32 TELEMETRY
# ============================================================

latest_telemetry = {
    "temperature": 28.0,
    "humidity": 65.0,
    "soil_moisture": 48.0,
    "soil_temperature": 26.0,
    "pressure": 1013.25,
    "light_lux": 45000.0,
}


# ============================================================
# 3. DATA MODELS
# ============================================================

class ESP32Telemetry(BaseModel):
    temperature: float
    humidity: float
    soil_moisture: float
    soil_temperature: float
    pressure: float
    light_lux: float


class AdvisoryRequest(BaseModel):
    farmer_name: Optional[str] = "Farmer"
    region_id: Optional[str] = "REG-WB-001"
    location_id: Optional[str] = "LOC-WB-PM-001"
    lat: Optional[float] = 22.5726
    lon: Optional[float] = 88.3639
    preferred_crop: Optional[str] = "Rice"


# ============================================================
# 4. ESP32 SENSOR DATA ENDPOINT
# ============================================================

@app.post("/api/sensor-data")
async def receive_sensor_data(data: ESP32Telemetry):
    """Endpoint for ESP32 to push continuous sensor metrics."""

    global latest_telemetry

    latest_telemetry = data.model_dump()

    print(f"📡 Real-time Telemetry Received: {latest_telemetry}")

    return {
        "status": "success",
        "data": latest_telemetry
    }


@app.get("/api/sensor-data")
async def get_sensor_data():
    """Return the latest ESP32 reading to the farmer frontend."""

    return {
        "status": "success",
        "data": latest_telemetry
    }


# ============================================================
# 5. LIVE WEATHER API
# ============================================================

def sync_live_climate_api(lat, lon, region_id, location_id):
    """Fetches real-time 16-day forecast from Open-Meteo API."""

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min,"
        f"temperature_2m_mean,precipitation_sum,wind_speed_10m_max"
        f"&timezone=auto"
    )

    try:
        res = requests.get(url, timeout=6)
        daily = res.json()["daily"]

        avg_temp = round(
            sum(daily["temperature_2m_mean"])
            / len(daily["temperature_2m_mean"]),
            2
        )

        max_temp = round(max(daily["temperature_2m_max"]), 2)
        min_temp = round(min(daily["temperature_2m_min"]), 2)

        total_rain = round(
            sum(daily["precipitation_sum"]),
            2
        )

        max_daily_rain = round(
            max(daily["precipitation_sum"]),
            2
        )

        max_wind_speed = round(
            max(daily["wind_speed_10m_max"]),
            2
        )

        heavy_rain_days = sum(
            1 for p in daily["precipitation_sum"]
            if p >= 30.0
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
                region_id,
                location_id,
                latitude,
                longitude,
                forecast_days,
                avg_predicted_temp_c,
                max_predicted_temp_c,
                min_predicted_temp_c,
                total_predicted_rain_mm,
                max_single_day_rain_mm,
                heavy_rain_days,
                cyclone_warning,
                disaster_risk_level,
                fetched_at
            )
            VALUES (
                :region_id,
                :location_id,
                :lat,
                :lon,
                16,
                :avg_temp,
                :max_temp,
                :min_temp,
                :total_rain,
                :max_daily_rain,
                :heavy_rain,
                :cyclone,
                :risk_level,
                NOW()
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
                }
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
            f"\n⚠️ Live Weather API Connection Failed ({e}). "
            f"Proceeding with historical database tables."
        )
        return None


# ============================================================
# 6. DATABASE KNOWLEDGE
# ============================================================

def fetch_database_knowledge(region_id):
    """Executes multi-table SQL join across agricultural knowledge tables."""

    query = text("""
        SELECT
            cm.crop_id,
            cm.crop_name,

            cr.min_opt_temp,
            cr.max_opt_temp,

            cr."min_soil_moisture_%" AS min_soil_moisture_pct,
            cr."max_soil_moisture_%" AS max_soil_moisture_pct,

            cr."min_humidity_%" AS min_humidity_pct,
            cr."max_humidity_%" AS max_humidity_pct,

            cr.waterlogging_tolerance,
            cr.min_light_lux,
            cr.max_light_lux,

            rc.suitability,
            yp.observed_yield_mt_ha,
            i.primary_irrigation_method,

            f.fertilizer_type,
            f.recommended_dose AS fert_dose,

            p.disease,
            p.pesticide_type,
            p.recommended_dose AS pest_dose,

            ins.insect_pest,
            ins.insecticide_type,
            ins.recommended_dose AS insect_dose,

            r.primary_risk,
            r.risk_level,
            l.loss_percentage

        FROM "crop_knowledge_(1)_crop_master" cm

        JOIN "crop_knowledge_(1)_crop_requirements" cr
            ON cm.crop_id = cr.crop_id

        LEFT JOIN "regional_crop_regional_crop" rc
            ON cm.crop_id = rc.crop_id
            AND rc.region_id = :region_id

        LEFT JOIN "regional_crop_yield_performance" yp
            ON cm.crop_id = yp.crop_id
            AND yp.region_id = :region_id

        LEFT JOIN "regional_crop_regional_irrigation" i
            ON cm.crop_id = i.crop_id
            AND i.region_id = :region_id

        LEFT JOIN "agricultural_input_fertilizers" f
            ON cm.crop_id = f.crop_id

        LEFT JOIN "agricultural_input_presticides" p
            ON cm.crop_id = p.crop_id

        LEFT JOIN "agricultural_input_insecticides" ins
            ON cm.crop_id = ins.crop_id

        LEFT JOIN "regional_crop_regional_crop_risk" r
            ON cm.crop_id = r.crop_id
            AND r.region_id = :region_id

        LEFT JOIN "regional_crop_post_harvest_loss" l
            ON cm.crop_id = l.crop_id
            AND l.region_id = :region_id
    """)

    with engine.connect() as conn:
        df = pd.read_sql(
            query,
            conn,
            params={"region_id": region_id}
        )

    return df


# ============================================================
# 7. RECOMMENDATION ENGINE
# ============================================================

@app.post("/api/run-advisory")
def run_recommendation_engine(request: AdvisoryRequest):
    """Combines live ESP32 telemetry with frontend metadata."""

    inputs = {
        "farmer_name": request.farmer_name,
        "region_id": request.region_id,
        "location_id": request.location_id,
        "lat": request.lat,
        "lon": request.lon,

        # ESP32 readings
        "temperature": latest_telemetry["temperature"],
        "humidity": latest_telemetry["humidity"],
        "soil_moisture": latest_telemetry["soil_moisture"],
        "soil_temperature": latest_telemetry["soil_temperature"],
        "pressure": latest_telemetry["pressure"],
        "light_lux": latest_telemetry["light_lux"],

        "preferred_crop": request.preferred_crop,
    }


    # --------------------------------------------------------
    # Live Climate
    # --------------------------------------------------------

    live_climate = sync_live_climate_api(
        inputs["lat"],
        inputs["lon"],
        inputs["region_id"],
        inputs["location_id"],
    )


    # --------------------------------------------------------
    # Database
    # --------------------------------------------------------

    df = fetch_database_knowledge(inputs["region_id"])

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No matching records for region {inputs['region_id']}"
        )


    # --------------------------------------------------------
    # Convert Numeric Columns
    # --------------------------------------------------------

    numeric_cols = [
        "min_opt_temp",
        "max_opt_temp",
        "min_soil_moisture_pct",
        "max_soil_moisture_pct",
        "min_humidity_pct",
        "max_humidity_pct",
        "min_light_lux",
        "max_light_lux"
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col],
                errors="coerce"
            )


    unique_crops = df.drop_duplicates(
        subset=["crop_id"]
    ).copy()


    # --------------------------------------------------------
    # Environmental Checks
    # --------------------------------------------------------

    unique_crops["temp_ok"] = unique_crops.apply(
        lambda r:
            (
                pd.notna(r["min_opt_temp"])
                and pd.notna(r["max_opt_temp"])
                and
                (
                    r["min_opt_temp"]
                    <= float(inputs["temperature"])
                    <= r["max_opt_temp"]
                )
            ),
        axis=1
    )


    unique_crops["moisture_ok"] = unique_crops.apply(
        lambda r:
            (
                pd.notna(r["min_soil_moisture_pct"])
                and pd.notna(r["max_soil_moisture_pct"])
                and
                (
                    r["min_soil_moisture_pct"]
                    <= float(inputs["soil_moisture"])
                    <= r["max_soil_moisture_pct"]
                )
            ),
        axis=1
    )


    unique_crops["humidity_ok"] = unique_crops.apply(
        lambda r:
            (
                pd.notna(r["min_humidity_pct"])
                and pd.notna(r["max_humidity_pct"])
                and
                (
                    r["min_humidity_pct"]
                    <= float(inputs["humidity"])
                    <= r["max_humidity_pct"]
                )
            ),
        axis=1
    )


    unique_crops["lux_ok"] = unique_crops.apply(
        lambda r:
            True
            if (
                pd.isna(r["min_light_lux"])
                or pd.isna(r["max_light_lux"])
            )
            else (
                r["min_light_lux"]
                <= float(inputs["light_lux"])
                <= r["max_light_lux"]
            ),
        axis=1
    )


    # --------------------------------------------------------
    # Disaster Override
    # --------------------------------------------------------

    disaster_override = False

    if live_climate and (
        live_climate["cyclone_warning"]
        or live_climate["risk_level"] == "EXTREME"
    ):
        disaster_override = True


    if disaster_override:

        def calc_disaster_score(r):

            base = (
                int(r["temp_ok"])
                + int(r["moisture_ok"])
                + int(r["humidity_ok"])
                + int(r["lux_ok"])
            )

            if (
                str(r["waterlogging_tolerance"])
                .strip()
                .lower()
                in ["low", "none", "sensitive"]
            ):
                return base - 2

            return base + 1


        unique_crops["final_score"] = unique_crops.apply(
            calc_disaster_score,
            axis=1
        )

    else:

        unique_crops["final_score"] = unique_crops[
            [
                "temp_ok",
                "moisture_ok",
                "humidity_ok",
                "lux_ok"
            ]
        ].sum(axis=1)


    # --------------------------------------------------------
    # Rank Crops
    # --------------------------------------------------------

    ranked_crops = unique_crops.sort_values(
        by=[
            "final_score",
            "observed_yield_mt_ha"
        ],
        ascending=[
            False,
            False
        ]
    ).reset_index(drop=True)


    top_3 = ranked_crops.iloc[:3].copy()

    preferred_crop_name = (
        inputs["preferred_crop"].strip().lower()
    )


    match_in_top_3 = top_3[
        top_3["crop_name"]
        .str.strip()
        .str.lower()
        .str.contains(
            preferred_crop_name,
            na=False
        )
    ]


    final_display_list = []


    if not match_in_top_3.empty or not preferred_crop_name:

        final_display_list = (
            ranked_crops
            .head(3)
            .to_dict("records")
        )

    else:

        preferred_match = ranked_crops[
            ranked_crops["crop_name"]
            .str.strip()
            .str.lower()
            .str.contains(
                preferred_crop_name,
                na=False
            )
        ]

        final_display_list = (
            top_3
            .to_dict("records")
        )

        if not preferred_match.empty:

            preferred_record = (
                preferred_match
                .iloc[0]
                .to_dict()
            )

            preferred_record[
                "is_user_choice_override"
            ] = True

            final_display_list.append(
                preferred_record
            )


    # ========================================================
    # 8. TERMINAL REPORT
    # ========================================================

    print(
        "\n=========================================================================="
    )

    print(
        f"      🌾 KHETSAARTHI ADVISORY REPORT FOR: "
        f"{inputs['farmer_name'].upper()} 🌾"
    )

    print(
        "=========================================================================="
    )

    print(
        f"📍 Location Coordinates : "
        f"{inputs['lat']}, {inputs['lon']} "
        f"({inputs['location_id']})"
    )

    print(
        f"🌡️ Air Temperature      : "
        f"{inputs['temperature']}°C"
    )

    print(
        f"💧 Air Humidity         : "
        f"{inputs['humidity']}%"
    )

    print(
        f"🌱 Soil Moisture        : "
        f"{inputs['soil_moisture']}%"
    )

    print(
        f"🌡️ Soil Temperature     : "
        f"{inputs['soil_temperature']}°C"
    )

    print(
        f"📊 Atmospheric Pressure : "
        f"{inputs['pressure']} hPa"
    )

    print(
        f"☀️ Light Intensity      : "
        f"{inputs['light_lux']} Lux"
    )


    if live_climate:

        print(
            f"📡 Live 16-Day Forecast : "
            f"Avg Temp: {live_climate['avg_temp']}°C | "
            f"Total Rain: {live_climate['total_rain']}mm"
        )

        print(
            f"🚨 Weather Risk Level   : "
            f"{live_climate['risk_level']} "
            f"(Max 1-Day Rain: "
            f"{live_climate['max_daily_rain']}mm)"
        )


    print(
        "--------------------------------------------------------------------------\n"
    )


    # ========================================================
    # 9. RECOMMENDATION OUTPUT
    # ========================================================

    report_output = []


    for idx, item in enumerate(
        final_display_list,
        1
    ):

        cid = item["crop_id"]

        crop_rows = df[
            df["crop_id"] == cid
        ]


        is_choice = item.get(
            "is_user_choice_override",
            False
        )

        pos_label = (
            f"[{idx}] (FARMER PREFERRED CHOICE)"
            if is_choice
            else f"[{idx}]"
        )


        if is_choice:

            status_tag = (
                "📌 USER CHOICE "
                "(PLACED AT POSITION 4)"
            )

        elif item["final_score"] >= 3:

            status_tag = (
                "✅ HIGHLY RECOMMENDED"
            )

        elif item["final_score"] == 2:

            status_tag = (
                "⚠️ MODERATELY SUITABLE"
            )

        else:

            status_tag = (
                "❌ HIGH RISK / NOT RECOMMENDED"
            )


        print(
            f"{pos_label} "
            f"{item['crop_name']} "
            f"({cid}) - Status: {status_tag}"
        )


        print(
            f"    • Evaluation Score : "
            f"{item['final_score']}/4 "
            f"(Temp: {item['temp_ok']} | "
            f"Moisture: {item['moisture_ok']} | "
            f"Humidity: {item['humidity_ok']} | "
            f"Lux: {item['lux_ok']})"
        )


        print(
            f"    • Waterlog Safety  : "
            f"{item['waterlogging_tolerance']} Tolerance"
        )


        print(
            f"    • Expected Yield   : "
            f"{item['observed_yield_mt_ha']} MT/Ha"
        )


        print(
            f"    • Irrigation Plan  : "
            f"{item['primary_irrigation_method']}"
        )


        # ----------------------------------------------------
        # Fertilizer
        # ----------------------------------------------------

        fert_info = crop_rows[
            [
                "fertilizer_type",
                "fert_dose"
            ]
        ].dropna().drop_duplicates()


        if not fert_info.empty:

            fert_str = (
                f"{fert_info.iloc[0]['fertilizer_type']} "
                f"({fert_info.iloc[0]['fert_dose']})"
            )

        else:

            fert_str = "N/A"


        if not fert_info.empty:

            print(
                f"    • Recommended Fert : "
                f"{fert_str}"
            )


        # ----------------------------------------------------
        # Disease Control
        # ----------------------------------------------------

        pest_info = crop_rows[
            [
                "disease",
                "pesticide_type"
            ]
        ].dropna().drop_duplicates()


        if not pest_info.empty:

            p_row = pest_info.iloc[0]

            print(
                f"    • Disease Control   : "
                f"Target: {p_row['disease']} | "
                f"Chemical: {p_row['pesticide_type']}"
            )


        print("")


        report_output.append(
            {
                "crop_id": cid,
                "crop_name": item["crop_name"],
                "status": status_tag,
                "score": item["final_score"],
                "expected_yield": item[
                    "observed_yield_mt_ha"
                ],
                "irrigation": item[
                    "primary_irrigation_method"
                ],
                "fertilizer": fert_str
            }
        )


    # ========================================================
    # 10. API RESPONSE
    # ========================================================

    return {
        "status": "success",
        "inputs_used": inputs,
        "recommendations": report_output
    }