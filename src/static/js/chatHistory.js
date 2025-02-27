document.addEventListener("DOMContentLoaded", function () {
    const historyButton = document.getElementById("historyButton");
    const historySidebar = document.getElementById("historySidebar");
    const historyList = document.getElementById("historyList");
    const closeSidebar = document.getElementById("closeSidebar");

    historyButton.addEventListener("click", async function () {
        historySidebar.classList.remove("hidden");
        closeSidebar.classList.remove("hidden");
        historySidebar.classList.add("show");
        closeSidebar.classList.add("show");
        await loadChatHistory();
    });

    function closeSidebarPanel() {
        historySidebar.classList.remove("show");
        closeSidebar.classList.remove("show");
        closeSidebar.classList.add("hidden");
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

    searchButton.addEventListener("click", function () {
        loadChatHistory(searchInput.value);
    });
    
    searchInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            loadChatHistory(searchInput.value);
        }
    });
    
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
});