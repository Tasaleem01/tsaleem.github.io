import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. الإعدادات ---
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
let currentWeek = "week_1"; 
let currentSubject = "الكهرباء";
let allSubmissions = []; // للبحث
const page = window.location.pathname.split("/").pop() || "index.html";

// --- 2. منطق صفحة الطالب (index.html) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        if (!user.emailVerified) { renderVerificationUI(user.email); return; }

        const snap = await get(ref(db, 'users/' + user.uid));
        if (snap.exists()) {
            currentUserData = snap.val();
            document.getElementById('displayUserName').innerText = currentUserData.fullName;
            document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
            document.getElementById('displayCollege').innerText = currentUserData.college;
            
            // مراقبة الإعدادات (الأسبوع والموعد النهائي)
            onValue(ref(db, 'admin_settings'), (s) => {
                if(s.exists()) {
                    const settings = s.val();
                    currentWeek = settings.activeWeek;
                    const deadline = settings.deadline;
                    const now = new Date().getTime();

                    // منطق الإغلاق التلقائي (يفتح بعد يوم ونصف من الموعد النهائي)
                    const openAfter = deadline + (1.5 * 24 * 60 * 60 * 1000);

                    if (deadline && now > deadline && now < openAfter) {
                        document.getElementById('mainContent').innerHTML = `
                            <div class="text-center p-10 bg-red-500/10 border border-red-500/20 rounded-3xl">
                                <h2 class="text-2xl font-bold text-red-500">تم إغلاق التسليم مؤقتاً 🛑</h2>
                                <p class="mt-2 text-slate-400">انتهى الموعد النهائي. سيفتح الموقع تلقائياً بعد انتهاء فترة التصحيح.</p>
                            </div>`;
                    }
                    document.getElementById('mainContent').classList.remove('hidden');
                }
            });

            // مراقبة التنبيهات (في حال حذف الأدمن ملف)
            onValue(ref(db, `notifications/${user.uid}`), (nSnap) => {
                if (nSnap.exists()) {
                    const notify = nSnap.val();
                    const alertDiv = document.createElement('div');
                    alertDiv.className = "bg-red-600 text-white p-4 rounded-2xl mb-6 font-bold animate-pulse text-center";
                    alertDiv.innerHTML = `⚠️ تنبيه: ${notify.message} <button onclick="this.parentElement.remove()" class="float-left">✖</button>`;
                    document.getElementById('mainContent').prepend(alertDiv);
                }
            });
        }
    });

    // (بقية كود الرفع الموجود عندك في main.js الأصلي يوضع هنا...)
    // تم اختصارها هنا لسهولة القراءة ولكنها ستبقى تعمل كما هي في ملفك
}

// --- 3. منطق صفحة الأدمن (admin.html) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; }
        else {
            onValue(ref(db, 'admin_settings'), (snapshot) => {
                if (snapshot.exists()) {
                    const settings = snapshot.val();
                    currentWeek = settings.activeWeek;
                    currentSubject = settings.subjectName;
                    const deadline = settings.deadline;
                    document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                    document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                    if(deadline) document.getElementById('deadlineLabel').innerText = `الموعد النهائي: ${new Date(deadline).toLocaleString('ar-EG')}`;
                    loadSubmissions();
                }
            });
            onValue(ref(db, 'users'), (snap) => {
                document.getElementById('totalStudents').innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
            });
        }
    });

    function loadSubmissions() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            const tableBody = document.getElementById('adminTableBody');
            if (snap.exists()) {
                allSubmissions = Object.entries(snap.val());
                renderTable(allSubmissions);
                document.getElementById('weekSubmissions').innerText = allSubmissions.length;
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-500 text-lg font-bold">لا توجد تسليمات حالياً 💨</td></tr>`;
                document.getElementById('weekSubmissions').innerText = "0";
            }
        });
    }

    function renderTable(data) {
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";
        data.forEach(([uid, sub]) => {
            tableBody.innerHTML += `
                <tr class="border-b border-slate-700 hover:bg-slate-800 transition-all">
                    <td class="p-4 font-bold">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-xs text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex justify-center gap-2">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-500/20 text-blue-400 px-3 py-2 rounded-xl text-xs font-bold border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all">فتح PDF</a>
                        <button onclick="deleteSubmission('${uid}', '${sub.studentName}')" class="bg-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">حذف</button>
                    </td>
                </tr>`;
        });
    }

    // ميزة البحث
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSubmissions.filter(([uid, sub]) => 
            sub.studentName.toLowerCase().includes(term) || sub.academicIndex.includes(term)
        );
        renderTable(filtered);
    });

    // ميزة الحذف مع تنبيه الطالب
    window.deleteSubmission = async (uid, name) => {
        if (confirm(`هل أنت متأكد من حذف تسليم المهندس: ${name}؟`)) {
            try {
                await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
                await set(ref(db, `notifications/${uid}`), {
                    message: `تم حذف ملفك الخاص بـ (${currentSubject}) - أسبوع (${currentWeek}). يرجى التأكد من جودة الملف وإعادة الرفع.`,
                    timestamp: new Date().getTime()
                });
                alert("تم الحذف وتنبيه الطالب بنجاح.");
            } catch (e) { alert("خطأ: " + e.message); }
        }
    };

    window.toggleSettings = () => {
        const newSubject = prompt("اسم المادة الجديدة:", currentSubject);
        const newWeek = prompt("رمز الأسبوع الجديد (مثلاً week_2):", currentWeek);
        const deadlineInput = prompt("الموعد النهائي (مثال: 2026-01-15 23:59):", "");
        
        if (newSubject && newWeek) {
            const deadlineTime = deadlineInput ? new Date(deadlineInput).getTime() : null;
            set(ref(db, 'admin_settings'), { 
                activeWeek: newWeek, 
                subjectName: newSubject,
                deadline: deadlineTime 
            });
        }
    };

    // (كود تحميل الـ ZIP يبقى كما هو في ملفك الأصلي...)
}

// --- وظائف مساعدة ---
function readFileAsDataURL(file) { return new Promise(res => { const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.readAsDataURL(file); }); }
function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) { statusText.innerText = text; show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden'); }
}
function renderVerificationUI(email) {
    document.body.innerHTML = `<div class="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-center"><div class="bg-slate-800 p-10 rounded-[2rem] border border-slate-700 shadow-2xl"><h1 class="text-2xl font-bold mb-4 italic">📧 تفعيل الحساب</h1><p class="text-slate-400 mb-6">أرسلنا الرابط لبريدك:<br><span class="text-blue-400 font-bold">${email}</span></p><button onclick="location.reload()" class="w-full bg-blue-600 py-3 rounded-xl font-bold">تحديث ✅</button></div></div>`;
}
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href = "login.html"));
