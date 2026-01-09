import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // التحقق من التفعيل
        if (!user.emailVerified) {
            showMessage("⚠️ بريدك غير موثق! تفقد رسائل البريد (أو الـ Spam) لتفعيل حسابك.", "bg-yellow-100 text-yellow-700");
            await sendEmailVerification(user); 
            await signOut(auth);
            return;
        }

        // جلب بيانات الطالب من Database لمنع الـ undefined
        const usersSnap = await get(ref(db, 'users'));
        let studentFound = null;

        if (usersSnap.exists()) {
            const allUsers = usersSnap.val();
            studentFound = Object.values(allUsers).find(u => u.email === email);
        }

        if (studentFound) {
            // تخزين البيانات بـ fullName و academicIndex للآدمن
            localStorage.setItem('user', JSON.stringify(studentFound));
            
            showMessage("✅ جاري الدخول...", "bg-green-100 text-green-700");
            
            setTimeout(() => {
                // توجيه للآدمن إذا كان البريد هو بريدك الخاص
                if (email === "admin@gmail.com") { 
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "home.html";
                }
            }, 1500);
        } else {
            showMessage("خطأ: لم نجد بياناتك في قاعدة البيانات", "bg-red-100 text-red-700");
        }

    } catch (error) {
        showMessage("البريد أو كلمة المرور غير صحيحة", "bg-red-100 text-red-700");
    }
});

function showMessage(text, style) {
    loginMessage.textContent = text;
    loginMessage.className = `block text-center font-bold p-3 rounded-xl text-sm mt-4 ${style}`;
    loginMessage.classList.remove('hidden');
}
