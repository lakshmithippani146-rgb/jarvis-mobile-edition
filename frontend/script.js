import { GoogleGenerativeAI } from "@google/generative-ai";

// Elements
const apiKeyInput = document.getElementById("api-key-input");
const consoleOutput = document.getElementById("console-output");
const userInput = document.getElementById("user-input");
const btnExecute = document.getElementById("btn-execute");
const btnCamera = document.getElementById("btn-camera");
const btnVision = document.getElementById("btn-vision");
const btnMic = document.getElementById("btn-mic");
const btnSpeaker = document.getElementById("btn-speaker");
const btnClear = document.getElementById("btn-clear");
const statusText = document.getElementById("status-text");
const arcReactor = document.getElementById("arc-reactor");
const arcCore = document.getElementById("arc-core");
const cameraFeed = document.getElementById("camera-feed");
const snapshotCanvas = document.getElementById("snapshot-canvas");
const diagCamera = document.getElementById("diag-camera");

// State
let genAI = null;
let model = null;
let speechMuted = false;
let isCameraActive = false;
let cameraStream = null;

const synth = window.speechSynthesis;
const MEMORY_KEY = "JARVIS_CONVERSATION_HISTORY";
let chatHistory = JSON.parse(localStorage.getItem(MEMORY_KEY)) || [];
let chatSession = null;

// Initialize Gemini Client with Gemini 3 Flash
function initGemini() {
  const key = apiKeyInput.value.trim();
  if (!key || key === "YOUR_GEMINI_API_KEY_HERE") return;

  genAI = new GoogleGenerativeAI(key);
  model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: "You are JARVIS, an advanced AI assistant. Keep responses clear, structured, and helpful. Address the user naturally as boss or sir when appropriate."
  });

  chatSession = model.startChat({
    history: chatHistory.map(item => ({
      role: item.role,
      parts: [{ text: item.parts }]
    }))
  });
}

apiKeyInput.addEventListener("change", initGemini);
initGemini();

// Console Output Helper
function printToConsole(sender, message, type) {
  const line = document.createElement("div");
  line.className = type === "user" ? "msg-user" : "msg-jarvis";
  line.textContent = `[${sender}]: ${message}`;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Text-To-Speech Synthesis
function speak(text) {
  if (speechMuted || !('speechSynthesis' in window)) return;
  synth.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  const selectedVoice = voices.find(v => v.lang.includes("en-US") || v.lang.includes("en-GB"));
  if (selectedVoice) utterance.voice = selectedVoice;

  utterance.pitch = 0.95;
  utterance.rate = 1.0;

  utterance.onstart = () => {
    statusText.textContent = "SPEAKING...";
    arcReactor.style.animationDuration = "2s";
  };

  utterance.onend = () => {
    statusText.textContent = "SYSTEM READY";
    arcReactor.style.animationDuration = "10s";
  };

  synth.speak(utterance);
}

// Memory Storage
function saveMemory(role, text) {
  chatHistory.push({ role, parts: text });
  localStorage.setItem(MEMORY_KEY, JSON.stringify(chatHistory));
}

// Optical Sensor / Camera Controls
async function toggleCamera() {
  if (isCameraActive) {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    cameraFeed.style.display = "none";
    arcCore.style.display = "block";
    btnCamera.classList.remove("active");
    btnCamera.textContent = "📷 CAM ON";
    diagCamera.textContent = "• OFFLINE";
    diagCamera.style.color = "#ff0055";
    isCameraActive = false;
    printToConsole("SYSTEM", "Optical sensors deactivated.", "jarvis");
  } else {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraFeed.srcObject = cameraStream;
      cameraFeed.style.display = "block";
      arcCore.style.display = "none";
      btnCamera.classList.add("active");
      btnCamera.textContent = "📷 CAM OFF";
      diagCamera.textContent = "• ONLINE";
      diagCamera.style.color = "#00ff88";
      isCameraActive = true;
      printToConsole("SYSTEM", "Optical feed acquired.", "jarvis");
    } catch (err) {
      console.error(err);
      printToConsole("SYSTEM", "Failed to access camera: " + err.message, "jarvis");
    }
  }
}

// Capture Frame from Camera
function captureFrame() {
  if (!isCameraActive || !cameraFeed.videoWidth) return null;
  snapshotCanvas.width = cameraFeed.videoWidth;
  snapshotCanvas.height = cameraFeed.videoHeight;
  const ctx = snapshotCanvas.getContext("2d");
  ctx.drawImage(cameraFeed, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  const dataUrl = snapshotCanvas.toDataURL("image/jpeg", 0.8);
  return {
    inlineData: {
      data: dataUrl.split(",")[1],
      mimeType: "image/jpeg"
    }
  };
}

// Text & Visual Execution Logic
async function processCommand(text, includeVision = false) {
  if (!model) initGemini();
  if (!model) {
    printToConsole("SYSTEM", "Please insert a valid Gemini API Key first.", "jarvis");
    return;
  }

  const promptText = text.trim() || (includeVision ? "Analyze what you see through the optical sensor." : "");
  if (!promptText && !includeVision) return;

  printToConsole("YOU", promptText, "user");
  saveMemory("user", promptText);
  userInput.value = "";

  statusText.textContent = includeVision ? "ANALYZING OPTICS..." : "PROCESSING...";
  arcReactor.style.animationDuration = "1s";

  try {
    let responseText = "";

    if (includeVision && isCameraActive) {
      const imagePart = captureFrame();
      if (!imagePart) {
        printToConsole("SYSTEM", "Camera feed unavailable for vision analysis.", "jarvis");
        statusText.textContent = "SYSTEM READY";
        return;
      }
      const result = await model.generateContent([promptText, imagePart]);
      responseText = result.response.text();
    } else {
      const result = await chatSession.sendMessage(promptText);
      responseText = result.response.text();
    }

    printToConsole("JARVIS", responseText, "jarvis");
    saveMemory("model", responseText);
    speak(responseText);

  } catch (error) {
    console.error("AI Error:", error);
    printToConsole("SYSTEM ERROR", error.message, "jarvis");
    statusText.textContent = "CORE ERROR";
  }
}

// Voice Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    statusText.textContent = "LISTENING...";
    btnMic.classList.add("listening");
    arcReactor.style.animationDuration = "0.5s";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    processCommand(transcript, isCameraActive);
  };

  recognition.onerror = (event) => {
    printToConsole("SYSTEM", "Voice error: " + event.error, "jarvis");
    btnMic.classList.remove("listening");
    statusText.textContent = "SYSTEM READY";
  };

  recognition.onend = () => {
    btnMic.classList.remove("listening");
    statusText.textContent = "SYSTEM READY";
    arcReactor.style.animationDuration = "10s";
  };
}

// Event Listeners
btnExecute.addEventListener("click", () => processCommand(userInput.value, false));
btnCamera.addEventListener("click", toggleCamera);
btnVision.addEventListener("click", () => processCommand(userInput.value, true));

userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") processCommand(userInput.value, false);
});

btnMic.addEventListener("click", () => {
  if (recognition) {
    try { recognition.start(); } catch (e) { recognition.stop(); }
  }
});

btnSpeaker.addEventListener("click", () => {
  speechMuted = !speechMuted;
  btnSpeaker.textContent = speechMuted ? "🔇 MUTED" : "🔊 MUTE";
  if (speechMuted) synth.cancel();
});

btnClear.addEventListener("click", () => {
  localStorage.removeItem(MEMORY_KEY);
  chatHistory = [];
  if (model) chatSession = model.startChat();
  consoleOutput.innerHTML = `<div class="msg-jarvis">[JARVIS]: Long-term memory cleared. Memory reset.</div>`;
});
