var app, model2;
var socket;
var modelLoaded = false;
let manualDisconnect = false;

// Idle Motion Variables
let isSpeaking = false;
let idleLoopTimeout = null;
let modelDefaultParams = {};

// Audio Player Variables
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSourceNode = null;
let analyser = null;
let dataArray = null;
let mouthParamId = null;
let mouthParamMax = 1;
let mouthParamMin = 0;
let audioPlayer = document.getElementById("audioPlayer");

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

            if (!window.appSettings["enable-idle-motion"]) {
                enableHeadTracking(model2);
            }

            enablePointerEvents(model2, modelInfo.idleMotionName, modelInfo.idleMotionCount, modelInfo.tapMotionName, modelInfo.tapMotionCount);

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
                modelMotionController.captureDefaultPose();
            }
        
        } catch (error) {
            console.error("Error loading Live2D model:", error);
        }
    }
    
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
    
            model.internalModel.coreModel.setParameterValueById("ParamAngleX", focusX * 30);
            model.internalModel.coreModel.setParameterValueById("ParamAngleY", focusY * -30);
    
            requestAnimationFrame(updateHeadMovement);
        }

        updateHeadMovement();
    }

    function enablePointerEvents(model, idleMotionName, idleMotionCount, tapMotionName, tapMotionCount) {
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
            if (!model.dragging && window.appSettings["enable-tap-motion"] && !isDrag) {
                modelMotionController.tapMotion(tapMotionName, tapMotionCount);

                // Resume idle motion
                const checkMotionInterval = setInterval(() => {
                    if (!model2?.internalModel?.motionState?.isActive(tapMotionName, tapMotionCount)) {
                        const randomIndex = idleMotionCount === 1 ? 0 : Math.floor(Math.random() * idleMotionCount);
                        clearInterval(checkMotionInterval);
                        modelMotionController.loopIdle(idleMotionName, randomIndex);
                    }
                }, 100);
            }
            isDrag = false;
        });
    
        model.on("pointerupoutside", () => {
            model.dragging = false;
        });
    }

    return {
        init,
        loadModel
    };
})();

const modelMotionController = {
    stopAll() {
        model2?.internalModel?.motionManager?.stopAllMotions();
        clearTimeout(idleLoopTimeout);
    },

    loopIdle(idleMotionName = "idle", randomIndex = 0, interval = 1000) {
        if (!isSpeaking && model2 && window.appSettings["enable-idle-motion"]) {
            model2.motion(idleMotionName, randomIndex);
            idleLoopTimeout = setTimeout(() => this.loopIdle(idleMotionName, randomIndex, interval), interval);
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

    tapMotion(tapMotionName = "tap", tapMotionCount = 0) {
        if (model2 && model2.internalModel) {
            const randomIndex = tapMotionCount === 1 ? 0 : Math.floor(Math.random() * count);
            this.stopAll();
            model2.motion(tapMotionName, randomIndex);
        }
    }
};

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
            console.log("Received forced disconnect from server.");
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

            fetch(textFilePath)
                .then(response => response.ok ? response.text() : Promise.reject("Text file not found"))
                .then(text => {
                    textContent = text;
                    return fetch(audioFilePath);
                })
                .then(response => response.ok ? response.blob() : Promise.reject("Audio file not found"))
                .then(blob => {
                    audioUrl = URL.createObjectURL(blob);

                    const textPrefix = document.getElementById("textDisplay").querySelector("strong");
                    textPrefix.textContent = "Latest Response:";
                    textPrefix.style.removeProperty("color");
                    textOutput.innerText = textContent;
                    document.getElementById("textDisplay").scrollTop = 0;

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
                });
        }
    };
}

function disconnectWebSocket() {
    if (socket) {
        console.log("Manually disconnecting WebSocket.");
        socket.close(1000);
    }
}

function playAudioLipSync(audioUrl) {
    if (!model2) {
        console.error("Live2D model not loaded. Cannot play animation.");
        return;
    }

    // Stop idle motion and reset to default state
    if (window.appSettings["enable-idle-motion"]) {
        isSpeaking = true;
        modelMotionController.stopAll();
        modelMotionController.resetToDefaultPose();
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
        if (!analyser || !mouthParamId) return;

        let mouthMovement = 0;
        if (window.appSettings["enable-mouth-scaling"]) {
            analyser.getByteFrequencyData(dataArray);
    
            let startFreq = Math.floor(85 / (audioContext.sampleRate / analyser.fftSize));
            let endFreq = Math.floor(255 / (audioContext.sampleRate / analyser.fftSize));
        
            let maxEnergy = 0;
        
            for (let i = startFreq; i < endFreq; i++) {
                if (dataArray[i] > maxEnergy) {
                    maxEnergy = dataArray[i];
                }
            }

            mouthMovement = mouthParamMin + (Math.pow(Math.max(0, Math.min(1, maxEnergy / 255)), 1.2) * (mouthParamMax - mouthParamMin));
        } else {
            mouthMovement = mouthParamMax;
        }
    
        requestAnimationFrame(() => {
            if (typeof model2.internalModel.coreModel.setParameterValueById === "function") {
                model2.internalModel.coreModel.setParameterValueById(mouthParamId, mouthMovement);
            } else {
                model2.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", mouthMovement);
            }
        });
    
        if (!audioPlayer.paused) {
            requestAnimationFrame(animateMouth);
        } else {
            requestAnimationFrame(() => {
                if (typeof model2.internalModel.coreModel.setParameterValueById === "function") {
                    model2.internalModel.coreModel.setParameterValueById(mouthParamId, 0);
                } else {
                    model2.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", 0);
                }
            });
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
    let detectedParam = allParams.find(param => param.startsWith("ParamMouthOpenY")) || 
                        allParams.find(param => param.startsWith("ParamMouthOpen"));
    return detectedParam || "ParamMouthOpenY";
}

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
    audioContext.resume().then(() => {
        console.log("AudioContext resumed successfully.");
    }).catch(error => {
        console.error("Error resuming AudioContext:", error);
    });
});

async function initializeApp() {
    while (!window.appSettings || Object.keys(window.appSettings).length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure settings are loaded first
    }
    live2dModule.init();
    connectWebSocket();
}

initializeApp();