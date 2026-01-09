import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let currentWeek = "week_1", currentSubject = "المادة", currentDeadline = null;
let allSubmissions = [], allUsers = {}, currentUserData = {}, finalPdfBlob = null;
let tableBatch = 20, studentBatch = 20, tableIndex = 0, studentIndex = 0;

const page = window.location.pathname.split("/").pop() || "index.html";

// --- نظام مراقبة الدخول العام ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (page !== "login.html" && page !== "register.html") window.location.href = "login.html";
        return;
    }

    // جلب الإعدادات العامة (مادة، أسبوع) لجميع الصفحات
    onValue(ref(db, 'admin_settings'), (snap) => {
        if (snap.exists()) {
            const s = snap.val();
            currentWeek = s.activeWeek;
            currentSubject = s.subjectName;
            currentDeadline = s.deadline;
            
            if (page === "admin.html") updateAdminUI();
            if (page === "index.html") updateStudentUI();
        }
    });

    // جلب بيانات المستخدم المسجل
    const userSnap = await get(ref(db, `users/${user.uid}`));
    if (userSnap.exists()) {
        currentUserData = userSnap.val();
        if (page === "index.html") setupStudentPage(user.uid);
    } else if (page === "index.html") {
        document.getElementById('initialLoader').remove();
        document.getElementById('accessDenied').classList.remove('hidden');
    }
});

// ==========================================
// 1. منطق الطالب (index.html)
// ==========================================
function updateStudentUI() {
    const title = document.getElementById('weekTaskTitle');
    const deadlineLabel = document.getElementById('deadlineInfo');
    if (title) title.innerText = `📂 تكليف: ${currentSubject} (${currentWeek})`;
    
    if (currentDeadline) {
        const dlDate = new Date(currentDeadline);
        if (deadlineLabel) deadlineLabel.innerText = `أقصى موعد: ${dlDate.toLocaleString('ar-EG')}`;
        
        // إغلاق الرفع إذا انتهى الوقت
        if (new Date().getTime() > currentDeadline) {
            const card = document.getElementById('uploadCard');
            card.innerHTML = `<div class="text-center p-10"><h3 class="text-red-500 font-bold text-xl">🛑 انتهى وقت التسليم لهذا الأسبوع</h3></div>`;
        }
    }
}

function setupStudentPage(uid) {
    document.getElementById('displayUserName').innerText = currentUserData.fullName;
    document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
    document.getElementById('displayCollege').innerText = currentUserData.college;
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('initialLoader')?.remove();

    // استماع للتنبيهات
    onValue(ref(db, `notifications/${uid}`), (snap) => {
        if (snap.exists()) {
            alert(`⚠️ تنبيه من الليدر: ${snap.val().message}`);
            set(ref(db, `notifications/${uid}`), null);
        }
    });

    // أحداث الطالب
    document.getElementById('dropZone')?.addEventListener('click', () => document.getElementById('imageInput').click());
    document.getElementById('imageInput')?.addEventListener('change', (e) => {
        const status = document.getElementById('fileStatus');
        status.innerText = `تم اختيار ${e.target.files.length} صور`;
        status.classList.remove('hidden');
    });

    document.getElementById('convertBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('imageInput');
        if (input.files.length === 0) return alert("اختر الصور أولاً");
        
        showStudentStatus("جاري إنشاء ملف PDF...");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        for (let i = 0; i < input.files.length; i++) {
            const imgData = await readFile(input.files[i]);
            if (i > 0) pdf.addPage();
            const pdfWidth = pdf.internal.pageSize.getWidth();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, 200); 
            updateStudentProgress(((i + 1) / input.files.length) * 100);
        }

        finalPdfBlob = pdf.output('blob');
        document.getElementById('pdfFrame').innerHTML = `<iframe src="${URL.createObjectURL(finalPdfBlob)}" class="w-full h-full border-none"></iframe>`;
        document.getElementById('previewArea').classList.remove('hidden');
        hideStudentStatus();
    });

    document.getElementById('finalSubmit')?.addEventListener('click', async () => {
        if (!finalPdfBlob) return;
        showStudentStatus("جاري الإرسال لليدر...");
        
        // ملاحظة: هنا يجب استبدال الرابط بـ Cloudinary الخاص بك أو استخدام Firebase Storage
        // للتبسيط، سنحفظ البيانات وسأفترض أنك ستضيف دالة الرفع للسحابة هنا
        const submissionData = {
            studentName: currentUserData.fullName,
            academicIndex: currentUserData.academicIndex,
            fileUrl: "رابط_الملف_السحابي", // استبدله برابط الرفع
            submittedAt: new Date().toLocaleString('ar-EG')
        };

        await set(ref(db, `submissions/${currentWeek}/${auth.currentUser.uid}`), submissionData);
        alert("تم التسليم بنجاح ✅");
        location.reload();
    });
}

// ==========================================
// 2. منطق الأدمن (admin.html)
// ==========================================
function updateAdminUI() {
    document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
    document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
    if (currentDeadline) {
        document.getElementById('deadlineLabel').innerText = `الموعد: ${new Date(currentDeadline).toLocaleString('ar-EG')}`;
    }
    loadAdminData();
}

function loadAdminData() {
    onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
        allSubmissions = snap.exists() ? Object.entries(snap.val()) : [];
        document.getElementById('weekSubmissions').innerText = allSubmissions.length;
        renderAdminTable();
    });
    onValue(ref(db, 'users'), (snap) => {
        allUsers = snap.exists() ? snap.val() : {};
        document.getElementById('totalStudents').innerText = Object.keys(allUsers).length;
    });
}

function renderAdminTable(append = false) {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    if (!append) { tbody.innerHTML = ""; tableIndex = 0; }
    const next = allSubmissions.slice(tableIndex, tableIndex + tableBatch);
    next.forEach(([uid, sub]) => {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800 transition-all">
                <td class="p-4 font-bold text-slate-200">${sub.studentName}</td>
                <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                <td class="p-4 flex justify-center gap-2">
                    <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs">فتح</a>
                    <button onclick="deleteSubmission('${uid}', '${sub.studentName}')" class="bg-red-600/10 text-red-500 px-3 py-1 rounded-lg text-xs border border-red-500/20">حذف</button>
                </td>
            </tr>`);
    });
    tableIndex += tableBatch;
}

// أضف دوال الحذف والإعدادات للأدمن (كما في الكود السابق)
window.deleteSubmission = async (uid, name) => {
    if (confirm(`حذف ملف ${name}؟`)) {
        await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
        await set(ref(db, `notifications/${uid}`), { message: `تم حذف ملفك في ${currentSubject}. أعد الرفع.` });
        allSubmissions = allSubmissions.filter(i => i[0] !== uid);
        renderAdminTable();
    }
};

// ==========================================
// أدوات مساعدة (Utilities)
// ==========================================
function readFile(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function showStudentStatus(t) { 
    const o = document.getElementById('statusOverlay');
    if(o) { document.getElementById('statusText').innerText = t; o.classList.remove('hidden'); }
}
function hideStudentStatus() { document.getElementById('statusOverlay')?.classList.add('hidden'); }
function updateStudentProgress(v) { 
    const b = document.getElementById('progressBar');
    if(b) b.style.width = v + '%'; 
}

// تسجيل الخروج الموحد
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href="login.html"));
