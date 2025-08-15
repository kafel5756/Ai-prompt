// auth.js — used by login.html
// Paste into file and open login.html

// Your Firebase config (already provided earlier)
const firebaseConfig = {
  apiKey: "AIzaSyCGMxuAHQAzKZi0y3GjZKCznqNfv5eNbVc",
  authDomain: "ai-prompt-1cc22.firebaseapp.com",
  projectId: "ai-prompt-1cc22",
  storageBucket: "ai-prompt-1cc22.firebasestorage.app",
  messagingSenderId: "88625531249",
  appId: "1:88625531249:web:5c114a958ce5b57c79ced0"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI elements
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authMsg = document.getElementById("auth-msg");
const googleLoginBtn = document.getElementById("google-login");

// toggle tabs
tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  loginForm.style.display = "block";
  registerForm.style.display = "none";
});
tabRegister.addEventListener("click", () => {
  tabLogin.classList.remove("active");
  tabRegister.classList.add("active");
  loginForm.style.display = "none";
  registerForm.style.display = "block";
});

// login submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    authMsg.textContent = "Login successful — redirecting...";
    setTimeout(() => location.href = "index.html", 900);
  } catch (err) {
    authMsg.textContent = "Login error: " + err.message;
  }
});

// register submit
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const pass = document.getElementById("reg-pass").value;
  try {
    const res = await auth.createUserWithEmailAndPassword(email, pass);
    // create user doc and give initial 3 credits
    await db.collection("users").doc(res.user.uid).set({ name, email, credits: 3 });
    authMsg.textContent = "Account created — redirecting...";
    setTimeout(() => location.href = "index.html", 900);
  } catch (err) {
    authMsg.textContent = "Register error: " + err.message;
  }
});

// Google sign-in
googleLoginBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const res = await auth.signInWithPopup(provider);
    // ensure user doc exists
    const doc = await db.collection("users").doc(res.user.uid).get();
    if (!doc.exists) {
      await db.collection("users").doc(res.user.uid).set({
        name: res.user.displayName || "",
        email: res.user.email,
        credits: 3
      });
    }
    authMsg.textContent = "Google sign-in successful — redirecting...";
    setTimeout(() => location.href = "index.html", 800);
  } catch (err) {
    authMsg.textContent = "Google sign-in error: " + err.message;
  }
});

// if user already signed in -> redirect to ai
auth.onAuthStateChanged(user => {
  if (user) {
    // redirect to main app
    // but only redirect if user is on login page
    if (location.pathname.endsWith("login.html") || location.pathname === "/" || location.pathname.endsWith("/")) {
      location.href = "index.html";
    }
  }
});