// 1. استيراد المكتبات اللازمة (تأكد من استخدام نفس الإصدارات)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. إعداداتك التي استخرجتها (تأكد أنها مطابقة تماماً)
const firebaseConfig = {
  apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
  authDomain: "tasaleem-c2218.firebaseapp.com",
  databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
  projectId: "tasaleem-c2218",
  storageBucket: "tasaleem-c2218.firebasestorage.app",
  messagingSenderId: "877790432223",
  appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

// 3. تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// --- الجزء المسؤول عن تشغيل الزر ---

const loginBtn = document.getElementById('loginBtn');
const authOverlay = document.getElementById('authOverlay');

// وظيفة زر تسجيل الدخول
loginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("تم تسجيل الدخول بنجاح:", user.displayName);
        // هنا سيتولى مراقب الحالة (onAuthStateChanged) إخفاء الغطاء
    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error.message);
        alert("فشل تسجيل الدخول: " + error.message);
    }
});

// مراقبة حالة تسجيل الدخول (لتلقائية إخفاء الواجهة)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // إخفاء غطاء تسجيل الدخول
        authOverlay.classList.add('hidden');
        document.getElementById('userNameDisplay').innerText = `أهلاً، ${user.displayName}`;
        
        // فحص هل هو مسجل مسبقاً في Realtime Database؟
        const userRef = ref(db, 'users/' + user.uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            document.getElementById('studentName').value = data.fullName;
            document.getElementById('studentId').value = data.academicId;
        } else {
            // إذا كان أول مرة، اطلب البيانات واحفظها
            const fullName = prompt("يرجى إدخال اسمك الرباعي:");
            const academicId = prompt("يرجى إدخال رقمك الجامعي:");
            
            if (fullName && academicId) {
                await set(userRef, {
                    fullName: fullName,
                    academicId: academicId,
                    email: user.email
                });
                document.getElementById('studentName').value = fullName;
                document.getElementById('studentId').value = academicId;
            }
        }
    } else {
        authOverlay.classList.remove('hidden');
    }
});