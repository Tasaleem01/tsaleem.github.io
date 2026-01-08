import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. إعدادات Firebase ---
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

// --- 2. إعدادات Cloudinary الخاصة بك ---
const CLOUD_NAME = "dilxydgpn";
const UPLOAD_PRESET = "student_uploads";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

let currentUserData = null;
let finalPdfBlob = null;
const path = window.location.pathname;
const page = path.split("/").pop() || "index.html";

// --- 3. منطق الصفحات (التسجيل ودخول) ---
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
                window.location.href = "index.html";
            } catch (err) { alert("حدث خطأ: " + err.message); }
        };
    }
}

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
            } catch (err) { alert("فشل الدخول: تأكد من البيانات"); }
        };
    }
}

// --- 4. منطق الصفحة الرئيسية (الرفع والمعالجة) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        if (user) {
            if (!user.emailVerified) {
                renderVerificationUI(user.email);
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

    // تحويل الصور إلى PDF
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.onclick = async () => {
            const files = Array.from(document.getElementById('imageInput').files);
            if (files.length === 0) return alert("اختر الصور أولاً");
            
            toggleStatus(true, "جاري تحويل ومعالجة الصور... ⏳");
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();

                for (let i = 0; i < files.length; i++) {
                    if (i > 0) doc.addPage();
                    const imgData = await readFileAsDataURL(files[i]);
                    const imgProps = doc.getImageProperties(imgData);
                    const ratio = imgProps.width / imgProps.height;
                    const pdfImgHeight = pageWidth / ratio;
                    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pdfImgHeight > pageHeight ? pageHeight : pdfImgHeight, undefined, 'MEDIUM');
                }

                finalPdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(finalPdfBlob);
                document.getElementById('pdfFrame').innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;
                document.getElementById('previewArea').classList.remove('hidden');
                toggleStatus(false);
            } catch (err) { alert(err.message); toggleStatus(false); }
        };
    }

    // الرفع إلى Cloudinary وتخزين البيانات في Firebase
    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return alert("يرجى معالجة الصور أولاً");

            // إنشاء التاريخ المطلوب (9-1)
            const now = new Date();
            const dateStr = `${now.getDate()}-${now.getMonth() + 1}`;
            const fileName = `${currentUserData.fullName} ${dateStr}`;

            // تجهيز بيانات الرفع لـ Cloudinary
            const formData = new FormData();
            formData.append("file", finalPdfBlob);
            formData.append("upload_preset", UPLOAD_PRESET);
            formData.append("public_id", fileName); // هذا هو اسم الملف في السحابة

            try {
                toggleStatus(true, "جاري رفع التكليف للسحابة... 🚀");
                
                // عملية الرفع باستخدام Fetch
                const response = await fetch(CLOUDINARY_URL, {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();

                if (result.secure_url) {
                    // حفظ المعلومات في Firebase Realtime Database
                    await set(ref(db, `submissions/week_1/${auth.currentUser.uid}`), {
                        studentName: currentUserData.fullName,
                        academicIndex: currentUserData.academicIndex,
                        fileUrl: result.secure_url,
                        fileName: fileName,
                        submittedAt: new Date().toLocaleString('ar-EG')
                    });

                    toggleStatus(true, "✅ تم الإرسال بنجاح! شكراً يا مهندس.");
                    setTimeout(() => toggleStatus(false), 3000);
                } else {
                    throw new Error(result.error.message);
                }
            } catch (error) {
                console.error(error);
                alert("فشل الرفع: " + error.message);
                toggleStatus(false);
            }
        };
    }
}

// --- 5. الدوال المساعدة ---
function readFileAsDataURL(file) { 
    return new Promise(res => { 
        const reader = new FileReader(); 
        reader.onload = e => res(e.target.result); 
        reader.readAsDataURL(file); 
    }); 
}

function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) {
        statusText.innerText = text;
        show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden');
    }
}

function renderVerificationUI(email) {
    document.body.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
            <div class="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 max-w-md">
                <div class="text-6xl mb-6">📧</div>
                <h1 class="text-2xl font-bold text-slate-800 mb-4">يجب تفعيل حسابك أولاً</h1>
                <p class="text-slate-500 mb-6 leading-relaxed">أرسلنا رابط تفعيل لبريدك:<br><span class="font-bold text-blue-600">${email}</span></p>
                <button onclick="location.reload()" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700">لقد فعلت الحساب، دخول ✅</button>
            </div>
        </div>`;
}

window.handleLogout = () => signOut(auth).then(() => location.href = "login.html");
