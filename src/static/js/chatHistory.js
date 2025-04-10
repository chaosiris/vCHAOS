import { handleAction, handleSwipe, initHotkey } from './common.js';

document.addEventListener("DOMContentLoaded", function () {
    // Variables
    const archiveButton = document.getElementById("archiveButton");
    const deleteButton = document.getElementById("deleteButton");
    const historyButton = document.getElementById("historyButton");
    const historySidebar = document.getElementById("historySidebar");
    const historyList = document.getElementById("historyList");
    const closeHistorySidebar = document.getElementById("closeHistorySidebar");
    const canvas = document.getElementById("canvas");
    const minSwipeDistance = 50;
    let historyScrollPos = 0;

    // Functions
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
                historyScrollPos = historyList.scrollTop;
            });
            historyList.scrollTop = historyScrollPos;
    
            updateHistoryActionButtons();
        } catch (error) {
            historyList.innerHTML = `<p style="color: red;">Error loading history. Please check your connection status.</p>`;
            console.error("Error loading chat history:", error);
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

    function closeHistorySidebarPanel() {
        historySidebar.classList.remove("show");
        setTimeout(() => {
            historySidebar.classList.add("hidden");
        }, 300);
    }

    // Event Listeners
    archiveButton.addEventListener("click", async () => {
        await handleAction({
            checkboxesSelector: ".history-checkbox:checked",
            datasetKeys: ["wav", "txt"],
            endpoint: "/api/archive_chat_history",
            method: "POST",
            confirmTitle: "Confirm Archive",
            confirmMessage: {
                all: "Are you sure you want to archive all chat histories?",
                single: "Are you sure you want to archive ${count} chat histories?",
            },
            successMessageFallback: "No files available for archive!",
            reloadFunction: loadChatHistory,
        });
    });

    deleteButton.addEventListener("click", async () => {
        await handleAction({
            checkboxesSelector: ".history-checkbox:checked",
            datasetKeys: ["wav", "txt"],
            endpoint: "/api/delete_chat_history",
            method: "DELETE",
            confirmTitle: "Confirm Deletion",
            confirmMessage: {
                all: "Are you sure you want to delete all chat histories?",
                single: "Are you sure you want to delete ${count} chat histories?",
            },
            successMessageFallback: "No files available for deletion!",
            reloadFunction: loadChatHistory,
        });
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

    closeHistorySidebar.addEventListener("click", closeHistorySidebarPanel);
    canvas.addEventListener("click", function () {
        if (historySidebar.classList.contains("show")) {
            closeHistorySidebarPanel();
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

    handleSwipe({
        sidebar: historySidebar,
        loadFunction: loadChatHistory,
        closeFunction: closeHistorySidebarPanel,
        minSwipeDistance: 50,
        openSwipeCondition: (swipeDistance, touchStartX, sidebarOpen) => 
            swipeDistance > minSwipeDistance && touchStartX < 50 && !sidebarOpen,
        closeSwipeCondition: (swipeDistance, sidebarOpen) => 
            swipeDistance < -minSwipeDistance && sidebarOpen,
    });

    initHotkey({
        key: "h",
        modalIds: ["clientsModal", "settingsModal", "confirmationModal", "presetModal"],
        actions: [
            () => {
                const historySidebar = document.getElementById("historySidebar");
                if (historySidebar.classList.contains("show")) {
                    document.getElementById("closeHistorySidebar").click();
                } else {
                    document.getElementById("historyButton").click();
                }
            },
        ],
    });
});