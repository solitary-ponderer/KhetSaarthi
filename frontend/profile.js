function selectRole(role) {

    const dashboards = {
        farmer: "profiles/farmer/dashboard.html",
        distributor: "profiles/distributor/dashboard.html",
        student: "profiles/student/dashboard.html",
        company: "profiles/company/dashboard.html"
    };

    if (dashboards[role]) {
        window.location.href = dashboards[role];
    }
}