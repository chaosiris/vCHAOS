document.addEventListener("DOMContentLoaded", async function () {
    const settingsButton = document.getElementById("settingsButton");
    const settingsModal = document.getElementById("settingsModal");
    const applySettings = document.getElementById("applySettings");
    const cancelSettings = document.getElementById("cancelSettings");

    const showSentPrompts = document.getElementById("showSentPrompts");
    const enableTextRepeat = document.getElementById("enableTextRepeat");
    const enableMouthScaling = document.getElementById("enableMouthScaling");
    const saveChatHistory = document.getElementById("saveChatHistory");
    const timeoutInput = document.getElementById("timeoutInput");
    const modelInput = document.getElementById("modelInput");

    initModelPath = "";
    window.appSettings = {};
    await loadSettings();

    async function loadSettings() {
        try {
            const response = await fetch("/api/get_settings");
            if (!response.ok) throw new Error("Failed to load settings!");
            
            const settings = await response.json();
            window.appSettings = settings;
            console.log("Settings loaded:", window.appSettings);
        } catch (error) {
            console.error("Error fetching settings:", error);
            window.appSettings = {};
        }
    }

    settingsButton.addEventListener("click", async function () {
        showSentPrompts.checked = window.appSettings["show-sent-prompts"];
        enableTextRepeat.checked = window.appSettings["enable-text-repeat"];
        enableMouthScaling.checked = window.appSettings["enable-mouth-scaling"];
        saveChatHistory.checked = window.appSettings["save-chat-history"];
        timeoutInput.value = window.appSettings["timeout"];
        modelInput.value = window.appSettings["model_path"];
        initModelPath = modelInput.value;
        settingsModal.classList.remove("hidden");
    });

    document.addEventListener("keydown", function (event) {
        if (event.ctrlKey || event.metaKey) return;

        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
            return;
        }
    
        const clientsModal = document.getElementById("clientsModal");
        const settingsModal = document.getElementById("settingsModal");
        const confirmationModal = document.getElementById("confirmationModal");
    
        if (clientsModal && !clientsModal.classList.contains("hidden")) return;
        if (confirmationModal && !confirmationModal.classList.contains("hidden")) return;
    
        if (event.key === "s") {
            event.preventDefault();
            if (settingsModal.classList.contains("hidden")) {
                settingsButton.click();
            } else {
                cancelSettings.click();
            }
        }
    });

    timeoutInput.addEventListener("input", function () {
        if (this.value === "") return;
        this.value = this.value.replace(/[^0-9]/g, "");
    });
    
    timeoutInput.addEventListener("blur", function () {
        let num = parseInt(this.value, 10);
    
        if (isNaN(num) || num < 30) {
            this.value = 30;
        } else if (num > 600) {
            this.value = 600;
        }
    });

    applySettings.addEventListener("click", async function () {
        const newSettings = {
            "frontend": {
                "show-sent-prompts": showSentPrompts.checked,
                "enable-text-repeat": enableTextRepeat.checked,
                "enable-mouth-scaling": enableMouthScaling.checked,
                "save-chat-history": saveChatHistory.checked,
                "timeout": parseInt(timeoutInput.value),
                "model_path": modelInput.value
            }
        };

        try {
            const response = await fetch("/api/update_settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSettings)
            });

            if (!response.ok) throw new Error("Failed to update settings");

            await loadSettings();
            settingsModal.classList.add("hidden");
            if (initModelPath !== modelInput.value) {
                // Refresh page to reload Live2D model if path changed
                window.location.reload();
            }

        } catch (error) {
            console.error("Error applying settings:", error);
        }
    });

    cancelSettings.addEventListener("click", function () {
        settingsModal.classList.add("hidden");
    });

    settingsModal.addEventListener("click", function (event) {
        if (event.target === settingsModal) {
            settingsModal.classList.add("hidden");
        }
    });
});
