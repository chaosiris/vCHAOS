document.addEventListener("DOMContentLoaded", function () {
    const presetSidebar = document.getElementById("presetSidebar");
    const presetButton = document.getElementById("presetButton");
    const closePresetSidebar = document.getElementById("closePresetSidebar");
    const presetList = document.getElementById("presetList");
    const modifyButton = document.getElementById("modifyButton");
    const deleteButton = document.getElementById("deleteButton");
    const canvas = document.getElementById("canvas");
    const minSwipeDistance = 50;
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;

    async function loadPresets() {
        try {
            const response = await fetch("/api/get_presets");
            if (!response.ok) throw new Error("Failed to fetch presets");
            const presets = await response.json();
    
            presetList.innerHTML = "";
            presets.forEach(preset => {
                const item = document.createElement("div");
                item.classList.add("preset-item");
    
                const truncatedPrompt = preset.prompt.length > 50 ? preset.prompt.substring(0, 50) + "..." : preset.prompt;
    
                item.innerHTML = `
                    <label class="preset-label">
                        <input type="checkbox" class="preset-checkbox" data-name="${preset.name}" data-prompt="${preset.prompt}">
                        <button class="preset-content"> 
                            <strong>${preset.name}</strong><br>${truncatedPrompt}
                        </button>
                    </label>
                `;
    
                item.querySelector(".preset-content").onclick = () => sendPreset(preset.prompt);
                presetList.appendChild(item);
            });
    
            updateButtonStates();
        } catch (error) {
            console.error("Error loading presets:", error);
        }
    }

    function updateButtonStates() {
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
    
        deleteButton.disabled = selected.length === 0;
    }
    
    presetList.addEventListener("change", updateButtonStates);

    modifyButton.addEventListener("click", () => {
        const selected = document.querySelectorAll(".preset-checkbox:checked");
        const isEdit = selected.length === 1;
        showPresetModal(isEdit ? selected[0].dataset.name : "", isEdit ? selected[0].dataset.prompt : "");
    });

    removeButton.addEventListener("click", async () => {
        const selected = document.querySelectorAll(".preset-checkbox:checked");
        const namesToDelete = Array.from(selected).map(cb => cb.dataset.name);
    
        if (namesToDelete.length === 0) return;
    
        const confirmed = await showConfirmationModal("deletePresets", namesToDelete.length);
        if (!confirmed) return;
    
        try {
            await fetch("/api/delete_presets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ names: namesToDelete })
            });
            loadPresets();
        } catch (error) {
            console.error("Error deleting presets:", error);
        }
    });

    async function showConfirmationModal(count = 1) {
        return new Promise((resolve) => {
            const modal = document.getElementById("confirmationModal");
            const confirmButton = document.getElementById("confirmAction");
            const cancelButton = document.getElementById("cancelAction");
            const confirmationText = document.getElementById("confirmationText");
    
            document.getElementById("confirmationTitle").textContent = "Confirm Preset Deletion";
    
            confirmationText.textContent =
                `Are you sure you want to delete ${count > 1 ? "these presets?" : "this preset?"}`;
    
            confirmButton.classList.remove("hidden");
            cancelButton.textContent = "Cancel";
            cancelButton.style.margin = "";
            cancelButton.classList.remove("hidden");
    
            modal.classList.remove("hidden");
    
            confirmButton.onclick = () => {
                modal.classList.add("pending");
                confirmButton.classList.add("hidden");
                cancelButton.classList.add("hidden");
                setTimeout(() => {
                    modal.classList.add("hidden");
                    resolve(true);
                }, 100);            };
    
            cancelButton.onclick = () => {
                modal.classList.add("hidden");
                resolve(false);
            };
    
            modal.onclick = (event) => {
                if (event.target === modal) {
                    modal.classList.add("hidden");
                    resolve(false);
                }
            };
        });
    }

    function showPresetModal(name = "", prompt = "") {
        const modal = document.getElementById("presetModal");
        document.getElementById("presetName").value = name;
        document.getElementById("presetPrompt").value = prompt;
        modal.classList.remove("hidden");
    }

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

    function sendPreset(text) {
        if (typeof window.sendToBackend === "function") {
            window.sendToBackend(text);
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

    closePresetSidebar.addEventListener("click", closePresetSidebarPanel);
    canvas.addEventListener("click", function () {
        if (presetSidebar.classList.contains("show")) {
            closePresetSidebarPanel();
        }
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
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        if (confirmationModal && !confirmationModal.classList.contains("hidden")) return;
        if (presetModal && !presetModal.classList.contains("hidden")) return;
        
        if (event.key === "p") {
            event.preventDefault();
            if (presetSidebar.classList.contains("show")) {
                closePresetSidebar.click();
            } else {
                presetButton.click();
            }
        }
    });
    
    document.addEventListener("touchstart", function (event) {
        if (event.target.closest("audio")) return;
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
    }, { passive: true });
    
    document.addEventListener("touchmove", function (event) {
        if (event.target.closest("audio")) return;
        const deltaX = event.touches[0].clientX - touchStartX;
        const deltaY = Math.abs(event.touches[0].clientY - touchStartY);
    
        if (Math.abs(deltaX) > deltaY) {
            if (event.cancelable) {
                event.preventDefault();
            }
        }
    
        touchEndX = event.touches[0].clientX;
        touchEndY = event.touches[0].clientY;
    }, { passive: false });
    
    document.addEventListener("touchend", function (event) {
        if (event.target.closest("audio")) return;
        const swipeDistance = touchEndX - touchStartX;
        const sidebarOpen = presetSidebar.classList.contains("show");
    
        if (Math.abs(swipeDistance) < minSwipeDistance) return;
    
        const sidebarRect = presetSidebar.getBoundingClientRect();
        const touchEndedInsideSidebar =
            sidebarOpen &&
            touchEndX >= sidebarRect.left &&
            touchEndX <= sidebarRect.right &&
            touchEndY >= sidebarRect.top &&
            touchEndY <= sidebarRect.bottom;
    
        if (touchEndedInsideSidebar) return;
    
        if (-swipeDistance < minSwipeDistance && sidebarOpen) {
            closePresetSidebarPanel();
        } else if (-swipeDistance > minSwipeDistance && touchStartX > window.innerWidth - 50 && !sidebarOpen) {
            presetSidebar.classList.remove("hidden");
            presetSidebar.classList.add("show");
            loadPresets();
        }
    });    
});
