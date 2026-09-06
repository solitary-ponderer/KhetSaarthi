// ===== KhetSaarthi shared script — map pin interactivity =====
const STATE_CROPS = {
  "Punjab": ["Wheat", "Rice", "Cotton", "Sugarcane", "Maize"],
  "Uttar Pradesh": ["Sugarcane", "Wheat", "Rice", "Potato"],
  "Gujarat": ["Groundnut", "Cotton", "Sugarcane", "Wheat"],
  "Madhya Pradesh": ["Soybean", "Wheat", "Gram"],
  "Maharashtra": ["Sugarcane", "Cotton", "Soybean", "Onion", "Tomato"],
  "West Bengal": ["Rice", "Jute", "Potato"],
  "Karnataka": ["Ragi", "Maize", "Sugarcane"],
  "Andhra Pradesh": ["Chilli", "Rice", "Groundnut"]
};

document.querySelectorAll(".pin").forEach(pin => {
  pin.addEventListener("click", () => {
    const state = pin.dataset.state;
    const crops = STATE_CROPS[state] || [];
    const info = document.getElementById("mapInfo");
    if (!info) return;
    info.classList.remove("hidden");
    info.innerHTML = `<strong>${state}</strong> — top staple crops: ${crops.join(", ")}`;
  });
});