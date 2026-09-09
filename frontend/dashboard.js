function selectRole(role) {

    const dashboards = {
        farmer: "profiles/farmer/farmer.html",
        distributor: "profiles/consumer/consumer.html",
        student: "profiles/student/student.html",
        company: "profiles/company/company.html"
    };

    if (dashboards[role]) {
        window.location.href = dashboards[role];
    }
}