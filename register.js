import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, reload } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- إعدادات Firebase (كما هي) ---
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

// دالة التحقق من الاسم الثلاثي
function isTripleName(name) {
    const words = name.trim().split(/\s+/);
    return words.length >= 3;
}

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const academicId = document.getElementById('regIndex').value;
    const college = document.getElementById('regCollege').value;
    const password = document.getElementById('regPass').value;

    // 1. التحقق من الاسم الثلاثي
    if (!isTripleName(name)) {
        alert("⚠️ يرجى إدخال الاسم الثلاثي على الأقل لضمان تسجيل بياناتك بشكل صحيح.");
        return;
    }

    // 2. التحقق من طول كلمة المرور (اختياري لكنه مهم)
    if (password.length < 6) {
        alert("⚠️ كلمة المرور ضعيفة، يجب أن تكون 6 أحرف أو أرقام على الأقل.");
        return;
    }

    try {
        // 3. التحقق من تكرار الرقم الجامعي في القاعدة
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            const isDuplicateIndex = Object.values(allUsers).some(u => String(u.academicIndex) === String(academicId));
            
            if (isDuplicateIndex) {
                alert("⚠️ الرقم الجامعي / الأكاديمي مستخدم من قبل، يرجى التأكد من الرقم.");
                return;
            }
        }

        // 4. إنشاء الحساب في Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 5. إرسال رابط التوثيق
        await sendEmailVerification(user);

        // 6. حفظ البيانات باستخدام UID كعنوان فريد
        const userData = {
            fullName: name,
            email: email,
            academicIndex: academicId,
            college: college,
            uid: user.uid,
            registeredAt: new Date().toLocaleString('ar-EG')
        };

        await set(ref(db, 'users/' + user.uid), userData);
        localStorage.setItem('user', JSON.stringify(userData));

        // 7. إظهار الـ Modal
        showVerificationModal(email);

    } catch (error) {
        // إدارة الأخطاء بالأسماء العربية
        console.error(error.code);
        switch (error.code) {
            case 'auth/email-already-in-use':
                alert("⚠️ البريد الإلكتروني مستخدم من قبل، حاول تسجيل الدخول.");
                break;
            case 'auth/invalid-email':
                alert("⚠️ صيغة البريد الإلكتروني غير صحيحة.");
                break;
            case 'auth/weak-password':
                alert("⚠️ كلمة المرور قصيرة جداً.");
                break;
            default:
                alert("⚠️ حدث خطأ أثناء التسجيل: " + error.message);
        }
    }
});

// وظيفة الـ Modal (كما هي مع تحسين بسيط في الرسائل)
function showVerificationModal(email) {
    const modalHtml = `
    <div id="authModal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 text-right" dir="rtl">
            <div class="text-center">
                <div class="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">📧</div>
                <h3 class="text-2xl font-bold text-slate-800">تفقد بريدك الإلكتروني</h3>
                <p class="text-slate-500 mt-3 text-sm leading-relaxed">
                    لقد أرسلنا رابط توثيق إلى البريد: <br>
                    <span class="font-bold text-slate-800">${email}</span>
                </p>
                <div class="space-y-3 mt-8">
                    <button id="confirmVerifyBtn" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 shadow-lg active:scale-95 transition-all">
                        لقد ضغطت على الرابط، دخول ✅
                    </button>
                    <button id="resendLinkBtn" class="text-slate-400 text-xs font-bold hover:text-blue-600 transition-colors">
                        لم يصلني الرابط؟ إعادة إرسال
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('confirmVerifyBtn').onclick = async () => {
        const btn = document.getElementById('confirmVerifyBtn');
        btn.innerHTML = "جاري التحقق... ⏳";
        await reload(auth.currentUser);
        if (auth.currentUser.emailVerified) {
            alert("تم التوثيق بنجاح! أهلاً بك يا مهندس.");
            window.location.href = 'index.html';
        } else {
            btn.innerHTML = "لقد ضغطت على الرابط، دخول ✅";
            alert("⚠️ عذراً، لم يتم تفعيل الحساب بعد. يرجى الضغط على الرابط في بريدك.");
        }
    };

    document.getElementById('resendLinkBtn').onclick = async () => {
        try {
            await sendEmailVerification(auth.currentUser);
            alert("تم إعادة إرسال رابط التوثيق بنجاح ✅");
        } catch (e) {
            alert("يرجى الانتظار دقيقة قبل طلب إعادة الإرسال.");
        }
    };
}