async function updateBackground() {
    while (!window.appSettings || Object.keys(window.appSettings).length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure settings are loaded first
    }

    if (!window.appSettings["adaptive-background"]) {
        document.body.style.backgroundImage = "url('/static/img/background.jpg')";
        document.body.dataset.bg = "/static/img/background.jpg";
        return;
    }

    const hour = new Date().getHours();
    const backgrounds = {
        day: "/static/img/background.jpg",
        evening: "/static/img/evening.jpg",
        night: "/static/img/night.jpg",
        dusk: "/static/img/dusk.jpg"
    };

    const backgroundImage =
        hour >= 9 && hour < 16 ? backgrounds.day :
        hour >= 16 && hour < 19 ? backgrounds.evening :
        hour >= 19 || hour < 4 ? backgrounds.night :
        backgrounds.dusk;

    if (document.body.dataset.bg !== backgroundImage) {
        const img = new Image();
        img.src = backgroundImage;
        img.onload = () => {
            document.body.style.backgroundImage = `url('${backgroundImage}')`;
            document.body.dataset.bg = backgroundImage;
        };
    }

    scheduleNextUpdate();
}

function getNextUpdateTime() {
    const now = new Date();
    const schedule = [4, 9, 16, 19];
    const nextHour = schedule.find(h => h > now.getHours()) || schedule[0];
    const nextUpdate = new Date(now);
    nextUpdate.setHours(nextHour, 0, 0, 0);

    if (nextUpdate < now) {
        nextUpdate.setDate(now.getDate() + 1);
    }

    return nextUpdate - now;
}

function scheduleNextUpdate() {
    if (scheduleNextUpdate.timeoutId) {
        clearTimeout(scheduleNextUpdate.timeoutId);
    }

    if (!window.appSettings["adaptive-background"]) {
        return;
    }

    const timeUntilNextUpdate = getNextUpdateTime();
    scheduleNextUpdate.timeoutId = setTimeout(() => {
        document.dispatchEvent(new Event("backgroundUpdate"));
    }, timeUntilNextUpdate);
}

document.addEventListener("backgroundUpdate", () => updateBackground());

document.addEventListener("DOMContentLoaded", () => {
    updateBackground();
});