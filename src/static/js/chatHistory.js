document.addEventListener("DOMContentLoaded", function () {
    const archiveButton = document.getElementById("archiveButton");
    const deleteButton = document.getElementById("deleteButton");
    const historyButton = document.getElementById("historyButton");
    const historySidebar = document.getElementById("historySidebar");
    const historyList = document.getElementById("historyList");
    const closeSidebar = document.getElementById("closeSidebar");

    archiveButton.addEventListener("click", async function () {
        await archiveChatHistory();
    });

    deleteButton.addEventListener("click", async function () {
        await deleteChatHistory();
    });

    historyButton.addEventListener("click", async function () {
        historySidebar.classList.remove("hidden");
        historySidebar.classList.add("show");
        await loadChatHistory();
    });

    function closeSidebarPanel() {
        historySidebar.classList.remove("show");
        setTimeout(() => {
            historySidebar.classList.add("hidden");
        }, 300);
    }

    closeSidebar.addEventListener("click", closeSidebarPanel);
    canvas.addEventListener("click", function () {
        if (historySidebar.classList.contains("show")) {
            closeSidebarPanel();
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
    
        if (clientsModal && !clientsModal.classList.contains("hidden")) return;
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        if (confirmationModal && !confirmationModal.classList.contains("hidden")) return;
    
        const historySidebar = document.getElementById("historySidebar");
    
        if (event.key === "h") {
            event.preventDefault();
            if (historySidebar.classList.contains("show")) {
                closeSidebar.click();
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
            if (!response.ok) {
                throw new Error("Failed to load history.");
            }
            let data = await response.json();
    
            historyList.innerHTML = "";
    
            if (data.length === 0) {
                historyList.innerHTML = "<p>No matching results.</p>";
                return;
            }
    
            data.forEach((item) => {
                const historyItem = document.createElement("div");
                historyItem.classList.add("history-item-container");
                historyItem.innerHTML = `
                    <button class="history-item" data-wav="${item.wav}" data-txt="${item.txt}">
                        📄 <strong>${new Date(item.timestamp).toLocaleString()}</strong><br>
                        ${item.preview_text}
                    </button>
                `;
                historyList.appendChild(historyItem);
            });
    
            historyList.addEventListener("click", function (event) {
                const button = event.target.closest(".history-item");
                if (!button) return;
            
                const wavFile = button.getAttribute("data-wav");
                const txtFile = button.getAttribute("data-txt");
                loadChatFromHistory(wavFile, txtFile);
            });
    
        } catch (error) {
            historyList.innerHTML = `<p style="color: red;">Error loading history.</p>`;
            console.error(error);
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

        try {
            const response = await fetch("/api/archive_chat_history", { method: "POST" });
            const data = await response.json();
            let message = response.ok && data.success ? data.message : "No files available for archive!";
            displayResultMessage(message);
            if (data.success) await loadChatHistory();
        } catch {
            displayResultMessage("Error archiving chat history.");
        }
    }

    async function deleteChatHistory() {
        const confirmed = await showConfirmationModal("delete");
        if (!confirmed) return;

        try {
            const response = await fetch("/api/delete_chat_history", { method: "DELETE" });
            const data = await response.json();
            let message = response.ok && data.success ? data.message : "No files available for deletion!";
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
});