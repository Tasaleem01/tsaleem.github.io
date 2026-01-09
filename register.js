import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, reload } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
        // 1. التحقق من الرقم الجامعي في Database
        const userRef = ref(db, 'users/' + academicId);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            showMessage("عذراً، هذا الرقم الأكاديمي مسجل مسبقاً!", "bg-yellow-100 text-yellow-700");
            return;
        }

        // 2. إنشاء الحساب
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. إرسال رابط التوثيق
        await sendEmailVerification(user);

        // 4. حفظ البيانات في Database
        const userData = {
            fullName: name,
            email: email,
            academicIndex: academicId,
            college: college,
            uid: user.uid,
            createdAt: new Date().toISOString()
        };
        await set(userRef, userData);

        // 5. حفظ البيانات مؤقتاً في المتصفح
        localStorage.setItem('user', JSON.stringify(userData));

        // 6. عرض رسالة التوجيه للبريد مع زر التحقق
        regMessage.innerHTML = `
            <div class="p-6 bg-blue-50 border-2 border-blue-200 rounded-[2rem] text-center shadow-inner">
                <p class="text-blue-800 font-bold text-lg">📧 خطوة واحدة متبقية!</p>
                <p class="text-blue-600 text-sm mt-2">أرسلنا رابط التفعيل إلى:<br><b class="text-blue-900">${email}</b></p>
                <p class="text-slate-500 text-[11px] mt-4">يرجى الضغط على الرابط في بريدك، ثم اضغط على الزر أدناه:</p>
                
                <button id="verifyBtn" class="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">
                    لقد قمت بالتفعيل، دخول الآن ✅
                </button>

                <button id="resendBtn" class="mt-3 text-blue-500 underline text-xs block mx-auto hover:text-blue-700">
                    لم يصلني الرابط؟ إعادة إرسال
                </button>
            </div>
        `;
        regMessage.classList.remove('hidden');
        regForm.classList.add('hidden'); // إخفاء الفورم ليركز المستخدم على التفعيل

        // زر التحقق من التفعيل والدخول
        document.getElementById('verifyBtn').onclick = async () => {
            await reload(auth.currentUser); // تحديث حالة المستخدم من السيرفر
            if (auth.currentUser.emailVerified) {
                alert("تم التوثيق بنجاح! جاري توجيهك للمنصة...");
                window.location.href = 'index.html';
            } else {
                alert("⚠️ لم يتم تفعيل الحساب بعد. يرجى فتح بريدك والضغط على الرابط المرسل.");
            }
        };

        // زر إعادة الإرسال
        document.getElementById('resendBtn').onclick = async () => {
            await sendEmailVerification(auth.currentUser);
            alert("تم إعادة إرسال الرابط. تفقد بريدك (بما في ذلك ملف الـ Spam).");
        };

    } catch (error) {
        let msg = "حدث خطأ أثناء التسجيل";
        if (error.code === 'auth/email-already-in-use') msg = "هذا البريد مسجل بالفعل!";
        showMessage(msg, "bg-red-100 text-red-600");
    }
});

function showMessage(text, style) {
    regMessage.textContent = text;
    regMessage.className = `block text-center font-bold p-4 rounded-2xl text-sm mt-4 ${style}`;
    regMessage.classList.remove('hidden');
}
