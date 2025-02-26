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

    async function loadChatHistory() {
        historyList.innerHTML = "<p>Loading chat history...</p>";
    
        try {
            const response = await fetch("/api/get_history");
            if (!response.ok) {
                throw new Error("Failed to load history.");
            }
            let data = await response.json();
    
            // Sort timestamps in reverse order for easier access to latest responses
            data.sort((a, b) => {
                const matchA = a.wav.match(/(\d{13})/);
                const matchB = b.wav.match(/(\d{13})/);
                const timestampA = matchA ? parseInt(matchA[0]) : 0;
                const timestampB = matchB ? parseInt(matchB[0]) : 0;
                return timestampB - timestampA;
            });
    
            historyList.innerHTML = "";
    
            const historyItems = await Promise.all(
                data.map(async (item) => {
                    const wavFile = item.wav;
                    const txtFile = item.txt;
    
                    let timestamp = "Unknown Time";
                    const match = wavFile.match(/(\d{13})/);
                    if (match) {
                        timestamp = new Date(parseInt(match[0])).toLocaleString();
                    }
    
                    let previewText = "Loading...";
                    try {
                        const textResponse = await fetch(txtFile);
                        const fullText = await textResponse.text();
                        previewText = fullText.length > 50 ? fullText.substring(0, 50) + "..." : fullText;
                    } catch {
                        previewText = "Error loading text.";
                    }
    
                    const historyItem = document.createElement("div");
                    historyItem.classList.add("history-item-container");
                    historyItem.innerHTML = `
                        <button class="history-item" data-wav="${wavFile}" data-txt="${txtFile}">
                            📄 <strong>${timestamp}</strong><br>
                            ${previewText}
                        </button>
                    `;
                    return historyItem;
                })
            );
    
            historyItems.forEach((item) => historyList.appendChild(item));
    
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

        // Load selected chat log (with 1000ms delay)
        setTimeout(() => {
            audioSource.src = wavFile;
            audioPlayer.load();

            // Error handling
            audioPlayer.onloadeddata = () => {
                audioPlayer.play().catch(error => {
                    console.error("Audio playback error:", error);
                });
            };
        }, 100);
        }
});