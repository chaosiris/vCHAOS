var app, model2;
var socket;
var modelLoaded = false;
let manualDisconnect = false;

// Idle Motion Variables
let isSpeaking = false;
let idleLoopTimeout = null;
let modelDefaultParams = {};

// Lip Sync Variables
const mouthParamNames = [
    "ParamMouthOpenY",
    "ParamMouthOpen",
    "PARAM_MOUTH_OPEN_Y",
]; // Add more to the list if necessary/using custom param name
let mouthParamId = null;
let mouthParamMax = 1;
let mouthParamMin = 0;

// Audio Player Variables
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSourceNode = null;
let analyser = null;
let dataArray = null;
let audioPlayer = document.getElementById("audioPlayer");

// Live2D initialization
const live2dModule = (function() {
    const live2d = PIXI.live2d;

    async function init() {
        app = new PIXI.Application({
            view: document.getElementById("canvas"),
            autoStart: true,
            autoDensity: true,
            antiAlias: true,
            resizeTo: window,
            transparent: true,
            backgroundAlpha: 0,
        });
    }

    async function loadModel(modelInfo) {
        console.log("Loading Live2D model:", modelInfo.url);

        if (model2) {
            app.stage.removeChild(model2);
        }

        try {
            model2 = await live2d.Live2DModel.from(modelInfo.url);
            app.stage.addChild(model2);

            model2.scale.set(modelInfo.kScale || 0.2);
            model2.anchor.set(0.5, 0.5);
            model2.position.set(
                (app.view.width / 2) + (modelInfo.xOffset || 0),
                (app.view.height / 2) + (modelInfo.yOffset || 0)
            );

            // Clear pre-configured idle motion (if defined)
            model2.internalModel.motionManager.groups.idle = null;

            if (!window.appSettings["enable-idle-motion"]) {
                enableHeadTracking(model2);
            }

            enablePointerEvents(model2, modelInfo.idleMotion, modelInfo.idleMotionCount, modelInfo.tapMotion, modelInfo.tapMotionCount);

            mouthParamId = getMouthOpenParam(model2);
            if (mouthParamId) {
                let params = model2.internalModel.coreModel;
                let paramIndex = params._parameterIds.indexOf(mouthParamId);
                if (paramIndex !== -1) {
                    mouthParamMin = params._parameterMinimumValues[paramIndex];
                    mouthParamMax = params._parameterMaximumValues[paramIndex];
                }
            }

            modelLoaded = true;
            console.log("Live2D model loaded successfully!");
            if (window.appSettings["enable-idle-motion"]) {
                const randomIndex = modelInfo.idleMotionCount === 1 ? 0 : Math.floor(Math.random() * modelInfo.idleMotionCount);
                setTimeout(() => modelMotionController.loopIdle(modelInfo.idleMotion, randomIndex), 10);
                setTimeout(() => {
                    modelMotionController.captureDefaultPose();
                }, 1000);  // Delay capture by 1 second to ensure complete loading of animation
            }
        
        } catch (error) {
            console.error("Error loading Live2D model:", error);
        }
    }

    return {
        init,
        loadModel
    };
})();

// Model motion controller class
const modelMotionController = {
    stopAll() {
        model2?.internalModel?.motionManager?.stopAllMotions();
        clearTimeout(idleLoopTimeout);
    },

    loopIdle(idleMotion = "idle", randomIndex = 0, interval = 1000) {
        if (!isSpeaking && model2 && window.appSettings["enable-idle-motion"]) {
            model2.motion(idleMotion, randomIndex);
            idleLoopTimeout = setTimeout(() => this.loopIdle(idleMotion, randomIndex, interval), interval);
        }
    },

    captureDefaultPose() {
        const core = model2?.internalModel?.coreModel;
        if (!core) return;

        modelDefaultParams = {};
        core._parameterIds.forEach(id => {
            modelDefaultParams[id] = core.getParameterValueById(id);
        });
    },

    resetToDefaultPose() {
        const core = model2?.internalModel?.coreModel;
        if (!core || !modelDefaultParams) return;

        for (const id in modelDefaultParams) {
            core.setParameterValueById(id, modelDefaultParams[id]);
        }
    },

    tapMotion(tapMotion = "tap", tapMotionCount = 0) {
        if (model2 && model2.internalModel) {
            const randomIndex = tapMotionCount === 1 ? 0 : Math.floor(Math.random() * tapMotionCount);
            this.stopAll();
            model2.motion(tapMotion, randomIndex);
        }
    }
};

// Model interaction functions
function enableHeadTracking(model) {
    if (!model || !model.internalModel) return;

    let focusX = 0, focusY = 0;
    let targetX = 0, targetY = 0;
    let velocityX = 0, velocityY = 0;
    const smoothFactor = 0.08;
    const accelerationFactor = 1;

    model.interactive = true;
    model.on("pointermove", (event) => {
        targetX = (event.data.global.x / window.innerWidth) * 2 - 1;
        targetY = (event.data.global.y / window.innerHeight) * 2 - 1;
    });

    function updateHeadMovement() {
        const dx = targetX - focusX;
        const dy = targetY - focusY;

        velocityX += dx * accelerationFactor;
        velocityY += dy * accelerationFactor;

        velocityX *= smoothFactor;
        velocityY *= smoothFactor;

        focusX += velocityX * 16;
        focusY += velocityY * 16;

        if (typeof model.internalModel.coreModel.setParameterValueById === "function") {
            model.internalModel.coreModel.setParameterValueById("ParamAngleX", focusX * 30);
            model.internalModel.coreModel.setParameterValueById("ParamAngleY", focusY * -30);
        } else {
            model.internalModel.coreModel.setParamFloat("ParamAngleX", focusX * 30);
            model.internalModel.coreModel.setParamFloat("ParamAngleY", focusY * -30);
        }

        requestAnimationFrame(updateHeadMovement);
    }

    updateHeadMovement();
}

function enablePointerEvents(model, idleMotion, idleMotionCount, tapMotion, tapMotionCount) {
    let isDrag = false;
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
            isDrag = true;
        }
    });

    model.on("pointerup", () => {
        model.dragging = false;
        if (!model.dragging && window.appSettings["enable-tap-motion"] && 
            !isDrag && !presetSidebar.classList.contains("show") && !historySidebar.classList.contains("show")) {
            modelMotionController.tapMotion(tapMotion, tapMotionCount);

            // Resume idle motion
            const checkMotionInterval = setInterval(() => {
                if (!model2?.internalModel?.motionState?.isActive(tapMotion, tapMotionCount)) {
                    const randomIndex = idleMotionCount === 1 ? 0 : Math.floor(Math.random() * idleMotionCount);
                    clearInterval(checkMotionInterval);
                    modelMotionController.loopIdle(idleMotion, randomIndex);
                }
            }, 100);
        }
        isDrag = false;
    });

    model.on("pointerupoutside", () => {
        model.dragging = false;
    });
}

// Main WebSocket function
function connectWebSocket() {
    if (manualDisconnect) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    socket = new WebSocket(wsProtocol + window.location.hostname + ":11405/ws");
    var wsStatus = document.getElementById("wsStatus");

    socket.onopen = function () {
        wsStatus.textContent = "Connected";
        wsStatus.classList.remove("disconnected");
        wsStatus.classList.add("connected");
        if (window.appSettings["adaptive-background"]) {
            document.dispatchEvent(new Event("backgroundUpdate"));
        }

        if (!modelLoaded) {
            (async () => {
                const selectedName = window.appSettings["model-name"];
                try {
                    const modelList = await fetch("/api/get_models").then(res => res.json());
                    const selectedModel = modelList.find(m => m.name === selectedName);
    
                    if (selectedModel) {
                        live2dModule.loadModel({
                            url: selectedModel.file_path,
                            kScale: selectedModel.kScale,
                            xOffset: selectedModel.xOffset,
                            yOffset: selectedModel.yOffset,
                            idleMotion: selectedModel.idleMotion,
                            idleMotionCount: selectedModel.idleMotionCount,
                            tapMotion: selectedModel.tapMotion,
                            tapMotionCount: selectedModel.tapMotionCount
                        });
                    } else {
                        console.error(`Model '${selectedName}' not found in model list.`);
                    }
                } catch (err) {
                    console.error("Error loading model list:", err);
                }
            })();
        }
    };

    socket.onclose = function () {
        wsStatus.textContent = "Disconnected";
        wsStatus.classList.remove("connected");
        wsStatus.classList.add("disconnected");

        if (!manualDisconnect) {
            setTimeout(connectWebSocket, 5000);
        } else {
            wsStatus.textContent = "Manually Disconnected";
        }
    };

    socket.onerror = function (error) {
        console.error("WebSocket error:", error);
    };

    socket.onmessage = function (event) {

        if (event.data === "ping") {
            return;
        }

        if (event.data === "disconnect_client") {
            manualDisconnect = true;
            disconnectWebSocket();
            return;
        }

        let data;
        try {
            if (event.data.startsWith("{") || event.data.startsWith("[")) {
                data = JSON.parse(event.data);
            } else {
                throw new Error("Received non-JSON message: " + event.data);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
            return;
        }

        if (data.type === "new_audio") {
            var textOutput = document.getElementById("textOutput");

            if (!textOutput) {
                console.error("Missing text output element.");
                updateStatus("error")
                return;
            }

            var audioFilePath = window.location.origin + data.audio_file;
            var textFilePath = audioFilePath.replace(".wav", ".txt");
            let textContent = '';

            fetch(textFilePath)
                .then(response => response.ok ? response.text() : Promise.reject("Text file not found"))
                .then(text => {
                    textContent = text;
                    return fetch(audioFilePath);
                })
                .then(response => response.ok ? response.blob() : Promise.reject("Audio file not found"))
                .then(blob => {
                    let audioUrl = URL.createObjectURL(blob);

                    const textPrefix = document.getElementById("textDisplay").querySelector("strong");
                    textPrefix.textContent = "Latest Response:";
                    textPrefix.style.removeProperty("color");
                    textOutput.innerText = textContent;
                    document.getElementById("fixedBottom").scrollTop = 0;

                    if (!historySidebar.classList.contains("hidden")) {
                        document.dispatchEvent(new Event("chatHistoryUpdate"));
                    }

                    playAudioLipSync(audioUrl);
                    updateStatus("received");

                    if (!window.appSettings["save-chat-history"]) {
                        var fileIdMatch = audioFilePath.match(/(\d{19})/);
                        var fileId = fileIdMatch[0];
                        socket.send(`ack:${fileId}`);
                    }
                })
                .catch(error => {
                    console.error("Failed to load files:", error);
                    textOutput.innerText = "No text response provided by LLM. Please check your connection or try resending your prompt!";
                    textOutput.innerText += "\nError message: " + error;
                });
        }
    };
}

function disconnectWebSocket() {
    if (socket) {
        console.log("This client's WebSocket has been manually and permanently disconnected. Please refresh to reconnect.");
        socket.close(1000);
    }
}

// Lip sync functions
function playAudioLipSync(audioUrl) {
    if (!model2) return console.error("Live2D model not loaded.");

    if (window.appSettings["enable-idle-motion"]) {
        isSpeaking = true;
        modelMotionController.stopAll();
        modelMotionController.resetToDefaultPose();
    }

    let audioSource = document.getElementById("audioSource");
    if (!audioPlayer || !audioSource) return console.error("Audio elements missing.");

    if (audioPlayer.src !== audioUrl) {
        audioSource.src = audioUrl;
        audioPlayer.load();
    }
    audioPlayer.paused && audioPlayer.play().catch(error => console.error("Audio playback error:", error));

    if (!audioSourceNode) {
        audioSourceNode = audioContext.createMediaElementSource(audioPlayer);
        analyser = audioContext.createAnalyser();
        audioSourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 512;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    function animateMouth() {
        if (!analyser || !mouthParamId) return;

        const startFreq = Math.floor(85 / (audioContext.sampleRate / analyser.fftSize));
        const endFreq = Math.floor(255 / (audioContext.sampleRate / analyser.fftSize));

        analyser.getByteFrequencyData(dataArray);
        const maxEnergy = Math.max(...dataArray.slice(startFreq, endFreq));
        const mouthMovement = window.appSettings["enable-mouth-scaling"]
            ? mouthParamMin + Math.pow(Math.max(0, Math.min(1, maxEnergy / 255)), 1.2) * (mouthParamMax - mouthParamMin)
            : mouthParamMax;

        const setMouthParam = (value) => {
            if (typeof model2.internalModel.coreModel.setParameterValueById === "function") {
                model2.internalModel.coreModel.setParameterValueById(mouthParamId, value);
            } else {
                model2.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", value);
            }
        };

        setMouthParam(mouthMovement);

        if (!audioPlayer.paused) {
            requestAnimationFrame(animateMouth);
        } else {
            setMouthParam(0);
            if (window.appSettings["enable-idle-motion"]) {
                isSpeaking = false;
                setTimeout(() => modelMotionController.loopIdle(), 3000);
            }
        }
    }

    requestAnimationFrame(animateMouth);
}

function getMouthOpenParam(model) {
    if (!model || !model.internalModel || !model.internalModel.coreModel) {
        console.warn("Model is not fully initialized.");
        return null;
    }

    let allParams = model.internalModel.coreModel._parameterIds || model.internalModel.coreModel.parameters.ids;
    let detectedParam = allParams.find(param =>
        mouthParamNames.some(listParam => param.toLowerCase() === listParam.toLowerCase())
    );
    return detectedParam || "ParamMouthOpenY";
}

// Event Listeners
audioPlayer.addEventListener("play", function () {
    playAudioLipSync(audioPlayer.src);
});

audioPlayer.addEventListener("seeked", function () {
    playAudioLipSync(audioPlayer.src);
});

// Fix orientation/zoom-in issues on mobile
document.addEventListener('gesturestart', function (event) {
    event.preventDefault();
});

let lastTouchEnd = 0;
document.addEventListener("touchend", function (event) {
    const now = Date.now();

    // If tapping inside the history and preset list, allow double-tap
    if (event.target.closest("#historyList, #presetList")) {
        return;
    }

    if (now - lastTouchEnd <= 300) {
        if (event.cancelable) {
            event.preventDefault();
        }
    }

    lastTouchEnd = now;
}, { passive: false });

window.addEventListener("orientationchange", function () {
    document.documentElement.style.zoom = "1";
    setTimeout(() => {
        document.documentElement.style.zoom = "1";
    }, 200);
});

// Ensure audio playing is enabled upon user interaction due to browser restrictions
document.addEventListener("click", () => {
    audioContext.resume().catch(error => {
        console.error("Error resuming AudioContext:", error);
    });
});

let scrollInterval = null;
let scrollTimeout = null;
document.getElementById("autoScrollButton").addEventListener("click", function () {
    const scrollContainer = document.getElementById("fixedBottom");

    if (this.innerText === "▶️") {
        this.innerText = "⏸";

        if (scrollInterval) {
            clearInterval(scrollInterval);
        }

        scrollInterval = setInterval(() => {
            scrollContainer.scrollTop += 1;
        }, 30);
        
    } else {
        this.innerText = "▶️";

        clearInterval(scrollInterval);
        scrollInterval = null;
    }
});

function scrollToPosition(position) {
    const autoScrollButton = document.getElementById('autoScrollButton');
    const scrollContainer = document.getElementById('fixedBottom');

    if (autoScrollButton.innerText === '⏸') {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }

    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }

    scrollContainer.scrollTo({ top: position, behavior: 'smooth' });

    if (autoScrollButton.innerText === '⏸') {
        scrollTimeout = setTimeout(() => {
            scrollInterval = setInterval(() => {
                scrollContainer.scrollTop += 1;
            }, 30);
        }, 500);
    }
}

document.getElementById('scrollTopButton').addEventListener('click', function () {
    scrollToPosition(0);
});

document.getElementById('scrollTopButton').addEventListener('dblclick', function () {
    const scrollContainer = document.getElementById('fixedBottom');
    scrollToPosition(scrollContainer.scrollHeight);
});

// Begin app initialization
async function initializeApp() {
    while (!window.appSettings || Object.keys(window.appSettings).length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure settings are loaded first
    }
    live2dModule.init();
    connectWebSocket();
}

initializeApp();