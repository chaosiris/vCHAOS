import { sendToBackend, initHotkey } from './common.js';

document.addEventListener("DOMContentLoaded", function () {
    // Variables
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
    window.updateStatus = updateStatus;
    let lastInputText = "";

    // Functions
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
            repeatButton.ondblclick = () => {
                userInput.value = document.getElementById('textOutput').innerText.trim();
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

    // Event Listeners
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

    initHotkey({
        key: "i",
        modalIds: ["historySidebar", "clientsModal", "settingsModal", "confirmationModal", "presetModal"],
        actions: [
            () => {
                document.getElementById("textButton").click();
            },
        ],
    });
});
