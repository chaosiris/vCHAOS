# vCHAOS - Virtual Character for Home Assistant OS

**vCHAOS** (*Virtual Character for Home Assistant OS*) is a frontend web application designed for Home Assistant OS, offering an **interactive user interface** where users can control their smart home by communicating through a **configurable Live2D companion**.

In short, this project aims to **bridge the fundamental psychological gap** in the general home/voice assistant experience - by replacing the uncanny interactions with a faceless, nameless robotic entity with the comforting illusion that a virtual character is genuinely taking care of your smart home.

## **🌟 What Makes This Special?**  
In short, vCHAOS is a **progressive web app** designed to seamlessly integrate with the **Wyoming Protocol** based on **Home Assistant OS**. With vCHAOS, you can:  

- **Control your smart home from any browser** (*Chrome, Edge, Firefox, Safari*) on any device within your local network.  
- **Seamlessly integrate with your existing HAOS setup**, enhancing functionality without disrupting your current configuration.  
- **Ensure total privacy and security** by processing all data **locally** using **edge computing principles**, making it possible to eliminate reliance on any cloud services, depending on your setup.  

## **⚡ Features**
🔊 **Text & Voice-Based Communication**  
- Communicate with your local LLM seamlessly using **text input** or **voice push-to-talk** functionality from any device within your local network. This gives you the ability to interact with your HAOS voice assistant beyond a satellite device.

📜 **Chat History Management**  
- View and manage your chat history with advanced features such as search, archiving, and deletion of individual entries. Saving of chat history can be turned off for privacy purposes at any time.

💻 **Connected Clients List**  
- Easily monitor which devices are connected to your vCHAOS instance. If needed, you can remotely disconnect any device from the network, enforcing control and security over your setup.

🤖 **Customizable STT/LLM/TTS Models**
- Thanks to the Wyoming protocol, you can select and specify which models to use based on your needs.
  - Want to use a quantized, more efficient model? You can!
  - Need a model with larger parameters that can handle relatively complex requests? Certainly!
  - Want the TTS to sound like a specific character? Check out the [**PipeZ**](https://github.com/chaosiris/PipeZ) or [**TextyMcSpeechy**](https://github.com/domesticatedviking/TextyMcSpeechy) repositories for quick solutions to train your own Piper voice model! (*WSL2 or Linux required. Please always ensure ethical usage and collection of voice training data.*) 

🎨 **Live2D Model Compatibility**  
- Import and use any existing Live2D model effortlessly with plug-and-play support. Just extract the model folder in `/src/live2d_models`. From the settings, you can also switch seamlessly between Live2D models from a dropdown list corresponding to your `model_dict.json`. <br>You can **use or even design your very own Live2D model** of your favourite character, provided that it complies with **Live2D's Terms of Use**. 

💬 **Interactive Live2D Experience**  
- Make your Live2D model come alive through **idle animations** or **tap motions** as configured in their respective `*.model.json` files. Additionally,  **lip-sync** animations based on received outputs, making your virtual assistant feel more expressive and responsive.

✨ **Customizable Presets**  
- Set up a **shortcut list** of frequently used prompts (e.g. "turn off the lights in the living room") so you can quickly trigger actions with a single click or tap. This feature allows for extremely efficient and streamlined control over your smart home.

⚙️ **Flexible Settings Configuration**  
- Tailor the app to your preferences with a wide range of settings, which can be customized in the `settings.yaml` file, including:
  - **show-sent-prompts**: Choose whether or not to display the text prompt after sending it.  
  - **enable-idle-motion**: Enable or disable idle motion animations for the Live2D model.  
  - **enable-tap-motion**: Control whether tap gestures trigger animations or actions on the model.  
  - **enable-prompt-repeat**: Enable or disable the ability to resend or re-paste previous text/voice prompts.  
  - **enable-mouth-scaling**: Adjust the scaling of mouth movements based on spoken syllables, improving lip-sync accuracy.  
  - **enable-voice-input**: Turn on or off the voice-based Push to Talk feature.  
  - **save-chat-history**: Decide whether to store your chat history for future reference. Disable for privacy.  
  - **adaptive-background**: Automatically adjust the background based on the time of day.  
  - **timeout**: Set a custom timeout duration before cancelling the LLM response.

## **🎬 Demo**
<video width="600" controls>
  <source src="https://chaosiris.github.io/demo_github.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## **📦 Dependencies**
### **On Home Assistant OS Instance:**
- **Integrations:**
  - Whisper (*Wyoming Protocol*)  
  - Ollama (*Wyoming Protocol*)  
  - Piper (*Wyoming Protocol*)  
  - VLC-TELNET (*soft dependency; only needed if you lack a media player device*)

- **Webhook Automations:**
  - Ollama (*for prompt inputs*)  

### **On PC:**
- Python 3+ (*tested with Python 3.10*)  
- Any NVIDIA GPU (*Minimum 8GB VRAM recommended*)
- Ollama (*recommended to run on PC with an NVIDIA GPU for viable response times*)
- Docker (*for Whisper and Piper instances*)  
- Any modern browser with *JavaScript* and *WebGL* enabled

## **📥 Installation**
To be completed

## **🛠 How Does This Work?**
vCHAOS works by **"hijacking" the Wyoming Protocol pipeline** used in Home Assistant OS. It intercepts the audio and text prompts from Home Assistant and redirects them to the frontend interface instead of playing them on the satellite device.

### **💡 Standard Wyoming Protocol Pipeline:**
    Satellite Device (Audio Input) ➝ Faster-Whisper (STT) ➝ Ollama (LLM) ➝ Piper (TTS) ➝ Satellite Device (Audio Output)

### **🔄 Modified vCHAOS Pipeline:**
    Satellite Device / Frontend (Audio/Text Input) ➝ Faster-Whisper (STT) [Webhook for frontend audio] ➝ Ollama (LLM) [Webhook for frontend text] ➝ Piper (TTS) ➝ Satellite Device / Frontend* (Audio Output)
> *If web app is running. Otherwise, the output will still be played on the satellite device.

## **📌 High-Level Technical Overview**
### **🔹 Typical Wyoming Protocol Flow**
1. The user provides a **voice command** through a satellite device (*e.g., Home Assistant Voice PE, ESP32-Box-S3*).
2. The audio is processed through:
   - **Faster-Whisper** (*Speech-To-Text / STT*)
   - **Ollama** (*Language Model / LLM*)
   - **Piper** (*Text-To-Speech / TTS*).
3. The generated **audio output** is then played on the **satellite device**.

### **🔹 How vCHAOS Modifies the Pipeline**
- We integrate a modified `handler.py` inside the **Piper Docker instance**, which redirects the **output audio file** to a shared folder.
- Instead of playing the output audio on the satellite device, it gets **sent to the vCHAOS frontend**.
- **Webhooks** are used in **HAOS automations** to receive both **text and voice commands over HTTP(s)**.

## **🚧 Limitations & Future Roadmap**  

As you may have surmised from the section above, this approach is rather rudimentary and does not achieve the sophistication of a proper HAOS Integration, as it is essentially just redirecting the output the Wyoming Protocol pipeline (in particular, on the Piper Docker instance) to the frontend.

Therefore, this project really just serves as a **basic proof-of-concept** at this point in time, and I admittedly do not possess the expertise nor resources currently to optimize this to its fullest potential.  

However, with enough support and interest from the community, it is most definitely possible to bring this project forward and expand it into a full-fledged project (*maybe even turning into an official HAOS Integration someday*). Eventually, I also hope to be able to migrate the codebase onto the React/Vue.js + Flask frameworks to make the project more maintainable and extensible.

Please do feel free to contact me if you are **interested/have the technical expertise** to turn this project into something much bigger!  

> 💡 As always, any **pull requests/contributions** are welcome and greatly appreciated!

## **❓ FAQs**
To be completed

## **⚠️ Disclaimers**

To quote a popular saying in the cybersec field, **a chain is only as strong as its weakest link.**   
In the context of this project, your **IoT network is only as secure as its most vulnerable device.**  
For this reason, it is highly recommended to:
- **Host this application on a hardened Linux distro** with **regular updates**.
- **Use a properly firewalled router/VLAN** to segment your local network.
- Due to the likely possibility of **LLM hallucinations**, please **do not expose** any high-risk entities (relating to Health, Safety & Security) to Ollama via Assist (e.g. door locks or thermostats). This can be configured in your Ollama settings under HAOS Integrations.  
> In future updates, a **JSON GateKeeper** file should most definitely be implemented to mitigate LLM hallucinations, as seen and proposed in the Willow-based [**Lovey**](https://gitlab.com/hamishcunningham/lovey) home assistant system.

By using this app, you acknowledge that the app is provided "as is" and at your own risk. We do not accept any liability for any damages, losses, or issues arising from the use of this app. We are not liable for any direct, indirect, incidental, or consequential damages resulting from your use of the app.

This app is not a substitute for a real relationship. Black Mirror has warned us about this. Use wisely and always maintain a balance between the virtual and real world. /s

vCHAOS is not affiliated with Nabu Casa, Inc or the Open Home Foundation. Any use of their name or brand is purely for informational or descriptive purposes.

## **🎖 Special Acknowledgments**
A huge thank you to:
- **My supervisor and mentor**, for all his advice, expertise and support; and bringing up this brilliant topic relating to open source LLMs in the first place.
- **The creator of [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)**, which heavily inspired this project. Check out their amazing work as well if you would like a general purpose virtual character to talk to!
- **The developers and open source community** behind Home Assistant OS (Nabu Casa Inc. & the Open Home Foundation), Rhasspy, Faster-Whisper, Ollama, Piper, and PixiJS - all of whom made this project even remotely possible.

## **📜 Third Party Licenses**
### Live2D Sample Models Notice

This project includes Live2D sample models **(Shizuku (Cubism 2.1) and Haru (Cubism 4))** provided by Live2D Inc. These assets are licensed separately under the Live2D Free Material License Agreement and the Terms of Use for Live2D Cubism Sample Data. They are not covered by the MIT license of this project.

The Live2D simple models are owned and copyrighted by Live2D Inc. The sample data are utilized in accordance with the terms and conditions set by Live2D Inc. (See [**Live2D Free Material License Agreement**](https://www.live2d.jp/en/terms/live2d-free-material-license-agreement/) and [**Terms of Use**](https://www.live2d.com/eula/live2d-sample-model-terms_en.html)).

**Note:** For commercial use, especially by medium or large-scale enterprises, the use of these Live2D sample models may be subject to additional licensing requirements. If you plan to use this project commercially, please ensure that you have the appropriate permissions from Live2D Inc., or use versions of the project without these models.