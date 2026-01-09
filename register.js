import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
        showMessage("خطأ: كلمات المرور غير متطابقة!", "bg-red-100 text-red-600 border-red-200");
        return;
    }

    try {
        // 1. التحقق من الرقم الجامعي في Database
        const userRef = ref(db, 'users/' + academicId);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            showMessage("عذراً، هذا الرقم الأكاديمي مسجل مسبقاً!", "bg-yellow-100 text-yellow-700 border-yellow-200");
            return;
        }

        // 2. إنشاء الحساب في Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. إرسال رابط التوثيق فوراً
        await sendEmailVerification(user);

        // 4. حفظ البيانات بمسميات تتوافق مع الآدمن (fullName)
        const userData = {
            fullName: name,
            email: email,
            academicIndex: academicId,
            college: college,
            uid: user.uid,
            createdAt: new Date().toISOString()
        };
        await set(userRef, userData);

        // 5. حفظ البيانات في المتصفح للدخول الفوري
        localStorage.setItem('user', JSON.stringify(userData));

        // عرض رسالة نجاح مع خيار إعادة الإرسال
        regMessage.innerHTML = `
            <div class="p-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl">
                <p class="font-bold">✅ تم إنشاء الحساب بنجاح!</p>
                <p class="text-[11px] mt-1">أرسلنا رابط التفعيل لبريدك. يرجى تفقده.</p>
                <button id="resendVerification" class="text-blue-600 underline text-[11px] font-bold mt-2 block mx-auto">لم يصلك الرابط؟ إعادة الإرسال</button>
            </div>
        `;
        regMessage.classList.remove('hidden');

        // تفعيل زر إعادة الإرسال
        document.getElementById('resendVerification').onclick = async () => {
            try {
                await sendEmailVerification(auth.currentUser);
                alert("تم إعادة إرسال رابط التوثيق لبريدك بنجاح ✅");
            } catch (err) {
                alert("يرجى الانتظار قليلاً قبل طلب إعادة الإرسال مرة أخرى.");
            }
        };

        // 6. التوجه للصفحة الرئيسية (index.html) بعد 4 ثوانٍ
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 4000);

    } catch (error) {
        let errorMsg = "حدث خطأ في التسجيل، يرجى المحاولة لاحقاً";
        if (error.code === 'auth/email-already-in-use') errorMsg = "هذا البريد الإلكتروني مسجل بالفعل!";
        if (error.code === 'auth/invalid-email') errorMsg = "صيغة البريد الإلكتروني غير صحيحة";
        
        showMessage(errorMsg, "bg-red-100 text-red-600 border-red-200");
        console.error(error);
    }
});

function showMessage(text, style) {
    regMessage.textContent = text;
    regMessage.className = `block text-center font-bold p-4 rounded-2xl text-sm mt-4 ${style}`;
    regMessage.classList.remove('hidden');
}
