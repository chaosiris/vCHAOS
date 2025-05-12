import { sendToBackend, initHotkey } from './common.js';

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

    // Variables
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let stream = null;
    window.lastInputVoice = "";

    // Functions
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
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer);
        
            const wavBlob = encodeWAV(audioBuffer);
            sendAudioToBackend(wavBlob);
        
            isRecording = false;
            voiceButton.style.color = "white";
        };
        
        // Frontend encoding function from .webm to .wav 
        function encodeWAV(audioBuffer) {
            const numChannels = 1;
            const sampleRate = audioBuffer.sampleRate;
            const format = 1; // PCM format
            const bitDepth = 16;
        
            const numFrames = audioBuffer.length;
            const buffer = new ArrayBuffer(44 + numFrames * numChannels * (bitDepth / 8));
            const view = new DataView(buffer);
        
            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
        
            writeString(view, 0, "RIFF");
            view.setUint32(4, 36 + numFrames * numChannels * (bitDepth / 8), true);
            writeString(view, 8, "WAVE");
            writeString(view, 12, "fmt ");
            view.setUint32(16, 16, true);
            view.setUint16(20, format, true);
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
            view.setUint16(32, numChannels * (bitDepth / 8), true);
            view.setUint16(34, bitDepth, true);
            writeString(view, 36, "data");
            view.setUint32(40, numFrames * numChannels * (bitDepth / 8), true);
        
            const floatData = audioBuffer.getChannelData(0);
            let offset = 44;
            for (let i = 0; i < numFrames; i++, offset += 2) {
                let sample = floatData[i] * 0x7FFF;
                view.setInt16(offset, sample, true);
            }
        
            return new Blob([buffer], { type: "audio/wav" });
        }

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

            await sendToBackend(result.transcription);

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

    // Event Listeners
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
    
    document.addEventListener("keyup", function (event) {
        if (event.key === " " || event.code === "Space") {
            stopRecording();
        }
    });

    initHotkey({
        key: " ",
        modalIds: ["historySidebar", "clientsModal", "settingsModal", "confirmationModal", "presetModal"],
        preventDefault: true,
        actions: [
            () => {
                const isRecording = false;
                if (!isRecording) {
                    startRecording();
                }
            },
        ],
    });    
})();
