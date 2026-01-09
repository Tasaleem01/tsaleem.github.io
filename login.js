import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- إعدادات Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
    authDomain: "tasaleem-c2218.firebaseapp.com",
    databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
    projectId: "tasaleem-c2218",
    storageBucket: "tasaleem-c2218.firebasestorage.app",
    messagingSenderId: "877790432223",
    appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;

    try {
        // 1. تسجيل الدخول
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // 2. التحقق من تفعيل البريد
        if (!user.emailVerified) {
            showMessage("⚠️ بريدك غير موثق! تفقد رسائل البريد لتفعيل حسابك.", "bg-yellow-100 text-yellow-700");
            await sendEmailVerification(user); 
            await signOut(auth);
            return;
        }

        // 3. جلب بيانات المستخدم مباشرة باستخدام الـ UID (أسرع وأدق)
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);

        if (snap.exists()) {
            const userData = snap.val();
            
            // تخزين البيانات محلياً لاستخدامها في المنصة
            localStorage.setItem('user', JSON.stringify(userData));

            showMessage("✅ تم التحقق.. جاري الدخول", "bg-green-100 text-green-700");

            setTimeout(() => {
                // التوجيه بناءً على نوع الحساب
                if (email === "admin@gmail.com") { 
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "home.html";
                }
            }, 1500);
        } else {
            // حالة نادرة: الحساب موجود في Auth ولكن بياناته غير موجودة في Database
            showMessage("⚠️ لم نجد ملفك الشخصي، يرجى التواصل مع الإدارة.", "bg-red-100 text-red-700");
            await signOut(auth);
        }

    } catch (error) {
        console.error(error.code);
        // رسائل خطأ واضحة بالعربي
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showMessage("⚠️ البريد الإلكتروني أو كلمة المرور غير صحيحة", "bg-red-100 text-red-700");
        } else if (error.code === 'auth/too-many-requests') {
            showMessage("⚠️ تم حظر الدخول مؤقتاً بسبب محاولات خاطئة كثيرة، حاول لاحقاً.", "bg-red-100 text-red-700");
        } else {
            showMessage("⚠️ حدث خطأ أثناء الدخول: " + error.message, "bg-red-100 text-red-700");
        }
    }
});

function showMessage(text, style) {
    if (loginMessage) {
        loginMessage.textContent = text;
        loginMessage.className = `block text-center font-bold p-3 rounded-xl text-sm mt-4 animate-pulse ${style}`;
        loginMessage.classList.remove('hidden');
    }
}