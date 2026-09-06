// ===== KhetSaarthi — Farmer dashboard logic =====
const BASE_URL = "http://127.0.0.1:5000"; // change to your deployed backend URL later
const STATE_CROPS = {
  "Punjab": ["Wheat", "Rice", "Cotton", "Sugarcane", "Maize"],
  "Haryana": ["Wheat", "Rice", "Mustard", "Cotton"],
  "Uttar Pradesh": ["Sugarcane", "Wheat", "Rice", "Potato"],
  "Maharashtra": ["Sugarcane", "Cotton", "Soybean", "Onion", "Tomato"],
  "Gujarat": ["Groundnut", "Cotton", "Sugarcane", "Wheat"],
  "West Bengal": ["Rice", "Jute", "Potato"],
  "Andhra Pradesh": ["Chilli", "Rice", "Groundnut"],
  "Karnataka": ["Ragi", "Maize", "Sugarcane"],
  "Madhya Pradesh": ["Soybean", "Wheat", "Gram"]
};
// Rough state center coordinates for client-side nearest-state matching
// (no external geocoding API/key required)
const STATE_CENTERS = {
  "Punjab": [31.1, 75.3], "Haryana": [29.1, 76.1], "Uttar Pradesh": [26.8, 80.9],
  "Maharashtra": [19.7, 75.7], "Gujarat": [22.2, 71.5], "West Bengal": [22.9, 87.9],
  "Andhra Pradesh": [15.9, 79.7], "Karnataka": [15.3, 75.7], "Madhya Pradesh": [23.5, 78.6]
};
let selectedRegion = "";
let latestResults = [];
let farmerChosenCrop = "";
function show(id) {
  ["locationScreen", "detailsScreen", "loadingScreen", "resultsScreen", "planScreen"].forEach(s => {
    document.getElementById(s).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
  window.scrollTo(0, 0);
}
// ---------- Step 1: Location ----------
const locationStatus = document.getElementById("locationStatus");
const locationContinueBtn = document.getElementById("locationContinueBtn");
const manualRegion = document.getElementById("manualRegion");
document.getElementById("shareLocationBtn").addEventListener("click", () => {
  locationStatus.classList.remove("hidden");
  locationStatus.textContent = "Detecting your location...";
  if (!navigator.geolocation) {
    locationStatus.textContent = "Location not supported on this device — please type it below.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      let nearest = null, best = Infinity;
      for (const [state, [lat, lng]] of Object.entries(STATE_CENTERS)) {
        const d = (lat - latitude) ** 2 + (lng - longitude) ** 2;
        if (d < best) { best = d; nearest = state; }
      }
      selectedRegion = nearest;
      locationStatus.textContent = `Detected region: ${nearest}`;
      locationContinueBtn.disabled = false;
    },
    () => { locationStatus.textContent = "Could not detect location — please type it below instead."; }
  );
});
manualRegion.addEventListener("input", () => {
  selectedRegion = manualRegion.value.trim();
  locationContinueBtn.disabled = !selectedRegion;
});
locationContinueBtn.addEventListener("click", () => {
  const cropSelect = document.getElementById("cropVariety");
  const list = STATE_CROPS[selectedRegion] || ["Wheat", "Rice", "Maize"];
  cropSelect.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join("");
  show("detailsScreen");
});
// ---------- Step 2: Prepare plan ----------
document.getElementById("preparePlanBtn").addEventListener("click", async () => {
  farmerChosenCrop = document.getElementById("cropVariety").value;
  const soil = document.getElementById("soilType").value.trim();
  const budget = document.getElementById("budgetInput").value.trim();
  if (!soil || !budget) { alert("Please fill in soil type and budget."); return; }
  show("loadingScreen");
  try {
    const res = await fetch(`${BASE_URL}/recommend-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: selectedRegion, soil, budget })
    });
    const data = await res.json();
    latestResults = data.recommendations || [];
    renderResults();
    show("resultsScreen");
  } catch (err) {
    show("detailsScreen");
    alert("Could not reach the backend. Please check app.py is running.");
  }
});
// ---------- Step 3: Results + stars ----------
function starsFor(index) {
  if (index === 0) return { stars: "★★★", tag: "Best match" };
  if (index <= 2) return { stars: "★★☆", tag: "Better match" };
  return { stars: "★☆☆", tag: "Good match" };
}
function renderResults() {
  const list = document.getElementById("resultsList");
  const notIdealBox = document.getElementById("notIdealBox");
  const whyBtn = document.getElementById("whyNotIdealBtn");
  const whyDetail = document.getElementById("whyNotIdealDetail");
  if (latestResults.length === 0) {
    list.innerHTML = `<p class="error-text">No matching crops found for these conditions.</p>`;
    notIdealBox.classList.remove("hidden");
    whyBtn.classList.add("hidden");
    whyDetail.classList.remove("hidden");
    whyDetail.innerHTML = `Your selected crop (${farmerChosenCrop}) didn't match under your current region/soil/budget.
      Try connecting your field device below for a more accurate soil reading, or adjust your budget.`;
    return;
  }
  list.innerHTML = latestResults.map((c, i) => {
    const { stars, tag } = starsFor(i);
    return `<div class="crop-card ${i === 0 ? "top-pick" : ""}">
      <div class="crop-card-head">
        <span class="crop-card-name">${c.Crop}</span>
        <span class="stars">${stars}</span>
      </div>
      <span class="crop-tag">${tag}</span>
      <div class="crop-card-meta">Cost ₹${c.AvgCostPerAcre}/acre · Profit ₹${c.AvgProfitPerAcre}/acre · Risk: ${c.RiskLevel}</div>
    </div>`;
  }).join("");
  const chosenIndex = latestResults.findIndex(c => c.Crop.toLowerCase() === farmerChosenCrop.toLowerCase());
  if (chosenIndex > 0) {
    notIdealBox.classList.remove("hidden");
    whyBtn.classList.remove("hidden");
    const top = latestResults[0], mine = latestResults[chosenIndex];
    whyDetail.innerHTML = `<strong>${mine.Crop}</strong> ranks #${chosenIndex + 1} for your conditions — ${top.Crop} offers
      ${top.AvgProfitPerAcre > mine.AvgProfitPerAcre ? "higher expected profit" : "lower risk"}
      (₹${top.AvgProfitPerAcre}/acre profit vs ₹${mine.AvgProfitPerAcre}/acre, risk: ${top.RiskLevel} vs ${mine.RiskLevel}).`;
  } else if (chosenIndex === -1) {
    notIdealBox.classList.remove("hidden");
    whyBtn.classList.remove("hidden");
    whyDetail.innerHTML = `<strong>${farmerChosenCrop}</strong> wasn't feasible under your current budget/soil for this region.
      The list above performs best instead — or connect your field device below for a more precise reading.`;
  } else {
    notIdealBox.classList.add("hidden");
  }
}
document.getElementById("whyNotIdealBtn").addEventListener("click", () => {
  document.getElementById("whyNotIdealDetail").classList.toggle("hidden");
});
// ---------- Step 4: Plan ----------
document.getElementById("viewPlanBtn").addEventListener("click", () => {
  const planSelect = document.getElementById("planCropSelect");
  planSelect.innerHTML = latestResults.map(c => `<option value="${c.Crop}">${c.Crop}</option>`).join("");
  show("planScreen");
});

document.getElementById("proceedCropBtn").addEventListener("click", async () => {
  const crop = document.getElementById("planCropSelect").value;
  const box = document.getElementById("planResult");
  box.classList.remove("hidden");
  box.textContent = "Generating your step-by-step plan...";

  try {
    const res = await fetch(`${BASE_URL}/farming-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop })
    });
    const data = await res.json();
    box.textContent = data.plan || data.error || "Something went wrong.";
  } catch (err) {
    box.innerHTML = `<span class="error-text">Could not reach the backend.</span>`;
  }
});

// ---------- Hardware connect (UI stub — wire to real ESP32 pairing later) ----------
document.getElementById("connectDeviceBtn").addEventListener("click", () => {
  const status = document.getElementById("deviceStatus");
  status.classList.remove("hidden");
  status.textContent = "Scanning nearby devices...";
  setTimeout(() => {
    status.textContent = "No paired device found — using regional database estimates for now.";
  }, 1800);
});