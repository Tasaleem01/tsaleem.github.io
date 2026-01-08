// 1. استيراد دوال Firebase عبر CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 2. مفاتيحك الخاصة التي استخرجتها (تمت إضافة Cloudinary)
const firebaseConfig = {
  apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
  authDomain: "tasaleem-c2218.firebaseapp.com",
  databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
  projectId: "tasaleem-c2218",
  storageBucket: "tasaleem-c2218.firebasestorage.app",
  messagingSenderId: "877790432223",
  appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dilxydgpn/upload";
const CLOUDINARY_PRESET = "student_uploads";

// 3. تهيئة الخدمات
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

console.log("Firebase Connected Successfully! ✅");