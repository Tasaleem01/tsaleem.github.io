import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- إعدادات Firebase الخاصة بك ---
const firebaseConfig = {
    apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
    authDomain: "tasaleem-c2218.firebaseapp.com",
    databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
    projectId: "tasaleem-c2218",
    storageBucket: "tasaleem-c2218.firebasestorage.app",
    messagingSenderId: "877790432223",
    appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const regForm = document.getElementById('regForm');
const regMessage = document.getElementById('regMessage');

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // جلب البيانات من النموذج
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const academicId = document.getElementById('regIndex').value;
    const college = document.getElementById('regCollege').value;
    const password = document.getElementById('regPass').value;
    const confirmPass = document.getElementById('regConfirm').value;

    // التحقق من كلمة المرور
    if (password !== confirmPass) {
        showMessage("خطأ: كلمات المرور غير متطابقة!", "bg-red-100 text-red-600 border border-red-200");
        return;
    }

    try {
        // التحقق من وجود الحساب مسبقاً بناءً على الرقم الأكاديمي
        const userRef = ref(db, 'users/' + academicId);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            showMessage("عذراً، هذا الرقم الأكاديمي مسجل مسبقاً!", "bg-yellow-100 text-yellow-700 border border-yellow-200");
            return;
        }

        // تجهيز بيانات المستخدم بمسميات تتوافق مع لوحة الآدمن
        const userData = {
            fullName: name,          // تم تعديله من name ليتعرف عليه الآدمن
            email: email,
            academicIndex: academicId, // تم تعديله من academicId ليتعرف عليه الآدمن
            college: college,
            password: password,
            createdAt: new Date().toISOString()
        };

        // حفظ البيانات في Firebase
        await set(userRef, userData);

        // حفظ الجلسة في المتصفح ليدخل المستخدم تلقائياً
        localStorage.setItem('user', JSON.stringify(userData));

        showMessage("تم إنشاء الحساب بنجاح! جاري توجيهك للمنصة...", "bg-green-100 text-green-700 border border-green-200");

        // الانتقال للصفحة الرئيسية بعد ثانيتين
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error("Error:", error);
        showMessage("حدث خطأ في النظام، يرجى المحاولة لاحقاً", "bg-red-100 text-red-600 border border-red-200");
    }
});

// وظيفة عرض الرسائل التنبيهية
function showMessage(text, style) {
    regMessage.textContent = text;
    regMessage.className = `block text-center font-bold p-4 rounded-2xl text-sm mt-4 ${style}`;
    regMessage.classList.remove('hidden');
}
