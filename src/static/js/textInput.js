document.addEventListener("DOMContentLoaded", function () {
    const inputContainer = document.createElement("div");
    const textButton = document.getElementById("textButton");
    const fixedBottom = document.getElementById("fixedBottom");
    const textDisplay = document.getElementById("textDisplay");
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const repeatButton = document.getElementById("repeatButton");
    inputContainer.classList.add("input-container", "hidden");
    inputContainer.appendChild(userInput);
    inputContainer.appendChild(sendButton);
    fixedBottom.appendChild(inputContainer);

    let textMode = false;
    let lastInputText = "";

    textButton.addEventListener("click", function () {
        textMode = !textMode;

        if (textMode) {
            textDisplay.classList.add("hidden");
            inputContainer.classList.remove("hidden");
            userInput.classList.remove("hidden");
            sendButton.classList.remove("hidden");
            userInput.focus();

            if (window.appSettings["enable-text-repeat"]) {
                repeatButton.classList.remove("hidden");
                repeatButton.onclick = function () {
                    userInput.value = lastInputText;
                };
            }
        } else {
            textDisplay.classList.remove("hidden");
            inputContainer.classList.add("hidden");
            userInput.classList.add("hidden");
            sendButton.classList.add("hidden");

            if (window.appSettings["enable-text-repeat"]) {
                repeatButton.classList.add("hidden");
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
            if (window.appSettings["enable-text-repeat"]) {
                lastInputText = inputText;
                repeatButton.classList.add("hidden");
            }
            textMode = false;
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

    function updateStatus(state) {
        if (state === "listening") {
            responseStatus.textContent = "Listening to Mic";
            responseStatus.className = "status-listening";
        } else if (state === "transcribing") {
            responseStatus.textContent = "Transcribing Audio";
            responseStatus.className = "status-transcribing";
        } else if (state === "waiting") {
            responseStatus.textContent = "Waiting for Response";
            responseStatus.className = "status-waiting";
        } else if (state === "received") {
            responseStatus.textContent = "Response Received";
            responseStatus.className = "status-received";
        } else if (state === "error") {
            responseStatus.textContent = "Error";
            responseStatus.className = "status-error";
        } else if (state === "timeout") {
            responseStatus.textContent = "Timed Out";
            responseStatus.className = "status-timeout";
        } else {
            responseStatus.textContent = "Idle";
            responseStatus.className = "status-idle";
        }
    }

    window.updateStatus = updateStatus;
    window.sendToBackend = sendToBackend;
});
