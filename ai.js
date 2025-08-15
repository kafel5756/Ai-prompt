// ai.js - REPLACE your previous ai.js with this file
// Firebase config (keeps same config you provided earlier)
const firebaseConfig = {
  apiKey: "AIzaSyCGMxuAHQAzKZi0y3GjZKCznqNfv5eNbVc",
  authDomain: "ai-prompt-1cc22.firebaseapp.com",
  projectId: "ai-prompt-1cc22",
  storageBucket: "ai-prompt-1cc22.firebasestorage.app",
  messagingSenderId: "88625531249",
  appId: "1:88625531249:web:5c114a958ce5b57c79ced0"
};

// Gemini API key (client-side). Works now but consider moving to server later.
const GEMINI_API_KEY = "AIzaSyBtDRuwJg2HUbPdTRMpvLJ5xakCM9JvJWw";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* UI elements (same ids expected in ai.html) */
const logoutBtn = document.getElementById("logout");
const userEmail = document.getElementById("user-email");
const recordBtn = document.getElementById("record");
const micicon = document.getElementById("micicon");
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");
const textEl = document.getElementById("text");
const generateBtn = document.getElementById("generate");
const clearBtn = document.getElementById("clear");
const statusEl = document.getElementById("status");
const jsonEl = document.getElementById("json");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");

/* Auth guard */
auth.onAuthStateChanged(user => {
  if (!user) {
    location.href = "login.html";
    return;
  }
  userEmail.textContent = user.email;
  userEmail.hidden = false;
});

/* logout */
logoutBtn.addEventListener("click", () => auth.signOut().then(()=> location.href = "login.html"));

/* Speech recognition (browser) */
let recognition = null;
let isRecording = false;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    recordBtn.classList.add("recording");
    setStatus("Listening...");
  };
  recognition.onend = () => {
    isRecording = false;
    recordBtn.classList.remove("recording");
    setStatus("Stopped");
  };
  recognition.onerror = (e) => {
    isRecording = false;
    recordBtn.classList.remove("recording");
    setStatus("Speech error: " + e.error, true);
  };
  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    textEl.value = textEl.value ? textEl.value + " " + text : text;
    setStatus("Transcription added");
  };
} else {
  setStatus("Speech API not supported in this browser", true);
}

recordBtn.addEventListener("click", () => {
  if (!recognition) {
    alert("Speech recognition not supported — please paste text or upload audio.");
    return;
  }
  if (isRecording) recognition.stop(); else recognition.start();
});

/* file upload preview */
fileInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  preview.src = URL.createObjectURL(f);
  preview.style.display = "block";
  setStatus("Audio loaded (preview only). Use microphone for live transcription or paste text.");
});

/* Clear text */
clearBtn.addEventListener("click", () => {
  textEl.value = "";
  jsonEl.textContent = "{ }";
  setStatus("Cleared");
});

/* Generate with Gemini — robust model selection */
generateBtn.addEventListener("click", async () => {
  const text = textEl.value.trim();
  if (!text) return alert("Please record or paste text first.");

  // require auth
  const user = auth.currentUser;
  if (!user) return alert("Please login first.");

  // Candidate model IDs (try these in order until one returns non-404)
  const modelCandidates = [
    "gemini-2.0",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5",
    "gemini-pro",
      "gemini-1.5-pro",
      "gemini-1.0-pro"

  ];

  // Build a careful prompt that requests ONLY JSON
  const prompt = `Convert the following text into a concise structured JSON object. RETURN ONLY VALID JSON (no explanation, no extra text).\n\nText:\n${text}\n\nJSON:`;

  setStatus("Generating JSON via Gemini...");
  generateBtn.disabled = true;

  try {
    let lastError = null;
    let generated = null;

    for (const modelId of modelCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

      // Request body per generateContent docs: contents array with role+parts
      const body = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        // optional parameters
        temperature: 0.2,
        maxOutputTokens: 800
      };

      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const textResp = await resp.text(); // read full text first to capture error bodies
        if (!resp.ok) {
          // if 404, try next model; otherwise throw after loop
          try {
            const parsedErr = JSON.parse(textResp);
            lastError = parsedErr;
          } catch (pe) {
            lastError = { error: textResp };
          }
          // try next model on 404
          if (resp.status === 404) {
            continue;
          } else {
            throw new Error(`API error (status ${resp.status}): ${textResp}`);
          }
        }

        // success: parse JSON
        const j = JSON.parse(textResp);

        // Try to extract generated text from a few common paths
        if (j.candidates && j.candidates.length) {
          // candidates[].content[].text
          const cand = j.candidates[0];
          if (cand.content && cand.content.length) {
            generated = cand.content.map(c => c.text || "").join(" ");
          } else if (cand.output) {
            generated = cand.output;
          }
        } else if (j.output && Array.isArray(j.output)) {
          // output[].content[].text
          generated = j.output.map(o => {
            if (o.content && Array.isArray(o.content)) {
              return o.content.map(c => c.text || "").join(" ");
            }
            return "";
          }).join(" ");
        } else if (j.result) {
          generated = typeof j.result === "string" ? j.result : JSON.stringify(j.result);
        } else if (j.answers) {
          generated = JSON.stringify(j.answers);
        } else {
          // fallback: whole response
          generated = JSON.stringify(j);
        }

        // found something — stop trying more models
        if (generated) {
          break;
        } else {
          lastError = j;
        }
      } catch (errInner) {
        lastError = errInner;
        // continue trying other model IDs unless it's clearly fatal
        if (errInner.message && errInner.message.includes("401")) {
          // unauthorized - break early
          break;
        }
      }
    } // end model loop

    if (!generated) {
      // if we never got a generated result
      throw new Error("No model returned content. Last error: " + JSON.stringify(lastError));
    }

    // Try to parse generated text as JSON. Many models return raw JSON or text containing JSON.
    let pretty;
    try {
      const parsed = JSON.parse(generated);
      pretty = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // attempt to extract a JSON substring
      const match = generated.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        try {
          const parsed2 = JSON.parse(match[0]);
          pretty = JSON.stringify(parsed2, null, 2);
        } catch (e2) {
          pretty = match[0];
        }
      } else {
        // no JSON found — show raw text
        pretty = generated;
      }
    }

    jsonEl.textContent = pretty;
    setStatus("Generated successfully");
  } catch (err) {
    console.error("Generation error:", err);
    alert("Generation failed: " + (err.message || JSON.stringify(err)));
    setStatus("Generation failed", true);
  } finally {
    generateBtn.disabled = false;
  }
});

/* copy & download */
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(jsonEl.textContent);
    setStatus("Copied to clipboard");
  } catch (e) {
    alert("Copy failed: " + e.message);
  }
});
downloadBtn.addEventListener("click", () => {
  const blob = new Blob([jsonEl.textContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prompt.json";
  a.click();
  URL.revokeObjectURL(url);
});

/* helper */
function setStatus(msg, isError = false) {
  statusEl.hidden = false;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#b91c1c" : "inherit";
  setTimeout(()=> { if(statusEl.textContent === msg) statusEl.hidden = true; }, 4000);
}