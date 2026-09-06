import os
import requests
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
# ---------- SETUP ----------
load_dotenv()  # reads keys from .env file
app = Flask(__name__)
CORS(app)  # allows your frontend (different origin) to call this backend
# Load crop dataset once when server starts
df = pd.read_csv("data/crop_data.csv")
# Load farming knowledge base once when server starts
with open("data/farming_guides.txt", "r", encoding="utf-8") as f:
    knowledge_base = f.read()
# Configure Gemini AI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")
# ---------- ROUTE 1: Health check ----------
@app.route("/")
def home():
    return "KhetSaarthi backend is running!"
# ---------- ROUTE 2: Crop Recommendation ----------
@app.route("/recommend-crop", methods=["POST"])
def recommend_crop():
    data = request.json
    region = data.get("region")
    soil = data.get("soil")
    budget = float(data.get("budget", 0))
    filtered = df[
        (df["Region"].str.lower() == region.lower()) &
        (df["SoilType"].str.lower() == soil.lower()) &
        (df["AvgCostPerAcre"] <= budget)
    ]
    filtered = filtered.sort_values(by="AvgProfitPerAcre", ascending=False)
    top5 = filtered.head(5).to_dict(orient="records")
    if not top5:
        return jsonify({
            "recommendations": [],
            "message": "No exact match found. Try a different soil type, region, or higher budget."
        })
    return jsonify({"recommendations": top5})
# ---------- ROUTE 3: AI Farming Plan ----------
@app.route("/farming-plan", methods=["POST"])
def farming_plan():
    data = request.json
    crop = data.get("crop")
    prompt = f"""You are an agricultural expert helping an Indian farmer.
Using this reference knowledge:
{knowledge_base}
Give a simple, step-by-step farming plan for growing {crop} in India,
covering: land preparation, sowing, irrigation, fertilizer/pesticide use,
disease management, and harvesting. Use simple language a farmer can
understand. Use short numbered steps, not long paragraphs."""
    try:
        response = model.generate_content(prompt)
        return jsonify({"plan": response.text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ---------- ROUTE 4: Weather Risk Alert ----------
@app.route("/weather-alert", methods=["POST"])
def weather_alert():
    data = request.json
    city = data.get("city")
    api_key = os.getenv("WEATHER_API_KEY")
    url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={api_key}&units=metric"

    try:
        res = requests.get(url, timeout=10).json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if res.get("cod") != "200":
        return jsonify({"error": res.get("message", "City not found")}), 400

    alerts = []
    for entry in res.get("list", [])[:8]:  # next ~24 hours (3-hour steps)
        rain = entry.get("rain", {}).get("3h", 0)
        temp = entry["main"]["temp"]
        if rain > 10:
            alerts.append("Heavy rainfall expected — risk of flooding/waterlogging")
        if temp > 40:
            alerts.append("Heatwave warning — protect crops and irrigate")
        if temp < 5:
            alerts.append("Cold wave warning — risk of frost damage")

    unique_alerts = list(set(alerts)) or ["No major risk detected in the next 24 hours"]
    return jsonify({"alerts": unique_alerts})


# ---------- RUN SERVER ----------
if __name__ == "__main__":
    app.run(debug=True, port=5000)