import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, reload } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const academicId = document.getElementById('regIndex').value;
    const college = document.getElementById('regCollege').value;
    const password = document.getElementById('regPass').value;

    try {
        // 1. إنشاء الحساب
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. إرسال رابط التوثيق
        await sendEmailVerification(user);

        // 3. حفظ البيانات في Database لضمان ظهورها للآدمن
        const userData = {
            fullName: name,
            email: email,
            academicIndex: academicId,
            college: college,
            uid: user.uid
        };
        await set(ref(db, 'users/' + academicId), userData);
        localStorage.setItem('user', JSON.stringify(userData));

        // 4. إظهار الـ Modal
        showVerificationModal(email);

    } catch (error) {
        alert("خطأ أثناء التسجيل: " + error.message);
    }
});

function showVerificationModal(email) {
    // إنشاء عنصر المودل برمجياً لضمان عدم تداخل التنسيقات
    const modalHtml = `
    <div id="authModal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div class="text-center">
                <div class="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">📧</div>
                <h3 class="text-2xl font-bold text-slate-800">تفقد بريدك الإلكتروني</h3>
                <p class="text-slate-500 mt-3 text-sm leading-relaxed">
                    لقد أرسلنا رابط توثيق إلى البريد: <br>
                    <span class="font-bold text-slate-800">${email}</span>
                </p>
                
                <div class="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs flex items-start gap-3 text-right">
                    <span>💡</span>
                    <p>إذا لم تجد الرسالة في صندوق الوارد، يرجى التحقق من مجلد <b>الرسائل غير المرغوب فيها (Spam)</b> أو <b>العروض الترويجية</b>.</p>
                </div>

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

    // برمجة زر التحقق اللحظي
    document.getElementById('confirmVerifyBtn').onclick = async () => {
        const btn = document.getElementById('confirmVerifyBtn');
        btn.innerHTML = "جاري التحقق... ⏳";
        
        await reload(auth.currentUser); // تحديث الحالة من سيرفر Firebase
        
        if (auth.currentUser.emailVerified) {
            alert("تم التوثيق بنجاح! أهلاً بك يا مهندس.");
            window.location.href = 'index.html'; // التوجه لصفحة المنصة
        } else {
            btn.innerHTML = "لقد ضغطت على الرابط، دخول ✅";
            alert("⚠️ عذراً، لم يتم تفعيل الحساب بعد. يرجى الضغط على الرابط المرسل لبريدك أولاً.");
        }
    };

    // برمجة زر إعادة الإرسال
    document.getElementById('resendLinkBtn').onclick = async () => {
        try {
            await sendEmailVerification(auth.currentUser);
            alert("تم إعادة إرسال رابط التوثيق بنجاح ✅");
        } catch (e) {
            alert("يرجى الانتظار قليلاً قبل محاولة إعادة الإرسال مرة أخرى.");
        }
    };
}
