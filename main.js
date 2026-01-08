import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// إعدادات Firebase
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
const storage = getStorage(app);

let currentUserData = null;
let finalPdfBlob = null;
const path = window.location.pathname;
const page = path.split("/").pop() || "index.html";

// دالة إظهار الرسائل
function showStatus(divId, text, type) {
    const div = document.getElementById(divId);
    if (!div) return;
    div.innerText = text;
    div.className = `block text-center font-bold p-3 rounded-xl text-sm mt-4 `;
    if (type === 'error') div.className += "bg-red-50 text-red-700";
    else if (type === 'success') div.className += "bg-green-50 text-green-700";
    else div.className += "bg-blue-50 text-blue-700";
    div.classList.remove('hidden');
}

// --- [منطق صفحة تسجيل الدخول login.html] ---
if (page === "login.html") {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPass').value;
            
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                window.location.href = "index.html";
            } catch (err) {
                showStatus('loginMessage', "خطأ في البيانات: " + err.message, 'error');
            }
        };
    }

    // زر نسيت كلمة المرور
    document.getElementById('forgotPassBtn').onclick = async () => {
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) return alert("اكتب بريدك الإلكتروني أولاً في الخانة المخصصة");
        try {
            await sendPasswordResetEmail(auth, email);
            alert("تم إرسال رابط إعادة تعيين كلمة المرور لبريدك ✅");
        } catch (err) { alert(err.message); }
    };
}

// --- [منطق صفحة التسجيل register.html] ---
if (page === "register.html") {
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const pass = document.getElementById('regPass').value;
            const index = document.getElementById('regIndex').value || "0000";
            const college = document.getElementById('regCollege').value;

            try {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(cred.user);
                await set(ref(db, 'users/' + cred.user.uid), {
                    fullName: name, academicIndex: index, college: college, email: email
                });
                alert("تم إنشاء الحساب! فعل إيميلك ثم سجل دخولك.");
                window.location.href = "login.html";
            } catch (err) { alert(err.message); }
        };
    }
}

// --- [منطق الصفحة الرئيسية index.html] ---
if (page === "index.html") {
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        if (user) {
            // التحقق من تفعيل الإيميل
            if (!user.emailVerified) {
                document.body.innerHTML = `
                    <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
                        <h1 class="text-2xl font-bold text-red-600 mb-4">📧 يجب تفعيل حسابك أولاً</h1>
                        <p class="text-slate-600 mb-6">لقد أرسلنا رابط تفعيل إلى: <br><b>${user.email}</b></p>
                        <p class="text-sm text-slate-400 mb-6">تفقد مجلد Spam إذا لم تجده.</p>
                        <div class="flex gap-4">
                            <button onclick="location.reload()" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">لقد فعلت الحساب، دخول</button>
                            <button onclick="signOut(auth).then(()=>location.href='login.html')" class="bg-slate-100 px-6 py-2 rounded-xl font-bold">تسجيل الخروج</button>
                        </div>
                    </div>`;
                return;
            }

            const snap = await get(ref(db, 'users/' + user.uid));
            if (snap.exists()) {
                currentUserData = snap.val();
                document.getElementById('displayUserName').innerText = currentUserData.fullName;
                document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                document.getElementById('displayCollege').innerText = currentUserData.college;
                document.getElementById('mainContent').classList.remove('hidden');
            } else { window.location.href = "login.html"; }
        } else {
            window.location.href = "login.html";
        }
        if (loader) loader.classList.add('hidden');
    });

    // (أضف هنا كود الرفع convertBtn و finalSubmit الذي أعطيته لك سابقاً)
}

// (أضف هنا كود الـ admin.html والدوال المساعدة كما هي في الملف السابق)
window.handleLogout = () => signOut(auth).then(() => location.href = "login.html");