import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. إعدادات الخدمات ---
const firebaseConfig = {
    apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
    authDomain: "tasaleem-c2218.firebaseapp.com",
    databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
    projectId: "tasaleem-c2218",
    storageBucket: "tasaleem-c2218.firebasestorage.app",
    messagingSenderId: "877790432223",
    appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

const CLOUD_NAME = "dilxydgpn";
const UPLOAD_PRESET = "student_uploads";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUserData = null;
let finalPdfBlob = null;
let currentWeek = "week_1"; // القيمة الافتراضية
let currentSubject = "الكهرباء";
const page = window.location.pathname.split("/").pop() || "index.html";

// --- 2. منطق صفحة التسجيل والدخول ---
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
                await set(ref(db, 'users/' + cred.user.uid), { fullName: name, academicIndex: index, college: college, email: email });
                window.location.href = "index.html";
            } catch (err) { alert("خطأ: " + err.message); }
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

// --- 3. منطق الصفحة الرئيسية (الطالب) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.emailVerified) { renderVerificationUI(user.email); return; }
            const snap = await get(ref(db, 'users/' + user.uid));
            if (snap.exists()) {
                currentUserData = snap.val();
                document.getElementById('displayUserName').innerText = currentUserData.fullName;
                document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                document.getElementById('displayCollege').innerText = currentUserData.college;
                document.getElementById('mainContent').classList.remove('hidden');
                // جلب إعدادات الأسبوع الحالية للرفع
                onValue(ref(db, 'admin_settings'), (s) => { if(s.exists()) currentWeek = s.val().activeWeek; });
            }
        } else { window.location.href = "login.html"; }
        if (document.getElementById('initialLoader')) document.getElementById('initialLoader').classList.add('hidden');
    });

    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.onclick = async () => {
            const files = Array.from(document.getElementById('imageInput').files);
            if (files.length === 0) return alert("اختر الصور أولاً");
            toggleStatus(true, "جاري تحويل الصور إلى PDF... ⏳");
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            for (let i = 0; i < files.length; i++) {
                if (i > 0) doc.addPage();
                const imgData = await readFileAsDataURL(files[i]);
                const props = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (props.height * pdfWidth) / props.width;
                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            finalPdfBlob = doc.output('blob');
            document.getElementById('pdfFrame').innerHTML = `<iframe src="${URL.createObjectURL(finalPdfBlob)}" class="w-full h-full border-none"></iframe>`;
            document.getElementById('previewArea').classList.remove('hidden');
            toggleStatus(false);
        };
    }

    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return;
            const now = new Date();
            const dateStr = `${now.getDate()}-${now.getMonth() + 1}`;
            const fileName = `${currentUserData.fullName.replace(/\s+/g, '-')}-${dateStr}`;

            const formData = new FormData();
            formData.append("file", finalPdfBlob);
            formData.append("upload_preset", UPLOAD_PRESET);
            formData.append("public_id", fileName);

            try {
                toggleStatus(true, "جاري الرفع باسم: " + fileName + " 🚀");
                const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
                const data = await res.json();
                if (data.secure_url) {
                    await set(ref(db, `submissions/${currentWeek}/${auth.currentUser.uid}`), {
                        studentName: currentUserData.fullName,
                        academicIndex: currentUserData.academicIndex,
                        fileUrl: data.secure_url,
                        submittedAt: new Date().toLocaleString('ar-EG')
                    });
                    toggleStatus(true, "✅ تم التسليم بنجاح!");
                    setTimeout(() => toggleStatus(false), 3000);
                }
            } catch (e) { alert("خطأ: " + e.message); toggleStatus(false); }
        };
    }
}

// --- 4. منطق صفحة الأدمن (الليدر) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; }
        else {
            // تحديث الإعدادات (المادة والأسبوع)
            onValue(ref(db, 'admin_settings'), (snapshot) => {
                if (snapshot.exists()) {
                    const settings = snapshot.val();
                    currentWeek = settings.activeWeek;
                    currentSubject = settings.subjectName;
                    document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                    document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                    loadSubmissions(); // إعادة تحميل الجدول عند تغيير الأسبوع
                }
            });
            // جلب إحصائية المسجلين من Firebase
            onValue(ref(db, 'users'), (snap) => {
                document.getElementById('totalStudents').innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
            });
        }
    });

    function loadSubmissions() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            const tableBody = document.getElementById('adminTableBody');
            tableBody.innerHTML = "";
            if (snap.exists()) {
                const subs = Object.values(snap.val());
                document.getElementById('weekSubmissions').innerText = subs.length;
                subs.forEach(sub => {
                    tableBody.innerHTML += `
                        <tr class="border-b border-slate-700">
                            <td class="p-4 font-bold">${sub.studentName}</td>
                            <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                            <td class="p-4 text-xs text-slate-400">${sub.submittedAt}</td>
                            <td class="p-4"><a href="${sub.fileUrl}" target="_blank" class="text-green-400 font-bold hover:underline">فتح PDF</a></td>
                        </tr>`;
                });
            } else {
                document.getElementById('weekSubmissions').innerText = "0";
                tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-500">لا توجد تسليمات لهذا الأسبوع</td></tr>`;
            }
        });
    }

    // زر الترس
    window.toggleSettings = () => {
        const newSubject = prompt("اسم المادة:", currentSubject);
        const newWeek = prompt("رمز الأسبوع (مثال: week_2):", currentWeek);
        if (newSubject && newWeek) {
            set(ref(db, 'admin_settings'), { activeWeek: newWeek, subjectName: newSubject });
        }
    };
    
    // زر تحميل ZIP
    document.getElementById('downloadZipBtn').onclick = async () => {
        const subSnap = await get(ref(db, `submissions/${currentWeek}`));
        if (!subSnap.exists()) return alert("لا توجد ملفات");
        const btn = document.getElementById('downloadZipBtn');
        btn.innerText = "جاري التحميل... ⏳";
        const zip = new JSZip();
        const folder = zip.folder(currentWeek);
        const subs = Object.values(subSnap.val());
        for (const sub of subs) {
            const res = await fetch(sub.fileUrl);
            const blob = await res.blob();
            folder.file(`${sub.studentName}-${sub.academicIndex}.pdf`, blob);
        }
        zip.generateAsync({type:"blob"}).then(c => { saveAs(c, `${currentWeek}.zip`); btn.innerText = "تحميل الكل (ZIP)"; });
    };
}

// --- 5. وظائف عامة ---
function readFileAsDataURL(file) { return new Promise(res => { const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.readAsDataURL(file); }); }
function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) { statusText.innerText = text; show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden'); }
}
function renderVerificationUI(email) {
    document.body.innerHTML = `<div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50"><div class="bg-white p-10 rounded-[3rem] shadow-xl max-w-md"><h1 class="text-2xl font-bold mb-4">فعل حسابك</h1><p class="mb-6">أرسلنا رابطاً لـ: ${email}</p><button onclick="location.reload()" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold">تحديث ✅</button></div></div>`;
}
window.handleLogout = () => signOut(auth).then(() => location.href = "login.html");
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href = "login.html"));
