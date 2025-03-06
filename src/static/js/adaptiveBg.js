function updateBackground() {
    const hour = new Date().getHours();
    /* Images sourced from Freepik */
    /* License: Free (Attribution Required) */
    const backgrounds = {
        /* URL: https://www.freepik.com/free-ai-image/anime-style-cozy-home-interior-with-furnishings_133783512.htm */
        day: "/static/img/background.jpg",
        /* URL: https://www.freepik.com/free-ai-image/cartoon-style-summer-scene-with-window-view_94510186.htm */
        evening: "/static/img/evening.jpg",
        /* URL: https://www.freepik.com/free-ai-image/anime-style-cozy-home-interior-with-furnishings_133783486.htm */
        night: "/static/img/night.jpg",
        /* URL: https://www.freepik.com/free-ai-image/cozy-home-interior-anime-style_133783432.htm */
        dusk: "/static/img/dusk.jpg"
    };

    const backgroundImage =
        hour >= 9 && hour < 16 ? backgrounds.day :
        hour >= 16 && hour < 19 ? backgrounds.evening :
        hour >= 19 || hour < 4 ? backgrounds.night :
        backgrounds.dusk;

    if (document.body.dataset.bg !== backgroundImage) {
        document.body.style.backgroundImage = `url('${backgroundImage}')`;
        document.body.dataset.bg = backgroundImage;
    }
}

function scheduleNextUpdate() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);

    const timeUntilNextHour = nextHour - now;

    setTimeout(() => {
        updateBackground();
        scheduleNextUpdate();
    }, timeUntilNextHour);
}

document.addEventListener("DOMContentLoaded", () => {
    updateBackground();
    scheduleNextUpdate();
});
