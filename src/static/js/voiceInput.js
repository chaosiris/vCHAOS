(async function () {
    while (!window.appSettings || Object.keys(window.appSettings).length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure settings are loaded first
    }

    const voiceButton = document.getElementById("voiceButton");
    if (window.appSettings["enable-voice-input"]) {
        if (voiceButton) voiceButton.style.display = "";
    } else {
        return;
    }

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let stream = null;
    window.lastInputVoice = "";

    voiceButton.addEventListener("pointerdown", (e) => {
        e.preventDefault();

        requestAnimationFrame(() => {
            startRecording();

            const stop = () => {
                stopRecording();
                window.removeEventListener("pointerup", stop);
                window.removeEventListener("pointercancel", stop);
            };

            window.addEventListener("pointerup", stop);
            window.addEventListener("pointercancel", stop);
        });
    });

    document.addEventListener("keydown", function (event) {
        if (event.repeat || event.ctrlKey || event.metaKey || isRecording) return;
        if (event.key !== " " && event.code !== "Space") return;
    
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
    
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
    
        event.preventDefault();
        startRecording();
    });
    
    document.addEventListener("keyup", function (event) {
        if (event.key === " " || event.code === "Space") {
            stopRecording();
        }
    });

    async function startRecording() {
        if (isRecording) return;

        try {
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (error) {
            console.error("Microphone access denied:", error);
            if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                alert("Microphone access is blocked. Please enable in your browser settings.");
            }
            voiceButton.disabled = true;
            return;
        }

        isRecording = true;
        audioChunks = [];
        voiceButton.style.color = "red";

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async function () {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            sendAudioToBackend(audioBlob);
            isRecording = false;
            voiceButton.style.color = "white";
        };

        mediaRecorder.start();
        updateStatus("listening");
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            updateStatus("idle");
        }
    }

    async function sendAudioToBackend(audioBlob) {
        if (audioBlob.size === 0) return;

        const formData = new FormData();
        formData.append("audio", audioBlob, "voice_input.wav");
        updateStatus("transcribing");

        try {
            const response = await fetch("/api/send_voice", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                updateStatus("error");
                return;
            }

            await window.sendToBackend(result.transcription);

            if (window.appSettings["enable-prompt-repeat"]) {
                window.lastInputVoice = result.transcription;
                const repeatButton = document.getElementById("repeatButton");
                if (repeatButton) {
                    repeatButton.classList.remove("hidden");
                    repeatButton.onclick = () => {
                        window.sendToBackend(window.lastInputVoice);
                    };
                }
            }
        } catch {
            updateStatus("error");
        }
    }
})();
