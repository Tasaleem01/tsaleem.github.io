import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- إعداداتك هنا ---
const firebaseConfig = {
    apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
    authDomain: "tasaleem-c2218.firebaseapp.com",
    databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
    projectId: "tasaleem-c2218",
    storageBucket: "tasaleem-c2218.firebasestorage.app",
    messagingSenderId: "877790432223",
    appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

const CLOUD_NAME = "YOUR_CLOUD_NAME"; // اسمك في Cloudinary
const UPLOAD_PRESET = "YOUR_PRESET";  // الـ Preset (Unsigned)

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUserData = null;
let finalPdfBlob = null;
const page = window.location.pathname.split("/").pop() || "index.html";

// --- [منطق صفحة تسجيل الدخول] ---
if (page === "login.html") {
    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
            window.location.href = "index.html";
        } catch (err) { alert("خطأ في الدخول: " + err.message); }
    };
    document.getElementById('forgotPassBtn').onclick = async () => {
        const email = document.getElementById('loginEmail').value;
        if(!email) return alert("اكتب بريدك أولاً");
        await sendPasswordResetEmail(auth, email);
        alert("تم إرسال رابط الاستعادة لإيميلك ✅");
    };
}

// --- [منطق صفحة التسجيل] ---
if (page === "register.html") {
    document.getElementById('regForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const pass = document.getElementById('regPass').value;
        if(pass !== document.getElementById('regConfirm').value) return alert("كلمات المرور غير متطابقة");
        
        try {
            const cred = await createUserWithEmailAndPassword(auth, document.getElementById('regEmail').value, pass);
            await sendEmailVerification(cred.user);
            await set(ref(db, 'users/' + cred.user.uid), {
                fullName: name,
                academicIndex: document.getElementById('regIndex').value || "0000",
                college: document.getElementById('regCollege').value,
                email: document.getElementById('regEmail').value
            });
            window.location.href = "index.html";
        } catch (err) { alert(err.message); }
    };
}

// --- [منطق الصفحة الرئيسية] ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        if (!user.emailVerified) {
            document.body.innerHTML = `
                <div class="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
                    <div class="bg-white p-10 rounded-[3rem] shadow-xl max-w-md">
                        <div class="text-6xl mb-6 text-blue-500">📧</div>
                        <h1 class="text-2xl font-bold mb-4">يجب تفعيل حسابك أولاً</h1>
                        <p class="text-slate-500 mb-8 italic">تفقد بريدك: <b>${user.email}</b> واضغط على رابط التفعيل ثم أعد تحميل الصفحة.</p>
                        <button onclick="location.reload()" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg">لقد فعلت الحساب ✅</button>
                        <button onclick="signOutUser()" class="mt-4 text-slate-400 text-xs">تسجيل خروج</button>
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
            document.getElementById('initialLoader').classList.add('hidden');
        }
    });

    document.getElementById('convertBtn').onclick = async () => {
        const files = Array.from(document.getElementById('imageInput').files);
        if (files.length === 0) return alert("اختر الصور");
        toggleStatus(true, "جاري المعالجة... ⏳");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        for (let i = 0; i < files.length; i++) {
            if (i > 0) doc.addPage();
            const imgData = await readFileAsDataURL(files[i]);
            doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'MEDIUM');
        }
        finalPdfBlob = doc.output('blob');
        document.getElementById('pdfFrame').innerHTML = `<iframe src="${URL.createObjectURL(finalPdfBlob)}" class="w-full h-full border-none"></iframe>`;
        document.getElementById('previewArea').classList.remove('hidden');
        toggleStatus(false);
    };

    document.getElementById('finalSubmit').onclick = async () => {
        if (!finalPdfBlob) return;
        toggleStatus(true, "جاري الرفع إلى Cloudinary... 🚀");
        
        const formData = new FormData();
        formData.append('file', finalPdfBlob);
        formData.append('upload_preset', UPLOAD_PRESET);

        try {
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData });
            const data = await resp.json();
            
            if (data.secure_url) {
                await set(ref(db, `submissions/week_1/${auth.currentUser.uid}`), {
                    studentName: currentUserData.fullName,
                    fileUrl: data.secure_url,
                    submittedAt: new Date().toLocaleString('ar-EG')
                });
                toggleStatus(true, "✅ تم التسليم بنجاح!");
                setTimeout(() => toggleStatus(false), 3000);
            }
        } catch (err) { alert("خطأ في الرفع: " + err.message); toggleStatus(false); }
    };
}

// --- [دوال مساعدة] ---
function readFileAsDataURL(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function toggleStatus(show, text = "") {
    const o = document.getElementById('statusOverlay');
    const t = document.getElementById('statusText');
    if (o && t) { t.innerText = text; show ? o.classList.remove('hidden') : o.classList.add('hidden'); }
}
window.signOutUser = () => signOut(auth).then(() => location.href = "login.html");
