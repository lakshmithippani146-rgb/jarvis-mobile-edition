
import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ REPLACE WITH YOUR GEMINI API KEY
const API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// Initialize Gemini API Client using Gemini 3 Flash
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  systemInstruction: "You are JARVIS, a highly intelligent and polite AI assistant. Keep responses clear, concise, and structured. Address the user naturally as boss or sir when appropriate."
});
// UI Elements
const consoleOutput = document.getElementById("console-output");
const userInput = document.getElementById("user-input");
const btnExecute = document.getElementById("btn-execute");
const btnMic = document.getElementById("btn-mic");
const btnSpeaker = document.getElementById("btn-speaker");
const btnClear = document.getElementById("btn-clear");
const statusText = document.getElementById("status-text");
const arcReactor = document.getElementById("arc-reactor");

// Voice Settings
let speechMuted = false;
const synth = window.speechSynthesis;

// Long-Term Memory (Persistent localStorage)
const MEMORY_KEY = "JARVIS_CONVERSATION_HISTORY";
let chatHistory = JSON.parse(localStorage.getItem(MEMORY_KEY)) || [];

// Initialize Chat Session with History
let chatSession = model.startChat({
  history: chatHistory.map(item => ({
    role: item.role,
    parts: [{ text: item.parts }]
  }))
});

// Append Log to Console
function printToConsole(sender, message, type) {
  const line = document.createElement("div");
  line.className = type === "user" ? "msg-user" : "msg-jarvis";
  line.textContent = `[${sender}]: ${message}`;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Text to Speech Function
function speak(text) {
  if (speechMuted || !('speechSynthesis' in window)) return;
  
  synth.cancel(); // Stop current speech
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Pick an English Voice if available
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

// Save Chat History to Long-Term Memory
function saveMemory(role, text) {
  chatHistory.push({ role, parts: text });
  localStorage.setItem(MEMORY_KEY, JSON.stringify(chatHistory));
}

// Execute Command / AI Query
async function processCommand(text) {
  if (!text.trim()) return;

  printToConsole("YOU", text, "user");
  saveMemory("user", text);
  userInput.value = "";

  statusText.textContent = "PROCESSING...";
  arcReactor.style.animationDuration = "1s";

  try {
    const result = await chatSession.sendMessage(text);
    const responseText = result.response.text();

    printToConsole("JARVIS", responseText, "jarvis");
    saveMemory("model", responseText);

    speak(responseText);
  } catch (error) {
    console.error("AI Error:", error);
    printToConsole("SYSTEM ERROR", error.message, "jarvis");
    statusText.textContent = "CORE ERROR";
  }
}

// Web Speech Recognition (Listening Core)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    statusText.textContent = "LISTENING...";
    btnMic.classList.add("listening");
    arcReactor.style.animationDuration = "0.5s";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    processCommand(transcript);
  };

  recognition.onerror = (event) => {
    printToConsole("SYSTEM", "Voice input error: " + event.error, "jarvis");
    btnMic.classList.remove("listening");
    statusText.textContent = "SYSTEM READY";
  };

  recognition.onend = () => {
    btnMic.classList.remove("listening");
    statusText.textContent = "SYSTEM READY";
    arcReactor.style.animationDuration = "10s";
  };
} else {
  btnMic.style.display = "none";
  printToConsole("SYSTEM", "Speech recognition not supported in this browser.", "jarvis");
}

// Event Listeners
btnExecute.addEventListener("click", () => processCommand(userInput.value));

userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") processCommand(userInput.value);
});

btnMic.addEventListener("click", () => {
  if (recognition) {
    try {
      recognition.start();
    } catch (e) {
      recognition.stop();
    }
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
  chatSession = model.startChat();
  consoleOutput.innerHTML = `<div class="msg-jarvis">[JARVIS]: Long-term memory cleared. Resetting brain state.</div>`;
});

