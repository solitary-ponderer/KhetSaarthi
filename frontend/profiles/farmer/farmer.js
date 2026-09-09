document.addEventListener("DOMContentLoaded", () => {


    /* =========================================================
       SUPPORTED LOCATIONS
    ========================================================= */

    const supportedLocations = [

        {
            locationId: "LOC-WB-PM-001",
            state: "West Bengal",
            district: "Paschim Medinipur",
            block: "Garhbeta I",
            village: "Amgari",
            regionId: "REG-WB-001",
            latitude: 22.8465,
            longitude: 87.3700
        },

        {
            locationId: "LOC-WB-PB-001",
            state: "West Bengal",
            district: "Purba Burdhaman",
            block: "Memari II",
            village: "Paharahati",
            regionId: "REG-WB-002",
            latitude: 23.2431,
            longitude: 88.0992
        },

        {
            locationId: "LOC-WB-JA-001",
            state: "West Bengal",
            district: "Jalpaiguri",
            block: "Dhupguri",
            village: "Dakshin Altagram",
            regionId: "REG-WB-003",
            latitude: 26.6081,
            longitude: 88.9467
        }

    ];


    /* =========================================================
       MANUAL LOCATION DATA
    ========================================================= */

    const locationHierarchy = {

        "West Bengal": [
            "Paschim Medinipur",
            "Purba Burdhaman",
            "Jalpaiguri"
        ]

    };


    /* =========================================================
       CROP DATA
    ========================================================= */

    const cropData = {

        "Rice (Paddy)": [
            "Swarna",
            "IR64",
            "MTU-1010"
        ],

        "Wheat": [
            "HD 2967",
            "HD 3086",
            "PBW 343"
        ],

        "Maize": [
            "DHM 117",
            "PMH 1",
            "HQPM 1"
        ],

        "Chickpea (Gram)": [
            "JG 11",
            "Pusa 372",
            "BG 256"
        ],

        "Lentil (Masur)": [
            "PL 406",
            "IPL 316",
            "Pusa Vaibhav"
        ],

        "Green Gram (Moong)": [
            "Pusa Vishal",
            "Pusa Baisakhi",
            "SML 668"
        ],

        "Black Gram (Urad)": [
            "PU 31",
            "T-9",
            "Pant U-19"
        ],

        "Mustard": [
            "Varuna",
            "Pusa Bold",
            "Pusa Jai Kisan"
        ],

        "Potato": [
            "Jyoti",
            "Kufri Chandramukhi",
            "Kufri Pukhraj"
        ],

        "Tomato": [
            "Pusa Ruby",
            "Arka Vikas",
            "Arka Rakshak"
        ],

        "Onion": [
            "N-53",
            "Pusa Red",
            "Agrifound Light Red"
        ],

        "Brinjal (Eggplant)": [
            "Pusa Purple Long",
            "Pusa Hybrid 5",
            "Arka Nidhi"
        ],

        "Cabbage": [
            "Golden Acre",
            "Pusa Drum Head",
            "Pride of India"
        ],

        "Cauliflower": [
            "Pusa Snowball",
            "Pusa Sharad",
            "Pusa Hybrid 2"
        ],

        "Sugarcane": [
            "Co 0238",
            "Co 86032",
            "Co 0118"
        ],

        "Jute": [
            "JRO 524",
            "JRO 204",
            "JRC 321"
        ],

        "Chilli": [
            "Pusa Jwala",
            "Byadgi",
            "Arka Lohit"
        ]

    };


    /* =========================================================
       ELEMENTS
    ========================================================= */

    const screens =
        document.querySelectorAll(".farmer-screen");

    const allowLocationBtn =
        document.getElementById("allow-location");

    const manualLocationBtn =
        document.getElementById("manual-location-btn");

    const backToLocationBtn =
        document.getElementById("back-to-location");

    const continueFoundBtn =
        document.getElementById("continue-found");

    const continueManualBtn =
        document.getElementById("continue-manual");

    const continueFarmDetailsBtn =
        document.getElementById("continue-farm-details");

    const continueNextBtn =
        document.getElementById("continue-next");

    const stateSelect =
        document.getElementById("state-select");

    const districtSelect =
        document.getElementById("district-select");

    const detectedPlaceName =
        document.getElementById("detected-place-name");

    const selectedLocationText =
        document.getElementById("selected-location-text");


    /* =========================================================
       FARM DETAILS ELEMENTS
    ========================================================= */

    const cropSelect =
        document.getElementById("crop-select");

    const varietySelect =
        document.getElementById("variety-select");

    const budgetInput =
        document.getElementById("budget-input");

    const landSizeInput =
        document.getElementById("land-size-input");

    const landUnit =
        document.getElementById("land-unit");

    const irrigationSelect =
        document.getElementById("irrigation-select");

    const harvestMonth =
        document.getElementById("harvest-month");


    /* =========================================================
       SCREEN SWITCHING
    ========================================================= */

    function showScreen(screenId) {

        screens.forEach(screen => {
            screen.classList.remove("active");
        });

        const target =
            document.getElementById(screenId);

        if (target) {

            target.classList.add("active");

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        }

    }


    /* =========================================================
       HAVERSINE DISTANCE
    ========================================================= */

    function calculateDistance(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {

        const earthRadius = 6371;

        const latDifference =
            (latitude2 - latitude1) *
            Math.PI / 180;

        const lonDifference =
            (longitude2 - longitude1) *
            Math.PI / 180;

        const a =
            Math.sin(latDifference / 2) ** 2 +

            Math.cos(
                latitude1 * Math.PI / 180
            ) *

            Math.cos(
                latitude2 * Math.PI / 180
            ) *

            Math.sin(lonDifference / 2) ** 2;

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        return earthRadius * c;

    }


    /* =========================================================
       FIND SUPPORTED LOCATION
    ========================================================= */

    function findSupportedLocation(
        latitude,
        longitude
    ) {

        const MAX_DISTANCE_KM = 5;

        let closestLocation = null;

        let closestDistance = Infinity;

        supportedLocations.forEach(location => {

            const distance =
                calculateDistance(
                    latitude,
                    longitude,
                    location.latitude,
                    location.longitude
                );

            if (distance < closestDistance) {

                closestDistance = distance;

                closestLocation = location;

            }

        });


        if (
            closestLocation &&
            closestDistance <= MAX_DISTANCE_KM
        ) {

            return {
                location: closestLocation,
                distance: closestDistance
            };

        }

        return null;

    }


    /* =========================================================
       REVERSE GEOCODING
    ========================================================= */

    async function getPlaceName(
        latitude,
        longitude
    ) {

        if (!detectedPlaceName) {
            return;
        }

        detectedPlaceName.textContent =
            "Detecting...";

        try {

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    8000
                );

            const response = await fetch(

                `https://api.bigdatacloud.net/data/reverse-geocode-client` +
                `?latitude=${latitude}` +
                `&longitude=${longitude}` +
                `&localityLanguage=en`,

                {
                    method: "GET",
                    signal: controller.signal
                }

            );

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(
                    "Reverse geocoding failed"
                );
            }

            const data =
                await response.json();

            const city =
                data.city ||
                data.locality ||
                data.principalSubdivision ||
                "Unknown location";

            const state =
                data.principalSubdivision ||
                "";

            if (
                city &&
                state &&
                city !== state
            ) {

                detectedPlaceName.textContent =
                    `${city}, ${state}`;

            } else if (state) {

                detectedPlaceName.textContent =
                    state;

            } else {

                detectedPlaceName.textContent =
                    "Location detected";

            }

        } catch (error) {

            console.error(
                "Reverse geocoding error:",
                error
            );

            detectedPlaceName.textContent =
                "Location detected";

        }

    }


    /* =========================================================
       SHOW DETECTED SUPPORTED LOCATION
    ========================================================= */

    function showDetectedLocation(
        location,
        userLatitude,
        userLongitude
    ) {

        document.getElementById(
            "found-state"
        ).textContent =
            location.state;

        document.getElementById(
            "found-district"
        ).textContent =
            location.district;

        document.getElementById(
            "found-block"
        ).textContent =
            location.block;

        document.getElementById(
            "found-village"
        ).textContent =
            location.village;

        document.getElementById(
            "found-coordinates"
        ).textContent =
            `${userLatitude.toFixed(5)}° N, ` +
            `${userLongitude.toFixed(5)}° E`;

        localStorage.setItem(

            "farmerLocation",

            JSON.stringify({

                ...location,

                userLatitude,

                userLongitude,

                source: "gps"

            })

        );

        showScreen(
            "location-found"
        );

    }


    /* =========================================================
       REQUEST LOCATION
    ========================================================= */

    function requestLocation() {

        if (!navigator.geolocation) {

            console.error(
                "Geolocation is not supported by this browser."
            );

            showScreen(
                "manual-location"
            );

            detectedPlaceName.textContent =
                "Location unavailable";

            return;

        }

        showScreen(
            "location-checking"
        );

        navigator.geolocation.getCurrentPosition(

            position => {

                const latitude =
                    position.coords.latitude;

                const longitude =
                    position.coords.longitude;

                const accuracy =
                    position.coords.accuracy;

                console.log(
                    "Latitude:",
                    latitude
                );

                console.log(
                    "Longitude:",
                    longitude
                );

                console.log(
                    "Accuracy:",
                    accuracy,
                    "meters"
                );

                localStorage.setItem(

                    "detectedCoordinates",

                    JSON.stringify({

                        latitude,

                        longitude,

                        accuracy,

                        source: "gps"

                    })

                );

                const match =
                    findSupportedLocation(
                        latitude,
                        longitude
                    );


                if (match) {

                    console.log(
                        "Supported region:",
                        match.location
                    );

                    console.log(
                        "Distance:",
                        match.distance.toFixed(2),
                        "km"
                    );

                    showDetectedLocation(
                        match.location,
                        latitude,
                        longitude
                    );

                } else {

                    console.log(
                        "Location is not supported."
                    );

                    showScreen(
                        "manual-location"
                    );

                    getPlaceName(
                        latitude,
                        longitude
                    );

                }

            },

            error => {

                console.error(
                    "Location error:",
                    error
                );

                showScreen(
                    "manual-location"
                );

                if (
                    error.code ===
                    error.PERMISSION_DENIED
                ) {

                    detectedPlaceName.textContent =
                        "Location permission denied";

                } else if (
                    error.code ===
                    error.POSITION_UNAVAILABLE
                ) {

                    detectedPlaceName.textContent =
                        "Location unavailable";

                } else if (
                    error.code ===
                    error.TIMEOUT
                ) {

                    detectedPlaceName.textContent =
                        "Location detection timed out";

                } else {

                    detectedPlaceName.textContent =
                        "Location unavailable";

                }

            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }

        );

    }


    /* =========================================================
       OPEN MANUAL LOCATION
    ========================================================= */

    function openManualLocation() {

        showScreen(
            "manual-location"
        );

        const savedCoordinates =
            localStorage.getItem(
                "detectedCoordinates"
            );

        if (savedCoordinates) {

            try {

                const coordinates =
                    JSON.parse(
                        savedCoordinates
                    );

                if (
                    coordinates.latitude &&
                    coordinates.longitude
                ) {

                    getPlaceName(
                        coordinates.latitude,
                        coordinates.longitude
                    );

                    return;

                }

            } catch (error) {

                console.error(
                    "Saved coordinates error:",
                    error
                );

            }

        }

        detectedPlaceName.textContent =
            "Location not detected";

    }


    /* =========================================================
       STATE DROPDOWN
    ========================================================= */

    stateSelect.addEventListener(
        "change",
        () => {

            const selectedState =
                stateSelect.value;

            districtSelect.innerHTML =
                '<option value="">Select District</option>';

            districtSelect.disabled =
                true;

            continueManualBtn.disabled =
                true;

            if (
                selectedState &&
                locationHierarchy[selectedState]
            ) {

                locationHierarchy[
                    selectedState
                ].forEach(district => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        district;

                    option.textContent =
                        district;

                    districtSelect.appendChild(
                        option
                    );

                });

                districtSelect.disabled =
                    false;

            }

        }
    );


    /* =========================================================
       DISTRICT DROPDOWN
    ========================================================= */

    districtSelect.addEventListener(
        "change",
        () => {

            continueManualBtn.disabled =
                !districtSelect.value;

        }
    );


    /* =========================================================
       SAVE MANUAL LOCATION
    ========================================================= */

    continueManualBtn.addEventListener(
        "click",
        () => {

            if (
                !stateSelect.value ||
                !districtSelect.value
            ) {
                return;
            }

            const manualLocation = {

                state:
                    stateSelect.value,

                district:
                    districtSelect.value,

                source:
                    "manual"

            };

            localStorage.setItem(

                "farmerLocation",

                JSON.stringify(
                    manualLocation
                )

            );

            showScreen(
                "farm-details"
            );

        }
    );


    /* =========================================================
       POPULATE CROPS
    ========================================================= */

    function populateCrops() {

        Object.keys(cropData).forEach(crop => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                crop;

            option.textContent =
                crop;

            cropSelect.appendChild(
                option
            );

        });

    }


    /* =========================================================
       CROP CHANGE
    ========================================================= */

    cropSelect.addEventListener(
        "change",
        () => {

            const selectedCrop =
                cropSelect.value;

            varietySelect.innerHTML =
                '<option value="">Select Variety</option>';

            varietySelect.disabled =
                true;

            if (
                selectedCrop &&
                cropData[selectedCrop]
            ) {

                cropData[selectedCrop].forEach(
                    variety => {

                        const option =
                            document.createElement(
                                "option"
                            );

                        option.value =
                            variety;

                        option.textContent =
                            variety;

                        varietySelect.appendChild(
                            option
                        );

                    }
                );

                varietySelect.disabled =
                    false;

            }

            validateFarmDetails();

        }
    );


    /* =========================================================
       FARM DETAILS VALIDATION
    ========================================================= */

    function validateFarmDetails() {

        const crop =
            cropSelect.value;

        const variety =
            varietySelect.value;

        const budget =
            budgetInput.value;

        const landSize =
            landSizeInput.value;

        const unit =
            landUnit.value;

        const irrigation =
            irrigationSelect.value;

        const month =
            harvestMonth.value;

        const isValid =

            crop &&

            variety &&

            budget !== "" &&

            Number(budget) >= 0 &&

            landSize !== "" &&

            Number(landSize) > 0 &&

            unit &&

            irrigation &&

            month;

        continueFarmDetailsBtn.disabled =
            !isValid;

    }


    /* =========================================================
       BUDGET INPUT
       ONLY DIGITS
    ========================================================= */

    budgetInput.addEventListener(
        "input",
        () => {

            budgetInput.value =
                budgetInput.value.replace(
                    /[^0-9]/g,
                    ""
                );

            validateFarmDetails();

        }
    );


    /* =========================================================
       LAND SIZE INPUT
       DIGITS + ONE DECIMAL POINT
    ========================================================= */

    landSizeInput.addEventListener(
        "input",
        () => {

            let value =
                landSizeInput.value.replace(
                    /[^0-9.]/g,
                    ""
                );

            const firstDecimal =
                value.indexOf(".");

            if (firstDecimal !== -1) {

                value =
                    value.substring(
                        0,
                        firstDecimal + 1
                    ) +

                    value
                        .substring(firstDecimal + 1)
                        .replace(/\./g, "");

            }

            landSizeInput.value =
                value;

            validateFarmDetails();

        }
    );


    /* =========================================================
       FARM DETAIL SELECT EVENTS
    ========================================================= */

    landUnit.addEventListener(
        "change",
        validateFarmDetails
    );

    irrigationSelect.addEventListener(
        "change",
        validateFarmDetails
    );

    harvestMonth.addEventListener(
        "change",
        validateFarmDetails
    );

    varietySelect.addEventListener(
        "change",
        validateFarmDetails
    );


    /* =========================================================
       SAVE FARM DETAILS
    ========================================================= */

    continueFarmDetailsBtn.addEventListener(
        "click",
        () => {

            if (
                continueFarmDetailsBtn.disabled
            ) {
                return;
            }

            const farmDetails = {

                crop:
                    cropSelect.value,

                variety:
                    varietySelect.value,

                budget:
                    Number(
                        budgetInput.value
                    ),

                landSize:
                    Number(
                        landSizeInput.value
                    ),

                landUnit:
                    landUnit.value,

                irrigation:
                    irrigationSelect.value,

                expectedHarvestMonth:
                    harvestMonth.value

            };

            localStorage.setItem(

                "farmerFarmDetails",

                JSON.stringify(
                    farmDetails
                )

            );

            selectedLocationText.textContent =

                `${farmDetails.crop} • ` +
                `${farmDetails.variety} • ` +
                `${farmDetails.landSize} ${farmDetails.landUnit} • ` +
                `Harvest: ${farmDetails.expectedHarvestMonth}`;

            showScreen(
                "next-step"
            );

        }
    );


    /* =========================================================
       ESP32 FRONTEND SIMULATION
       
       IMPORTANT:
       These are temporary demo values.
       Later they will come from FastAPI.
    ========================================================= */

    const connectDeviceBtn =
        document.getElementById(
            "connect-device"
        );

    const skipDeviceBtn =
        document.getElementById(
            "skip-device"
        );

    const deviceStatus =
        document.getElementById(
            "device-status"
        );

    const deviceStatusTitle =
        document.getElementById(
            "device-status-title"
        );

    const deviceStatusText =
        document.getElementById(
            "device-status-text"
        );


    const demoSensorData = {

        temperature: 28.4,

        humidity: 71.2,

        soilMoisture: 43.8,

        soilTemperature: 26.7,

        lightIntensity: 842

    };


    function displaySensorData() {

        document.getElementById(
            "sensor-temperature"
        ).textContent =
            `${demoSensorData.temperature} °C`;

        document.getElementById(
            "sensor-humidity"
        ).textContent =
            `${demoSensorData.humidity} %`;

        document.getElementById(
            "sensor-moisture"
        ).textContent =
            `${demoSensorData.soilMoisture} %`;

        document.getElementById(
            "sensor-soil-temperature"
        ).textContent =
            `${demoSensorData.soilTemperature} °C`;

        document.getElementById(
            "sensor-light"
        ).textContent =
            `${demoSensorData.lightIntensity} lux`;

    }


    function connectDemoDevice() {

        connectDeviceBtn.disabled =
            true;

        deviceStatus.classList.remove(
            "connected"
        );

        deviceStatus.classList.add(
            "connecting"
        );

        deviceStatusTitle.textContent =
            "Connecting to device...";

        deviceStatusText.textContent =
            "Searching for your KhetSaarthi ESP32.";

        connectDeviceBtn.querySelector(
            "span"
        ).textContent =
            "Connecting...";


        setTimeout(
            () => {

                deviceStatus.classList.remove(
                    "connecting"
                );

                deviceStatus.classList.add(
                    "connected"
                );

                deviceStatusTitle.textContent =
                    "Device connected";

                deviceStatusText.textContent =
                    "Sensor data received successfully.";

                connectDeviceBtn.querySelector(
                    "span"
                ).textContent =
                    "Continue";

                connectDeviceBtn.disabled =
                    false;

                displaySensorData();

            },
            1800
        );

    }


    /* =========================================================
       PERSONALIZED PLAN GENERATION
    ========================================================= */

    const analysisProgress =
        document.getElementById(
            "analysis-progress"
        );

    const analysisStatus =
        document.getElementById(
            "analysis-status"
        );

    const analysisStep =
        document.getElementById(
            "analysis-step"
        );


    function startPersonalisedPlan() {

        showScreen(
            "plan-generation"
        );

        analysisProgress.style.width =
            "0%";

        const steps = [

            {
                progress: 20,
                text: "Reading your farm profile..."
            },

            {
                progress: 40,
                text: "Analysing sensor conditions..."
            },

            {
                progress: 60,
                text: "Running crop suitability analysis..."
            },

            {
                progress: 80,
                text: "Comparing economic and environmental risks..."
            },

            {
                progress: 95,
                text: "Preparing your personalised recommendations..."
            },

            {
                progress: 100,
                text: "Your personalised plan is ready."
            }

        ];

        let currentStep = 0;


        function runStep() {

            if (
                currentStep >=
                steps.length
            ) {

                setTimeout(
                    () => {

                        prepareCropResults();

                        showScreen(
                            "crop-results"
                        );

                    },
                    500
                );

                return;

            }

            const step =
                steps[currentStep];

            analysisProgress.style.width =
                `${step.progress}%`;

            if (
                currentStep < 4
            ) {

                analysisStatus.textContent =
                    "Analysing your farm conditions and sensor data.";

            } else {

                analysisStatus.textContent =
                    "Finalising your personalised plan.";

            }

            analysisStep.textContent =
                step.text;

            currentStep++;

            setTimeout(
                runStep,
                currentStep === steps.length
                    ? 700
                    : 900
            );

        }

        runStep();

    }


    /* =========================================================
       DEMO STATISTICAL MODEL OUTPUT
       
       Later replace this with your database guy's model/API.
    ========================================================= */

    const demoRankings = [

        {
            crop: "Potato",
            score: 91
        },

        {
            crop: "Sugarcane",
            score: 84
        },

        {
            crop: "Banana",
            score: 78
        }

    ];


    function prepareCropResults() {

        const ranking =
            [...demoRankings];


        document.getElementById(
            "rank-1-crop"
        ).textContent =
            ranking[0].crop;

        document.getElementById(
            "rank-1-score"
        ).textContent =
            `${ranking[0].score}% match`;


        document.getElementById(
            "rank-2-crop"
        ).textContent =
            ranking[1].crop;

        document.getElementById(
            "rank-2-score"
        ).textContent =
            `${ranking[1].score}% match`;


        document.getElementById(
            "rank-3-crop"
        ).textContent =
            ranking[2].crop;

        document.getElementById(
            "rank-3-score"
        ).textContent =
            `${ranking[2].score}% match`;


        const farmDetails =
            JSON.parse(
                localStorage.getItem(
                    "farmerFarmDetails"
                )
            ) || {};


        const selectedCrop =
            farmDetails.crop ||
            "Your selected crop";


        document.getElementById(
            "selected-crop-name"
        ).textContent =
            selectedCrop;


        const selectedCropIsBest =
            selectedCrop.toLowerCase() ===
            ranking[0].crop.toLowerCase();


        document.getElementById(
            "selected-crop-message"
        ).textContent =

            selectedCropIsBest

                ? "Your selected crop is currently the best match for your farm."

                : `${ranking[0].crop} is currently ranked higher for your farm conditions.`;


        document.getElementById(
            "analysis-selected-crop"
        ).textContent =
            selectedCrop;


        document.getElementById(
            "reason-suitability"
        ).textContent =
            `${ranking[0].crop} currently has a stronger suitability score for your farm conditions.`;


        document.getElementById(
            "reason-irrigation"
        ).textContent =
            `Your ${farmDetails.irrigation || "irrigation"} conditions were considered in the ranking.`;


        document.getElementById(
            "reason-economic"
        ).textContent =
            `Your budget of ₹${Number(
                farmDetails.budget || 0
            ).toLocaleString("en-IN")} was considered in the economic analysis.`;


        document.getElementById(
            "reason-risk"
        ).textContent =
            "Environmental and crop-specific risks were included in the comparison.";


        document.getElementById(
            "plan-crop-name"
        ).textContent =
            ranking[0].crop;


        document.getElementById(
            "recommended-crop"
        ).textContent =
            ranking[0].crop;


        document.getElementById(
            "recommended-variety"
        ).textContent =

            ranking[0].crop === "Potato"

                ? "Recommended variety will be selected from your farm conditions."

                : "Recommended variety will be selected from the crop database.";

    }


    /* =========================================================
       ESP32 BUTTONS
    ========================================================= */

    connectDeviceBtn.addEventListener(
        "click",
        () => {

            if (
                deviceStatus.classList.contains(
                    "connected"
                )
            ) {

                startPersonalisedPlan();

            } else {

                connectDemoDevice();

            }

        }
    );


    skipDeviceBtn.addEventListener(
        "click",
        () => {

            displaySensorData();

            startPersonalisedPlan();

        }
    );


    /* =========================================================
       CROP RESULT BUTTONS
    ========================================================= */

    const viewCropAnalysisBtn =
        document.getElementById(
            "view-crop-analysis"
        );

    const scrollToPlanBtn =
        document.getElementById(
            "scroll-to-plan"
        );

    const goToPlanBtn =
        document.getElementById(
            "go-to-plan"
        );

    const proceedWithCropBtn =
        document.getElementById(
            "proceed-with-crop"
        );


    viewCropAnalysisBtn.addEventListener(
        "click",
        () => {

            showScreen(
                "crop-analysis"
            );

        }
    );


    scrollToPlanBtn.addEventListener(
        "click",
        () => {

            showScreen(
                "personalised-plan"
            );

        }
    );


    goToPlanBtn.addEventListener(
        "click",
        () => {

            showScreen(
                "personalised-plan"
            );

        }
    );


    proceedWithCropBtn.addEventListener(
        "click",
        () => {

            alert(
                "Harvest, market and buyer flow will be connected here."
            );

        }
    );


    /* =========================================================
       BUTTON EVENTS
    ========================================================= */

    allowLocationBtn.addEventListener(
        "click",
        requestLocation
    );


    manualLocationBtn.addEventListener(
        "click",
        openManualLocation
    );


    backToLocationBtn.addEventListener(
        "click",
        () => {

            showScreen(
                "location-request"
            );

        }
    );


    /* =========================================================
       CONTINUE AFTER SUPPORTED LOCATION
    ========================================================= */

    continueFoundBtn.addEventListener(
        "click",
        () => {

            showScreen(
                "farm-details"
            );

        }
    );


    /* =========================================================
       CONTINUE AFTER FARM DETAILS
    ========================================================= */

    continueNextBtn.addEventListener(
        "click",
        () => {

            showScreen(
                "device-connect"
            );

        }
    );


    /* =========================================================
       INITIALISE
    ========================================================= */

    populateCrops();

    showScreen(
        "location-request"
    );

});