document.addEventListener("DOMContentLoaded", async function () {
    const settingsButton = document.getElementById("settingsButton");
    const settingsModal = document.getElementById("settingsModal");
    const applySettings = document.getElementById("applySettings");
    const cancelSettings = document.getElementById("cancelSettings");

    const showSentPrompts = document.getElementById("showSentPrompts");
    const enableIdleMotion = document.getElementById("enableIdleMotion");
    const enablePromptRepeat = document.getElementById("enablePromptRepeat");
    const enableMouthScaling = document.getElementById("enableMouthScaling");
    const enableVoiceInput = document.getElementById("enableVoiceInput");
    const saveChatHistory = document.getElementById("saveChatHistory");
    const adaptiveBg = document.getElementById("adaptiveBg");
    const timeoutInput = document.getElementById("timeoutInput");
    const modelInput = document.getElementById("modelInput");

    initModelName = "";
    initVoiceInput = "";
    initIdleMotion = "";
    window.appSettings = {};
    await loadSettings();

    async function loadSettings() {
        try {
            const response = await fetch("/api/get_settings");
            if (!response.ok) throw new Error("Failed to load settings!");
            
            const settings = await response.json();
            window.appSettings = settings;
            await populateModelDropdown(settings["model-name"]);
            console.log("Settings loaded:", window.appSettings);
        } catch (error) {
            console.error("Error fetching settings:", error);
            window.appSettings = {};
        }
    }

    async function populateModelDropdown() {
        try {
            const response = await fetch("/api/get_models");
            if (!response.ok) throw new Error("Failed to load models");
    
            const models = await response.json();
            modelInput.innerHTML = "";
    
            models.forEach(model => {
                const option = document.createElement("option");
                option.value = model.name;
                option.textContent = model.name;
                if (model.name === window.appSettings["model-name"]) {
                    option.selected = true;
                }
                modelInput.appendChild(option);
            });
        } catch (err) {
            console.error("Error populating model dropdown:", err);
        }
    }

    settingsButton.addEventListener("click", async function () {
        showSentPrompts.checked = window.appSettings["show-sent-prompts"];
        enableIdleMotion.checked = window.appSettings["enable-idle-motion"];
        enablePromptRepeat.checked = window.appSettings["enable-prompt-repeat"];
        enableMouthScaling.checked = window.appSettings["enable-mouth-scaling"];
        enableVoiceInput.checked = window.appSettings["enable-voice-input"];
        saveChatHistory.checked = window.appSettings["save-chat-history"];
        adaptiveBg.checked = window.appSettings["adaptive-background"];
        timeoutInput.value = window.appSettings["timeout"];
        modelInput.value = window.appSettings["model-name"];
        initModelName = modelInput.value;
        initVoiceInput = enableVoiceInput.value;
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
        const presetModal = document.getElementById("presetModal");
    
        if (clientsModal && !clientsModal.classList.contains("hidden")) return;
        if (confirmationModal && !confirmationModal.classList.contains("hidden")) return;
        if (presetModal && !presetModal.classList.contains("hidden")) return;
    
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
                "enable-idle-motion": enableIdleMotion.checked,
                "enable-prompt-repeat": enablePromptRepeat.checked,
                "enable-mouth-scaling": enableMouthScaling.checked,
                "enable-voice-input": enableVoiceInput.checked,
                "save-chat-history": saveChatHistory.checked,
                "adaptive-background": adaptiveBg.checked,
                "timeout": parseInt(timeoutInput.value),
                "model-name": modelInput.value
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

            if (initVoiceInput !== enableVoiceInput.checked) {
                if (!enableVoiceInput.checked) {
                    // Hide and remove voice button and event listeners if disabled
                    const voiceButton = document.getElementById("voiceButton");
                    if (voiceButton) {
                        voiceButton.style.display = "none";
                        voiceButton.replaceWith(voiceButton.cloneNode(true));
                    }
                } else {
                    // Refresh page to re-initialize voiceInput.js
                    window.location.reload();
                    return;
                }
            }

            if (initIdleMotion !== enableIdleMotion.checked) {
                if (enableIdleMotion.checked) {
                    window.location.reload();
                }
            }

            const repeatButton = document.getElementById("repeatButton");
            if (!window.appSettings["enable-prompt-repeat"] && repeatButton && !repeatButton.classList.contains("hidden")) {
                repeatButton.classList.add("hidden");
            }

            settingsModal.classList.add("hidden");
            if (initModelName !== modelInput.value) {
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
