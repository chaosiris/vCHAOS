document.addEventListener("DOMContentLoaded", function () {
    const inputContainer = document.createElement("div");
    const textButton = document.getElementById("textButton");
    const fixedBottom = document.getElementById("fixedBottom");
    const textDisplay = document.getElementById("textDisplay");
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    inputContainer.classList.add("input-container", "hidden");
    inputContainer.appendChild(userInput);
    inputContainer.appendChild(sendButton);
    fixedBottom.appendChild(inputContainer);

    let textMode = false;

    textButton.addEventListener("click", function () {
        textMode = !textMode;

        if (textMode) {
            textDisplay.classList.add("hidden");
            inputContainer.classList.remove("hidden");
            userInput.classList.remove("hidden");
            sendButton.classList.remove("hidden");
            userInput.focus();
        } else {
            textDisplay.classList.remove("hidden");
            inputContainer.classList.add("hidden");
            userInput.classList.add("hidden");
            sendButton.classList.add("hidden");
        }
    });

    sendButton.addEventListener("click", function () {
        const inputText = userInput.value.trim();
        if (inputText) {
            sendToBackend(inputText);
            userInput.value = "";
            inputContainer.classList.add("hidden");
            textDisplay.classList.remove("hidden");
            textMode = false;
        }
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendButton.click();
        }
    });

    async function sendToBackend(inputText) {

        if (window.appSettings["chat-interface"]?.["show-sent-prompts"]) {
            let textPrefix = document.getElementById("textDisplay").querySelector("strong");
            textPrefix.textContent = "Sent Prompt:";
            textPrefix.style.color = "lightgreen";
            document.getElementById("textOutput").textContent = inputText;
        }

        let responseTimeout = setTimeout(() => {
            console.error("Request timed out after 180 seconds.");
            updateStatus("timeout");
        }, 180000); // TODO: Make this a user configurable setting (some users might run pipeline on slower hardware)
    
        try {
            const response = await fetch("/api/send_prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText }),
            });

            updateStatus("waiting");
            const result = await response.json();
            clearTimeout(responseTimeout);

            if (!response.ok || !result.success) {
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }
    
        } catch (error) {
            console.error("Error while sending request:", error);
    
            if (window.appSettings["chat-interface"]?.["show-sent-prompts"]) {
                let textPrefix = document.getElementById("textDisplay").querySelector("strong");
                textPrefix.textContent = "Error Sending Prompt:";
                textPrefix.style.color = "red";
                document.getElementById("textOutput").textContent = inputText;
            }
    
            updateStatus("error");
        }
    }

    function updateStatus(state) {
        if (state === "waiting") {
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
});