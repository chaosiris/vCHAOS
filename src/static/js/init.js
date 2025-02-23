var app, model2;
var socket;
var modelLoaded = false;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSourceNode = null;
let analyser = null;
let dataArray = null;
let audioPlayer = document.getElementById("audioPlayer");

// Ensure audio playing is enabled upon user interaction due to browser restrictions
document.addEventListener("click", function () {
    if (audioContext.state === "suspended") {
        audioContext.resume();
        console.log("AudioContext resumed.");
    }
});

const live2dModule = (function() {
    const live2d = PIXI.live2d;

    async function init() {
        app = new PIXI.Application({
            view: document.getElementById("canvas"),
            autoStart: true,
            autoDensity: true,
            resizeTo: window,
            transparent: true,
            backgroundAlpha: 0,
        });
    
        function loopMotion() {
            if (model2) {
                model2.motion("", 0);
                setTimeout(loopMotion, 2000);
            }
        }
    
        setTimeout(loopMotion, 1000);
    }

    async function loadModel(modelInfo) {
        console.log("Loading Live2D model:", modelInfo.url);

        if (model2) {
            app.stage.removeChild(model2);
        }

        try {
            model2 = await live2d.Live2DModel.from(modelInfo.url);
            app.stage.addChild(model2);

            model2.scale.set(modelInfo.kScale || 0.4);
            model2.anchor.set(0.5, 0.5);
            model2.position.set(app.view.width / 2, app.view.height / 2);

            draggable(model2);

            modelLoaded = true;
            console.log("Live2D model loaded successfully!");
        } catch (error) {
            console.error("Error loading Live2D model:", error);
        }
    }

    function draggable(model) {
        model.buttonMode = true;
        model.on("pointerdown", (e) => {
            model.dragging = true;
            model._pointerX = e.data.global.x - model.x;
            model._pointerY = e.data.global.y - model.y;
        });

        model.on("pointermove", (e) => {
            if (model.dragging) {
                model.position.x = e.data.global.x - model._pointerX;
                model.position.y = e.data.global.y - model._pointerY;
            }
        });

        model.on("pointerupoutside", () => (model.dragging = false));
        model.on("pointerup", () => (model.dragging = false));
    }

    return {
        init,
        loadModel
    };
})();

function connectWebSocket() {
    socket = new WebSocket("ws://" + window.location.hostname + ":11405/ws");
    var wsStatus = document.getElementById("wsStatus");

    socket.onopen = function () {
        wsStatus.textContent = "Connected";
        wsStatus.classList.remove("disconnected");
        wsStatus.classList.add("connected");

        if (!modelLoaded) {
            live2dModule.loadModel({
                url: "/live2d_models/test/test.model3.json",
                kScale: 0.3
            });
        }
    };

    socket.onclose = function () {
        wsStatus.textContent = "Disconnected";
        wsStatus.classList.remove("connected");
        wsStatus.classList.add("disconnected");

        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = function (error) {
        console.error("WebSocket error:", error);
    };

    socket.onmessage = function (event) {
        console.log("WebSocket message received:", event.data);

        var data;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
            return;
        }

        if (data.type === "new_audio") {
            console.log("New audio received:", data.audio_file);

            var textOutput = document.getElementById("textOutput");

            if (!textOutput) {
                console.error("Missing text output element.");
                return;
            }

            var audioFilePath = window.location.origin + data.audio_file;
            console.log("Fetching audio file:", audioFilePath);

            var textFilePath = audioFilePath.replace(".wav", ".txt");
            console.log("Fetching text from:", textFilePath);

            fetch(textFilePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Text file not found");
                    }
                    return response.text();
                })
                .then(text => {
                    textOutput.innerText = text;
                    console.log("Updated text output:", text);
                })
                .catch(error => {
                    console.error("Failed to load text file:", error);
                    textOutput.innerText = "No text available.";
                });

            playAudioLipSync(audioFilePath);
        }
    };
}

function playAudioLipSync(audioUrl) {
    if (!model2) {
        console.error("Live2D model not loaded. Cannot play animation.");
        return;
    }

    let audioSource = document.getElementById("audioSource");

    if (!audioPlayer || !audioSource) {
        console.error("Audio elements missing.");
        return;
    }

    if (audioPlayer.src !== audioUrl) {
        audioSource.src = audioUrl;
        audioPlayer.load();
    }

    if (audioPlayer.paused) {
        audioPlayer.play().catch(error => console.error("Audio playback error:", error));
    }

    if (!audioSourceNode) {
        audioSourceNode = audioContext.createMediaElementSource(audioPlayer);
        analyser = audioContext.createAnalyser();

        audioSourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 512;

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }

    function animateMouth() {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        let average = sum / dataArray.length;
        let mouthMovement = Math.min(1, average / 32);

        if (typeof model2.internalModel.coreModel.setParameterValueById === "function") {
            model2.internalModel.coreModel.setParameterValueById("ParamMouthOpenY", mouthMovement);
        } else {
            model2.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", mouthMovement);
        }

        if (!audioPlayer.paused) {
            requestAnimationFrame(animateMouth);
        } else {
            if (typeof model2.internalModel.coreModel.setParameterValueById === "function") {
                model2.internalModel.coreModel.setParameterValueById("ParamMouthOpenY", 0);
            } else {
                model2.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", 0);
            }
        }
    }

    requestAnimationFrame(animateMouth);
}

audioPlayer.addEventListener("play", function () {
    playAudioLipSync(audioPlayer.src);
});

audioPlayer.addEventListener("seeked", function () {
    playAudioLipSync(audioPlayer.src);
});

document.addEventListener("touchstart", function () {
    if (audioContext.state === "suspended") {
        audioContext.resume().then(() => {
            console.log("AudioContext resumed on mobile.");
        });
    }
}, { passive: true });

function initializeApp() {
    live2dModule.init();
    connectWebSocket();
}

document.addEventListener("click", () => {
    audioContext.resume().then(() => {
        console.log("AudioContext resumed successfully.");
    }).catch(error => {
        console.error("Error resuming AudioContext:", error);
    });
});

initializeApp();
