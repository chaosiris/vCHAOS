import { sendToBackend, handleAction, handleSwipe, initHotkey } from './common.js';

document.addEventListener("DOMContentLoaded", function () {
    // Variables
    const presetsStore = {};
    const presetSidebar = document.getElementById("presetSidebar");
    const presetButton = document.getElementById("presetButton");
    const closePresetSidebar = document.getElementById("closePresetSidebar");
    const presetList = document.getElementById("presetList");
    const modifyButton = document.getElementById("modifyButton");
    const removeButton = document.getElementById("removeButton");
    const canvas = document.getElementById("canvas");
    const minSwipeDistance = 50;
    let presetScrollPos = 0;

    // Functions
    async function loadPresets() {
        try {
            const response = await fetch("/api/get_presets");
            if (!response.ok) throw new Error("Failed to fetch presets");
            const presets = await response.json();
    
            presetList.innerHTML = "";
            presets.forEach((preset, index) => {
                const item = document.createElement("div");
                item.classList.add("preset-item");
    
                const truncatedPrompt = preset.prompt.length > 50 ? preset.prompt.substring(0, 50) + "..." : preset.prompt;
                presetsStore[index] = preset.prompt;
    
                item.innerHTML = `
                    <label class="preset-label">
                        <input type="checkbox" class="preset-checkbox" data-name="${preset.name}" data-index="${index}">
                        <button class="preset-content"> 
                            <strong>${preset.name}</strong><br>${truncatedPrompt}
                        </button>
                    </label>
                `;
                item.querySelector(".preset-content").onclick = () => {
                    presetScrollPos = presetList.scrollTop;
                    sendPreset(presetsStore[index]);
                };
                presetList.appendChild(item);
            });
            presetList.scrollTop = presetScrollPos;
            updatePresetActionButtons();
        } catch (error) {
            presetList.innerHTML = `<p style="color: red;">Error loading presets. Please check your connection status.</p>`;
            console.error("Error loading presets:", error);
            updatePresetActionButtons();
        }
    }

    function updatePresetActionButtons() {
        const selected = document.querySelectorAll(".preset-checkbox:checked");
    
        if (selected.length === 0) {
            modifyButton.textContent = "➕ Add";
            modifyButton.style.display = "inline-block";
        } else if (selected.length === 1) {
            modifyButton.textContent = "📝 Edit";
            modifyButton.style.display = "inline-block";
        } else {
            modifyButton.style.display = "none";
        }
    }

    function showPresetModal(name = "", prompt = "") {
        const modal = document.getElementById("presetModal");
        document.getElementById("presetName").value = name;
        document.getElementById("presetPrompt").value = prompt;
        modal.classList.remove("hidden");
    }

    function sendPreset(text) {
        if (typeof sendToBackend === "function") {
            sendToBackend(text);
        } else {
            console.error("sendToBackend function not found!");
        }
    }

    function closePresetSidebarPanel() {
        presetSidebar.classList.remove("show");
        setTimeout(() => {
            presetSidebar.classList.add("hidden");
        }, 300);
    }

    // Event Listeners
    modifyButton.addEventListener("click", () => {
        const selected = document.querySelectorAll(".preset-checkbox:checked");
        const isEdit = selected.length === 1;
        const index = isEdit ? selected[0].dataset.index : null;
    
        showPresetModal(
            isEdit ? selected[0].dataset.name : "",
            isEdit && index !== null ? presetsStore[index] : ""
        );
    });

    removeButton.addEventListener("click", async () => {
        await handleAction({
            checkboxesSelector: ".preset-checkbox:checked",
            datasetKeys: ["name"],
            endpoint: "/api/delete_presets",
            method: "POST",
            confirmTitle: "Confirm Preset Deletion",
            confirmMessage: {
                all: "Are you sure you want to delete all presets?",
                single: "Are you sure you want to delete ${count} presets?",
            },
            successMessageFallback: "No presets available for deletion!",
            reloadFunction: loadPresets,
        });
    });

    presetButton.addEventListener("click", () => {
        // Close history sidebar to prevent overlap on mobile screens
        if (window.innerWidth <= 768) { 
            const historySidebar = document.getElementById("historySidebar");
            if (historySidebar) {
                historySidebar.classList.remove("show"); 
                setTimeout(() => {
                    historySidebar.classList.add("hidden");
                }, 300);
            }
        }
        if (presetSidebar.classList.contains("hidden")) {
            presetSidebar.classList.remove("hidden");
        }
        presetSidebar.classList.toggle("show");
        if (presetSidebar.classList.contains("show")) {
            loadPresets();
        }
    });

    presetList.addEventListener("change", updatePresetActionButtons);
    closePresetSidebar.addEventListener("click", closePresetSidebarPanel);
    canvas.addEventListener("click", function () {
        if (presetSidebar.classList.contains("show")) {
            closePresetSidebarPanel();
        }
    });

    document.getElementById("savePreset").addEventListener("click", async () => {
        const name = document.getElementById("presetName").value.trim();
        const prompt = document.getElementById("presetPrompt").value.trim();
        if (!name || !prompt) return;

        await fetch("/api/save_preset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, prompt })
        });
        document.getElementById("presetModal").classList.add("hidden");
        loadPresets();
    });

    document.getElementById("cancelPreset").addEventListener("click", () => {
        document.getElementById("presetModal").classList.add("hidden");
    });

    handleSwipe({
        sidebar: presetSidebar,
        loadFunction: loadPresets,
        closeFunction: closePresetSidebarPanel,
        minSwipeDistance: 50,
        openSwipeCondition: (swipeDistance, touchStartX, sidebarOpen) => 
            -swipeDistance > minSwipeDistance && touchStartX > window.innerWidth - 50 && !sidebarOpen,
        closeSwipeCondition: (swipeDistance, sidebarOpen) => 
            -swipeDistance < minSwipeDistance && sidebarOpen,
    });

    initHotkey({
        key: "p",
        modalIds: ["clientsModal", "settingsModal", "confirmationModal", "presetModal"],
        actions: [
            () => {
                const presetSidebar = document.getElementById("presetSidebar");
                if (presetSidebar.classList.contains("show")) {
                    document.getElementById("closePresetSidebar").click();
                } else {
                    document.getElementById("presetButton").click();
                }
            },
        ],
    });
});
