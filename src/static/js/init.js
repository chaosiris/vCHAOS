var app, model2;
var socket;
var modelLoaded = false;

// Load Live2D model
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
        }
    };
}

function initializeApp() {
    live2dModule.init();
    connectWebSocket();
}

initializeApp();