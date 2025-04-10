// Shared function for sending prompt to Ollama endpoint
export async function sendToBackend(inputText) {
    if (window.appSettings["show-sent-prompts"]) {
        let textPrefix = document.getElementById("textDisplay").querySelector("strong");
        textPrefix.textContent = "Sent Prompt:";
        textPrefix.style.color = "lightgreen";
        document.getElementById("textOutput").textContent = inputText;
    }
    updateStatus("waiting");

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

// Shared function for sidebar action buttons
export async function handleAction({
    checkboxesSelector,
    datasetKeys = [],
    endpoint,
    method,
    confirmTitle,
    confirmMessage,
    successMessageFallback,
    reloadFunction = null,
}) {
    const selected = document.querySelectorAll(checkboxesSelector);
    const actionItem = datasetKeys.length === 1
        ? Array.from(selected).map(cb => cb.dataset[datasetKeys[0]])
        : Array.from(selected).flatMap(cb => [
            cb.dataset.wav?.replace("/output/", ""),
            cb.dataset.txt?.replace("/output/", "")
        ]).filter(Boolean);

    const message = actionItem.length === 0
            ? confirmMessage.all
            : confirmMessage.single.replace("${count}", actionItem.length / datasetKeys.length);

    const confirmed = await showConfirmationModal(confirmTitle, message);
    if (!confirmed) return;

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: actionItem.length
                ? datasetKeys.length === 1
                    ? JSON.stringify({ names: actionItem })
                    : JSON.stringify({ filenames: actionItem })
                : JSON.stringify({}),
        });        

        const data = await response.json();
        const resultMessage = response.ok && data.success
            ? data.message
            : successMessageFallback;
        displayResultMessage(resultMessage);

        if (data.success && reloadFunction) await reloadFunction();
    } catch (error) {
        displayResultMessage("An error occurred while processing your request.");
        console.error("Error during action:", error);
    }
}

const elem = {
    modal: document.getElementById("confirmationModal"),
    confirmButton: document.getElementById("confirmAction"),
    cancelButton: document.getElementById("cancelAction"),
    confirmationText: document.getElementById("confirmationText"),
    confirmationTitle: document.getElementById("confirmationTitle"),
};

async function showConfirmationModal(title, message) {
    return new Promise((resolve) => {
        elem.modal.classList.remove("hidden");
        elem.confirmationTitle.textContent = title;
        elem.confirmationText.textContent = message;

        elem.confirmButton.classList.remove("hidden");
        elem.cancelButton.textContent = "Cancel";
        elem.cancelButton.classList.remove("hidden");

        elem.confirmButton.onclick = () => {
            elem.modal.classList.add("pending");
            elem.confirmButton.classList.add("hidden");
            elem.cancelButton.classList.add("hidden");
            resolve(true);
        };

        elem.cancelButton.onclick = () => {
            elem.modal.classList.remove("pending");
            elem.modal.classList.add("hidden");
            resolve(false);
        };

        elem.modal.onclick = (event) => {
            if (event.target === elem.modal) {
                elem.modal.classList.remove("pending");
                elem.modal.classList.add("hidden");
                resolve(false);
            }
        };
    });
}

function displayResultMessage(message) {
    elem.confirmButton.classList.add("hidden");
    elem.confirmationText.textContent = message;
    elem.confirmationText.classList.remove("hidden");

    elem.cancelButton.textContent = "Ok";
    elem.cancelButton.style.margin = "0 auto";
    elem.cancelButton.classList.remove("hidden");

    elem.cancelButton.onclick = () => {
        elem.modal.classList.add("hidden");
    };
}

// Shared function for sidebar swipe gesture
export function handleSwipe({ 
    sidebar, 
    loadFunction, 
    closeFunction, 
    minSwipeDistance, 
    openSwipeCondition, 
    closeSwipeCondition, 
}) {
    let touchStartX = 0, touchStartY = 0;
    let touchEndX = 0, touchEndY = 0;

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
        const sidebarOpen = sidebar.classList.contains("show");

        if (Math.abs(swipeDistance) < minSwipeDistance) return;

        const sidebarRect = sidebar.getBoundingClientRect();
        const touchEndedInsideSidebar =
            sidebarOpen &&
            touchEndX >= sidebarRect.left &&
            touchEndX <= sidebarRect.right &&
            touchEndY >= sidebarRect.top &&
            touchEndY <= sidebarRect.bottom;

        if (touchEndedInsideSidebar) return;

        if (openSwipeCondition(swipeDistance, touchStartX, sidebarOpen)) {
            sidebar.classList.remove("hidden");
            sidebar.classList.add("show");
            loadFunction();
        } else if (closeSwipeCondition(swipeDistance, sidebarOpen)) {
            closeFunction();
        }
    });
}

// Shared function for hotkeys
export function initHotkey({
    key,
    modalIds = [],
    preventDefault = true,
    actions = [],
}) {
    document.addEventListener("keydown", (event) => {
        if (event.key !== key) return;

        const conditionsPassed = defaultConditions(modalIds)();
        if (!conditionsPassed) return;

        if (preventDefault) {
            event.preventDefault();
        }

        for (const action of actions) {
            action();
        }
    });
}

function defaultConditions(modalIds = []) {
    return () => {
        if (event.ctrlKey || event.metaKey || event.repeat) return false;
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return false;

        for (const modalId of modalIds) {
            const modal = document.getElementById(modalId);
            if (modal && !modal.classList.contains("hidden")) return false;
        }

        return true;
    };
}