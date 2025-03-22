document.addEventListener("DOMContentLoaded", function () {
    const inputContainer = document.createElement("div");
    const textButton = document.getElementById("textButton");
    const fixedBottom = document.getElementById("fixedBottom");
    const textDisplay = document.getElementById("textDisplay");
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const repeatButton = document.getElementById("repeatButton");
    const voiceButton = document.getElementById("voiceButton");
    inputContainer.classList.add("input-container", "hidden");
    inputContainer.appendChild(userInput);
    inputContainer.appendChild(sendButton);
    fixedBottom.appendChild(inputContainer);

    window.textMode = false;
    let lastInputText = "";

    textButton.addEventListener("click", function () {
        window.textMode = !window.textMode;

        if (window.textMode) {
            textDisplay.classList.add("hidden");
            voiceButton.classList.add("hidden");
            inputContainer.classList.remove("hidden");
            userInput.classList.remove("hidden");
            sendButton.classList.remove("hidden");
            userInput.focus();

            if (window.appSettings["enable-prompt-repeat"]) {
                updateRepeatButton();
            }
        } else {
            textDisplay.classList.remove("hidden");
            voiceButton.classList.remove("hidden");
            inputContainer.classList.add("hidden");
            userInput.classList.add("hidden");
            sendButton.classList.add("hidden");

            if (window.appSettings["enable-prompt-repeat"]) {
                updateRepeatButton();
            }
        }
    });

    sendButton.addEventListener("click", function () {
        const inputText = userInput.value.trim();
        if (inputText) {
            sendToBackend(inputText);
            userInput.value = "";
            inputContainer.classList.add("hidden");
            textDisplay.classList.remove("hidden");
            voiceButton.classList.remove("hidden");
            window.textMode = false;
            if (window.appSettings["enable-prompt-repeat"]) {
                lastInputText = inputText;
                updateRepeatButton();
            }
        }
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendButton.click();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.ctrlKey || event.metaKey) return;

        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
            return;
        }
    
        const historySidebar = document.getElementById("historySidebar");
        const clientsModal = document.getElementById("clientsModal");
        const settingsModal = document.getElementById("settingsModal");
        const confirmationModal = document.getElementById("confirmationModal");
    
        if (
            (historySidebar && !historySidebar.classList.contains("hidden")) ||
            (clientsModal && !clientsModal.classList.contains("hidden")) ||
            (settingsModal && !settingsModal.classList.contains("hidden")) ||
            (confirmationModal && !confirmationModal.classList.contains("hidden"))
        ) {
            return;
        }
    
        if (event.key === "i") {
            event.preventDefault();
            textButton.click();
        }
    });

    async function sendToBackend(inputText) {
        if (window.appSettings["show-sent-prompts"]) {
            let textPrefix = document.getElementById("textDisplay").querySelector("strong");
            textPrefix.textContent = "Sent Prompt:";
            textPrefix.style.color = "lightgreen";
            document.getElementById("textOutput").textContent = inputText;
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Request timed out after 180 seconds")), window.appSettings["timeout"] * 1000)
        );
    
        try {
            const response = await Promise.race([
                fetch("/api/send_prompt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: inputText }),
                }),
                timeoutPromise // This will reject if the timeout is reached first
            ]);
    
            updateStatus("waiting");
            const result = await response.json();
    
            if (!response.ok || !result.success) {
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }
    
        } catch (error) {
            console.error("Error while sending request:", error);
    
            if (window.appSettings["show-sent-prompts"]) {
                let textPrefix = document.getElementById("textDisplay").querySelector("strong");
                textPrefix.textContent = "Error Sending Prompt:";
                textPrefix.style.color = "red";
                document.getElementById("textOutput").textContent = inputText;
            }
    
            updateStatus("error");
        }
    }

    function updateRepeatButton() {
        if (!window.appSettings["enable-prompt-repeat"]) {
            repeatButton.classList.add("hidden");
            return;
        }

        if (window.textMode && lastInputText) {
            repeatButton.classList.remove("hidden");
            repeatButton.onclick = () => {
                userInput.value = lastInputText;
            };
        } else if (!window.textMode && window.lastInputVoice) {
            repeatButton.classList.remove("hidden");
            repeatButton.onclick = () => {
                sendToBackend(window.lastInputVoice);
            };
        } else {
            repeatButton.classList.add("hidden");
        }
    }

    function updateStatus(state) {
        const statusMap = {
            "listening": "Listening to Mic",
            "transcribing": "Transcribing Audio",
            "waiting": "Waiting for Response",
            "received": "Response Received",
            "error": "Error",
            "timeout": "Timed Out",
            "idle": "Idle"
        };
        responseStatus.textContent = statusMap[state] || "Idle";
        responseStatus.className = `status-${state}`;
    }

    window.updateStatus = updateStatus;
    window.sendToBackend = sendToBackend;
});
