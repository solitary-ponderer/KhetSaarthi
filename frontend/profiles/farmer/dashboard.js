// ===============================
// FARMER DASHBOARD
// ===============================


// Display current date
function setDate() {

    const dateElement = document.getElementById("currentDate");

    if (!dateElement) return;

    const today = new Date();

    const options = {
        day: "numeric",
        month: "long",
        year: "numeric"
    };

    dateElement.textContent =
        today.toLocaleDateString("en-IN", options);
}


// Temporary interaction handler
function showMessage(message) {

    alert(message);
}


// Initialize dashboard
setDate();