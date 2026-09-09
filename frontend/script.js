document.addEventListener("DOMContentLoaded", () => {

    const nav = document.querySelector(".main-nav");
    const links = document.querySelectorAll(".nav-link");
    const indicator = document.querySelector(".nav-indicator");

    const sections = [
        document.querySelector("#home"),
        document.querySelector("#features"),
        document.querySelector("#how-it-works"),
        document.querySelector("#about")
    ];


    /* ================= MOVE ACTIVE INDICATOR ================= */

    function moveIndicator(link) {

        if (!link || !indicator || !nav) {
            return;
        }

        const navRect = nav.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();

        indicator.style.left =
            `${linkRect.left - navRect.left}px`;

        indicator.style.width =
            `${linkRect.width}px`;
    }


    /* ================= CLICK HANDLING ================= */

    links.forEach(link => {

        link.addEventListener("click", () => {

            links.forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");

            moveIndicator(link);

        });

    });


    /* ================= SCROLL DETECTION ================= */

    const observer = new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) {
                    return;
                }

                const activeLink =
                    document.querySelector(
                        `.nav-link[href="#${entry.target.id}"]`
                    );

                if (!activeLink) {
                    return;
                }


                links.forEach(link => {
                    link.classList.remove("active");
                });


                activeLink.classList.add("active");

                moveIndicator(activeLink);

            });

        },
        {
            root: null,

            threshold: 0.25,

            rootMargin: "-76px 0px -35% 0px"
        }
    );


    /* ================= OBSERVE SECTIONS ================= */

    sections.forEach(section => {

        if (section) {
            observer.observe(section);
        }

    });


    /* ================= INITIAL POSITION ================= */

    const initialLink =
        document.querySelector(".nav-link.active");

    moveIndicator(initialLink);


    /* ================= RESIZE ================= */

    window.addEventListener("resize", () => {

        const activeLink =
            document.querySelector(".nav-link.active");

        moveIndicator(activeLink);

    });

});