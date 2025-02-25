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
        const webhookUrl = "http://homeassistant.local:8123/api/webhook/ollama_chat";

        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            updateStatus("waiting");

        } catch (error) {
            console.error("Error while sending request:", error);
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
        } else {
            responseStatus.textContent = "Idle";
            responseStatus.className = "status-idle";
        }
    }

    window.updateStatus = updateStatus;
});


document.addEventListener("DOMContentLoaded", function () {
    const textButton = document.getElementById("textButton");
    const fixedBottom = document.getElementById("fixedBottom");
    const textDisplay = document.getElementById("textDisplay");


    const userInput = document.createElement("input");
    userInput.setAttribute("type", "text");
    userInput.setAttribute("id", "userInput");
    userInput.setAttribute("placeholder", "Type your prompt...");
    userInput.classList.add("user-input-field");

    const sendButton = document.createElement("button");
    sendButton.setAttribute("id", "sendButton");
    sendButton.textContent = "Send";


    let textMode = false;

    textButton.addEventListener("click", function () {
        textMode = !textMode;

        if (textMode) {
            textDisplay.classList.add("hidden");
            inputContainer.classList.remove("hidden");
            userInput.focus();
        } else {
            textDisplay.classList.remove("hidden");
            inputContainer.classList.add("hidden");
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
        // TODO: Add this URL to settings.yaml
        const webhookUrl = "http://homeassistant.local:8123/api/webhook/ollama_chat";

        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            updateStatus("waiting");

        } catch (error) {
            console.error("Error while sending request:", error);
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
        } else {
            responseStatus.textContent = "Idle";
            responseStatus.className = "status-idle";
        }
    }

    window.updateStatus = updateStatus;
});
