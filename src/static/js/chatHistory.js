document.addEventListener("DOMContentLoaded", function () {
    const archiveButton = document.getElementById("archiveButton");
    const deleteButton = document.getElementById("deleteButton");
    const historyButton = document.getElementById("historyButton");
    const historySidebar = document.getElementById("historySidebar");
    const historyList = document.getElementById("historyList");
    const closeHistorySidebar = document.getElementById("closeHistorySidebar");
    const canvas = document.getElementById("canvas");
    const minSwipeDistance = 50;
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;

    archiveButton.addEventListener("click", async function () {
        await archiveChatHistory();
    });

    deleteButton.addEventListener("click", async function () {
        await deleteChatHistory();
    });

    historyButton.addEventListener("click", async function () {
        // Close preset sidebar to prevent overlap on mobile screens
        if (window.innerWidth <= 768) { 
            const presetSidebar = document.getElementById("presetSidebar");
            if (presetSidebar) {
                presetSidebar.classList.remove("show"); 
                setTimeout(() => {
                    presetSidebar.classList.add("hidden");
                }, 300);
            }
        }
        if (historySidebar.classList.contains("hidden")) {
            historySidebar.classList.remove("hidden");
        }
        historySidebar.classList.toggle("show");
        if (historySidebar.classList.contains("show")) {
            await loadChatHistory();
        }
    });
    function closeHistorySidebarPanel() {
        historySidebar.classList.remove("show");
        setTimeout(() => {
            historySidebar.classList.add("hidden");
        }, 300);
    }

    closeHistorySidebar.addEventListener("click", closeHistorySidebarPanel);
    canvas.addEventListener("click", function () {
        if (historySidebar.classList.contains("show")) {
            closeHistorySidebarPanel();
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
    
        const historySidebar = document.getElementById("historySidebar");
    
        if (event.key === "h") {
            event.preventDefault();
            if (historySidebar.classList.contains("show")) {
                closeHistorySidebar.click();
            } else {
                historyButton.click();
            }
        }
    });

    document.addEventListener("chatHistoryUpdate", () => loadChatHistory());

    searchButton.addEventListener("click", function () {
        loadChatHistory(searchInput.value);
    });
    
    searchInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            loadChatHistory(searchInput.value);
        }
    });

    async function loadChatHistory(searchQuery = "") {
        historyList.innerHTML = "<p>Loading chat history...</p>";
    
        try {
            const response = await fetch(`/api/get_history?search=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) throw new Error("Failed to load history.");
    
            let data = await response.json();
            historyList.innerHTML = "";
    
            if (data.length === 0) {
                historyList.innerHTML = "<p>No matching results.</p>";
                updateHistoryActionButtons();
                return;
            }
    
            data.forEach((item) => {
                const container = document.createElement("div");
                container.classList.add("history-item-container");
    
                container.innerHTML = `
                    <label class="history-label">
                        <input type="checkbox" class="history-checkbox" data-txt="${item.txt}" data-wav="${item.wav}">
                        <button class="history-item" data-wav="${item.wav}" data-txt="${item.txt}">
                            📄 <strong>${new Date(item.timestamp).toLocaleString()}</strong><br>
                            ${item.preview_text}
                        </button>
                    </label>
                `;
    
                historyList.appendChild(container);
            });
    
            historyList.querySelectorAll(".history-checkbox").forEach(cb => {
                cb.addEventListener("change", updateHistoryActionButtons);
            });
    
            historyList.addEventListener("click", function (event) {
                const button = event.target.closest(".history-item");
                if (!button) return;
                const wavFile = button.getAttribute("data-wav");
                const txtFile = button.getAttribute("data-txt");
                loadChatFromHistory(wavFile, txtFile);
            });
    
            updateHistoryActionButtons();
        } catch (error) {
            historyList.innerHTML = `<p style="color: red;">Error loading history.</p>`;
            console.error(error);
            updateHistoryActionButtons();
        }
    }

    function updateHistoryActionButtons() {
        const selected = document.querySelectorAll(".history-checkbox:checked");
        const archiveButton = document.getElementById("archiveButton");
        const deleteButton = document.getElementById("deleteButton");
    
        if (selected.length === 0) {
            archiveButton.textContent = "📦 Archive";
            deleteButton.textContent = "🗑 Delete";
        } else {
            archiveButton.textContent = `📦 Archive (${selected.length})`;
            deleteButton.textContent = `🗑 Delete (${selected.length})`;
        }
    }
    
    async function loadChatFromHistory(wavFile, txtFile) {
        const textOutput = document.getElementById("textOutput");
        const textDisplay = document.getElementById("textDisplay").querySelector("strong");
        const audioPlayer = document.getElementById("audioPlayer");
        const audioSource = document.getElementById("audioSource");

        try {
            const response = await fetch(txtFile);
            const text = await response.text();
            textDisplay.textContent = "Loaded Message:";
            textDisplay.style.color = "lightblue";
            textOutput.textContent = text;
        } catch (error) {
            textOutput.textContent = "Error loading text.";
        }

        // Clear previous source to avoid frontend Javascript errors
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioSource.src = "";

        // Load selected chat log (with 100ms delay)
        setTimeout(() => {
            audioSource.src = wavFile;
            audioPlayer.load();

            // Error handling
            audioPlayer.onloadeddata = () => {
                audioPlayer.play().catch(error => {
                    console.error("Audio playback error:", error);
                });
            };
        }, 50);
    }

    async function showConfirmationModal(action) {
        return new Promise((resolve) => {
            const modal = document.getElementById("confirmationModal");
            const confirmButton = document.getElementById("confirmAction");
            const cancelButton = document.getElementById("cancelAction");
            const confirmationText = document.getElementById("confirmationText");

            document.getElementById("confirmationTitle").textContent =
                action === "archive" ? "Confirm Archive" : "Confirm Deletion";
            confirmationText.textContent =
                action === "archive" ? "Are you sure you want to archive chat history?" : "Are you sure you want to delete chat history?";
            
            confirmButton.classList.remove("hidden");
            cancelButton.textContent = "Cancel";
            cancelButton.style.margin = "";
            cancelButton.classList.remove("hidden");

            modal.classList.remove("hidden");

            confirmButton.onclick = () => {
                modal.classList.add("pending");
                confirmButton.classList.add("hidden");
                cancelButton.classList.add("hidden");
                resolve(true);
            };

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

    async function archiveChatHistory() {
        const confirmed = await showConfirmationModal("archive");
        if (!confirmed) return;
    
        const selected = document.querySelectorAll(".history-checkbox:checked");
        const filenames = Array.from(selected).flatMap(cb => [
            cb.dataset.wav?.replace("/output/", ""),
            cb.dataset.txt?.replace("/output/", "")
        ]).filter(Boolean);
    
        try {
            const response = await fetch("/api/archive_chat_history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: filenames.length
                ? JSON.stringify({ filenames })
                : JSON.stringify({})
            });
    
            const data = await response.json();
            const message = response.ok && data.success
                ? data.message
                : "No files available for archive!";
            displayResultMessage(message);
            if (data.success) await loadChatHistory();
        } catch {
            displayResultMessage("Error archiving chat history.");
        }
    }

    async function deleteChatHistory() {
        const confirmed = await showConfirmationModal("delete");
        if (!confirmed) return;

        const selected = document.querySelectorAll(".history-checkbox:checked");
        const filenames = Array.from(selected).flatMap(cb => [
            cb.dataset.wav?.replace("/output/", ""),
            cb.dataset.txt?.replace("/output/", "")
        ]).filter(Boolean);

        try {
            const response = await fetch("/api/delete_chat_history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: filenames.length
                ? JSON.stringify({ filenames })
                : JSON.stringify({})
            });

            const data = await response.json();
            const message = response.ok && data.success
                ? data.message
                : "No files available for deletion!";
            displayResultMessage(message);
            if (data.success) await loadChatHistory();
        } catch {
            displayResultMessage("Error deleting chat history.");
        }
    }

    function displayResultMessage(message) {
        const modal = document.getElementById("confirmationModal");
        const confirmationText = document.getElementById("confirmationText");
        const confirmButton = document.getElementById("confirmAction");
        const cancelButton = document.getElementById("cancelAction");

        confirmButton.classList.add("hidden");
        confirmationText.textContent = message;
        confirmationText.classList.remove("hidden");

        cancelButton.textContent = "Ok";
        cancelButton.style.margin = "0 auto";
        cancelButton.classList.remove("hidden");

        cancelButton.onclick = () => {
            modal.classList.add("hidden");
        };
    }
    
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
    
        if (Math.abs(deltaX) > deltaY && event.cancelable) {
            event.preventDefault();
        }
    
        touchEndX = event.touches[0].clientX;
        touchEndY = event.touches[0].clientY;
    }, { passive: false });
    
    document.addEventListener("touchend", function (event) {
        if (event.target.closest("audio")) return;
        const swipeDistance = touchEndX - touchStartX;
        const sidebarOpen = historySidebar.classList.contains("show");
    
        if (Math.abs(swipeDistance) < minSwipeDistance) return;
    
        const sidebarRect = historySidebar.getBoundingClientRect();
        const touchEndedInsideSidebar =
            sidebarOpen &&
            touchEndX >= sidebarRect.left &&
            touchEndX <= sidebarRect.right &&
            touchEndY >= sidebarRect.top &&
            touchEndY <= sidebarRect.bottom;
    
        if (touchEndedInsideSidebar) return;
    
        if (swipeDistance > minSwipeDistance && touchStartX < 50 && !sidebarOpen) {
            historySidebar.classList.remove("hidden");
            historySidebar.classList.add("show");
            loadChatHistory();
        } else if (swipeDistance < -minSwipeDistance && sidebarOpen) {
            closeHistorySidebarPanel();
        }
    });
});