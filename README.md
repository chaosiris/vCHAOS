# vCHAOS - Virtual Character for Home Assistant OS

**vCHAOS** (*Virtual Character for Home Assistant OS*) is a frontend web application designed for Home Assistant OS, offering an **interactive user interface** where users can control their smart home by communicating through a **configurable Live2D companion**.

In short, this project aims to **bridge the fundamental psychological gap** in the general home/voice assistant experience - by replacing the uncanny interactions with a faceless, nameless robotic entity with the comforting illusion that a virtual character is genuinely taking care of your smart home.

## **✨ What Makes This Special?**  
vCHAOS is a **progressive web app** designed to seamlessly integrate with the **Wyoming Protocol** based on **Home Assistant OS**. With vCHAOS, you can:  

- **Control your smart home from any browser** (*Chrome, Edge, Firefox, Safari*) on any device within your local network.  
- **Seamlessly integrate with your existing HAOS setup**, enhancing functionality without disrupting your current configuration.  
- **Ensure total privacy and security** by processing all data **locally** using **edge computing principles**, eliminating reliance on any cloud services (*depending on your setup*).  

## **🛠 How Does This Work?**
vCHAOS works by **"hijacking" the Wyoming Protocol pipeline** used in Home Assistant OS. It intercepts the **audio and text prompts** from Home Assistant and redirects them to the frontend interface instead of playing them on the satellite device.

### **💡 Standard Wyoming Protocol Pipeline:**
- Satellite Device (Audio Input) ➝ Faster-Whisper (STT) ➝ Ollama (LLM) ➝ Piper (TTS) ➝ Satellite Device (Audio Output)

### **🔄 Modified vCHAOS Pipeline:**
- Satellite Device / Frontend (Audio/Text Input) ➝ Faster-Whisper (STT) [Webhook for frontend audio] ➝ Ollama (LLM) [Webhook for frontend text] ➝ Piper (TTS) ➝ Satellite Device / Frontend* (Audio Output)
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

As you may have noticed from the section above, this approach is rather rudimentary and does not achieve the sophistication of a proper **HAOS Integration**, as it is essentially just "hijacking" the Wyoming Protocol pipeline (in particular, on the Piper Docker instance) and redirecting its outputs.  

Hence, this project really just serves as a **basic proof-of-concept** at this point in time, and I admittedly do not possess the **expertise nor resources** currently to optimize this to its fullest potential.  

However, with **enough support and interest from the community**, it is most definitely possible to bring this project forward and expand it into a **full-fledged project** (*maybe even turning into an official HAOS Integration someday?*).  

Please do feel free to contact me if you are **interested/have the technical expertise** to turn this project into something much bigger!  

> 💡 **As always, any pull requests/contributions are welcome and greatly appreciated!** 

## **🎬 Demo**
To be completed

## **📦 Dependencies**
### **On Home Assistant OS Instance:**
- **Integrations:**
  - Whisper (*Wyoming Protocol*)  
  - Ollama (*Wyoming Protocol*)  
  - Piper (*Wyoming Protocol*)  
  - VLC-TELNET (*soft dependency; only needed if you lack a media player*)

- **Webhook Automations:**
  - Ollama (*for text prompts*)  
  - Whisper (*for voice prompts*)

### **On PC:**
- Python 3+ (*tested with Python 3.10*)  
- Any NVIDIA GPU (*Minimum 8GB VRAM recommended*)
- Ollama (*recommended to run on PC for optimal response times* )
- Docker (*for Whisper and Piper instances*)  
- Any modern browser with *JavaScript* and *WebGL* enabled

## **📥 Installation**
To be completed

## **❓ FAQs**
To be completed

## **⚠️ Disclaimers**

To quote a popular saying in the cybersec field, **a chain is only as strong as its weakest link.**   
In the context of this project, your **IoT network is only as secure as its most vulnerable device.**  
For this reason, it is highly recommended to:
- **Host this application on a hardened Linux distro** with **regular updates**.
- **Use a properly firewalled router/VLAN** to segment your local network.
- Due to the likely possibility of **LLM hallucinations**, please **do not expose** any high-risk entities (relating to Health & Safety) to Ollama via Assist (e.g. door locks or thermostats). This can be configured in your Ollama settings under HAOS Integrations.  
> In future updates, perhaps a **JSON GateKeeper** file can be implemented to mitigate LLM hallucinations, as seen and proposed in the Willow-based Lovey home assistant system.

By using this app, you acknowledge that the app is provided "as is" and at your own risk. We do not accept any liability for any damages, losses, or issues arising from the use of this app. We are not liable for any direct, indirect, incidental, or consequential damages resulting from your use of the app.

This app is not a substitute for a real relationship. Black Mirror has warned us about this. Use wisely and always maintain a balance between the virtual and real world. /s

vCHAOS is not affiliated with Nabu Casa, Inc or the Open Home Foundation. Any use of their name or brand is purely for informational or descriptive purposes.

## **🎖 Special Acknowledgments**
A huge thank you to:
- **My supervisor and mentor**, for all his advice, expertise and support; and bringing up this brilliant topic relating to open source LLMs in the first place.
- **The creator of [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)**, which heavily inspired this project. Check out their amazing work as well if you would like a general purpose virtual character to talk to!
- **The developers and open source community** behind **Home Assistant OS (Nabu Casa Inc. & the Open Home Foundation), Faster-Whisper, Ollama, Piper, and PixiJS** - all of whom made this project even remotely possible.

## **📜 Third Party Licenses**
### Live2D Sample Models Notice

This project includes Live2D sample models **(Shizuku (Cubism 2.1) and Haru (Cubism 4))** provided by Live2D Inc. These assets are licensed separately under the Live2D Free Material License Agreement and the Terms of Use for Live2D Cubism Sample Data. They are not covered by the MIT license of this project.

The Live2D simple models are owned and copyrighted by Live2D Inc. The sample data are utilized in accordance with the terms and conditions set by Live2D Inc. (See [**Live2D Free Material License Agreement**](https://www.live2d.jp/en/terms/live2d-free-material-license-agreement/) and [**Terms of Use**](https://www.live2d.com/eula/live2d-sample-model-terms_en.html)).

**Note:** For commercial use, especially by medium or large-scale enterprises, the use of these Live2D sample models may be subject to additional licensing requirements. If you plan to use this project commercially, please ensure that you have the appropriate permissions from Live2D Inc., or use versions of the project without these models.