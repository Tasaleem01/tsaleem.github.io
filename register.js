import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    sendEmailVerification,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app);

const regForm = document.getElementById('regForm');
const regMessage = document.getElementById('regMessage');

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const academicId = document.getElementById('regIndex').value;
    const college = document.getElementById('regCollege').value;
    const password = document.getElementById('regPass').value;
    const confirmPass = document.getElementById('regConfirm').value;

    if (password !== confirmPass) {
        showMessage("خطأ: كلمات المرور غير متطابقة!", "bg-red-100 text-red-600");
        return;
    }

    try {
        // 1. التحقق من الرقم الجامعي في قاعدة البيانات أولاً
        const userRef = ref(db, 'users/' + academicId);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            showMessage("عذراً، هذا الرقم الأكاديمي مسجل مسبقاً!", "bg-yellow-100 text-yellow-700");
            return;
        }

        // 2. إنشاء الحساب في Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. إرسال بريد التوثيق
        await sendEmailVerification(user);

        // 4. حفظ البيانات في Database ليتعرف عليها الآدمن
        const userData = {
            fullName: name,
            email: email,
            academicIndex: academicId,
            college: college,
            uid: user.uid, // ربط الـ Auth بالـ Database
            createdAt: new Date().toISOString(),
            isVerified: false
        };
        await set(userRef, userData);

        // 5. تسجيل الخروج فوراً حتى يوثق البريد
        await signOut(auth);

        showMessage("تم إنشاء الحساب! 📧 يرجى فحص بريدك الإلكتروني وتفعيل الحساب قبل تسجيل الدخول.", "bg-blue-100 text-blue-700 border-2 border-blue-200");

        // توجيه لصفحة تسجيل الدخول بعد 5 ثواني
        setTimeout(() => {
            window.location.href = 'index.html'; 
        }, 6000);

    } catch (error) {
        let msg = "حدث خطأ في النظام";
        if (error.code === 'auth/email-already-in-use') msg = "هذا البريد الإلكتروني مستخدم بالفعل!";
        if (error.code === 'auth/weak-password') msg = "كلمة المرور ضعيفة جداً!";
        
        console.error(error);
        showMessage(msg, "bg-red-100 text-red-600 border border-red-200");
    }
});

function showMessage(text, style) {
    regMessage.textContent = text;
    regMessage.className = `block text-center font-bold p-4 rounded-2xl text-sm mt-4 ${style}`;
    regMessage.classList.remove('hidden');
}
