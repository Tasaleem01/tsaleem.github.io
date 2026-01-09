import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. الإعدادات الأساسية ---
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

let currentWeek = "week_1";
let currentSubject = "الكهرباء";
let allSubmissions = []; // لتخزين التسليمات
let allUsers = {};       // لتخزين المسجلين
const page = window.location.pathname.split("/").pop() || "index.html";

// --- 2. منطق صفحة الأدمن (admin.html) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        // جلب الإعدادات (المادة، الأسبوع، الموعد النهائي)
        onValue(ref(db, 'admin_settings'), (snap) => {
            if (snap.exists()) {
                const settings = snap.val();
                currentWeek = settings.activeWeek;
                currentSubject = settings.subjectName;
                const deadline = settings.deadline;
                
                document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                if(deadline) {
                    document.getElementById('deadlineLabel').innerText = `الموعد النهائي: ${new Date(deadline).toLocaleString('ar-EG')}`;
                }
                loadSubmissions();
            }
        });

        // جلب قائمة المستخدمين المسجلين
        onValue(ref(db, 'users'), (snap) => {
            if (snap.exists()) {
                allUsers = snap.val();
                document.getElementById('totalStudents').innerText = Object.keys(allUsers).length;
            }
        });
    });

    // تحميل وعرض جدول التسليمات
    function loadSubmissions() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            const tableBody = document.getElementById('adminTableBody');
            if (snap.exists()) {
                allSubmissions = Object.entries(snap.val());
                renderMainTable(allSubmissions);
                document.getElementById('weekSubmissions').innerText = allSubmissions.length;
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-slate-500 font-bold">لا توجد تسليمات لهذا الأسبوع 💨</td></tr>`;
                document.getElementById('weekSubmissions').innerText = "0";
            }
        });
    }

    function renderMainTable(data) {
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";
        data.forEach(([uid, sub]) => {
            tableBody.innerHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800 transition-all group">
                    <td class="p-4 font-bold text-slate-200">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex justify-center gap-2">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold border border-blue-600/20 hover:bg-blue-600 transition-all">فتح PDF</a>
                        <button onclick="deleteSubmission('${uid}', '${sub.studentName}')" class="bg-red-600/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold border border-red-600/20 hover:bg-red-500 hover:text-white transition-all">حذف الملف</button>
                    </td>
                </tr>`;
        });
    }

    // --- 🔍 ميزة البحث ---
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSubmissions.filter(([uid, sub]) => 
            sub.studentName.toLowerCase().includes(term) || sub.academicIndex.includes(term)
        );
        renderMainTable(filtered);
    });

    // --- 👥 ميزة إدارة الطلاب (المسجلين / غير المسجلين) ---
    window.openStudentsModal = () => {
        const listArea = document.getElementById('studentsListArea');
        listArea.innerHTML = "";
        document.getElementById('studentsModal').classList.remove('hidden');

        const submittedUIDs = allSubmissions.map(item => item[0]); 
        let done = 0, pending = 0;

        Object.entries(allUsers).forEach(([uid, user]) => {
            const hasSub = submittedUIDs.includes(uid);
            hasSub ? done++ : pending++;

            listArea.innerHTML += `
                <div class="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-700/50 rounded-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full ${hasSub ? 'bg-emerald-500 shadow-[0_0_10px_emerald]' : 'bg-red-500'}"></div>
                        <div>
                            <p class="font-bold text-sm">${user.fullName}</p>
                            <p class="text-[10px] text-slate-500 font-mono">${user.academicIndex} | ${user.college}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[9px] font-black px-2 py-1 rounded ${hasSub ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">${hasSub ? 'تم التسليم' : 'لم يسلم'}</span>
                        <button onclick="deleteUserAccount('${uid}', '${user.fullName}')" class="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all">🗑️</button>
                    </div>
                </div>`;
        });
        document.getElementById('countDone').innerText = done;
        document.getElementById('countPending').innerText = pending;
    };

    window.closeStudentsModal = () => document.getElementById('studentsModal').classList.add('hidden');

    // حذف حساب مستخدم نهائياً
    window.deleteUserAccount = async (uid, name) => {
        if (confirm(`⚠️ هل أنت متأكد من حذف حساب الطالب "${name}"؟ لن يتمكن من دخول الموقع وسيتم مسح بياناته.`)) {
            await set(ref(db, `users/${uid}`), null);
            await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
            alert("تم الحذف بنجاح.");
            openStudentsModal(); // تحديث القائمة فوراً
        }
    };

    // حذف تسليم ملف مع تنبيه الطالب
    window.deleteSubmission = async (uid, name) => {
        if (confirm(`حذف ملف المهندس: ${name}؟`)) {
            await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
            await set(ref(db, `notifications/${uid}`), {
                message: `تم حذف ملفك (${currentSubject}) - (${currentWeek}). يرجى إعادة الرفع بجودة أفضل.`,
                timestamp: new Date().getTime()
            });
            alert("تم حذف الملف وإبلاغ الطالب.");
        }
    };

    // --- ⚙️ الإعدادات ---
    window.openSettings = () => {
        document.getElementById('setSubject').value = currentSubject;
        document.getElementById('setWeek').value = currentWeek;
        document.getElementById('settingsModal').classList.remove('hidden');
    };
    window.closeSettings = () => document.getElementById('settingsModal').classList.add('hidden');
    window.saveSettings = () => {
        const sub = document.getElementById('setSubject').value;
        const wk = document.getElementById('setWeek').value;
        const dl = document.getElementById('setDeadline').value;
        if (sub && wk) {
            set(ref(db, 'admin_settings'), {
                activeWeek: wk,
                subjectName: sub,
                deadline: dl ? new Date(dl).getTime() : null
            }).then(() => { closeSettings(); alert("تم التحديث ✅"); });
        }
    };

    // --- 📦 تحميل ZIP ---
    document.getElementById('downloadZipBtn').onclick = async () => {
        if (allSubmissions.length === 0) return alert("لا توجد تسليمات");
        const btn = document.getElementById('downloadZipBtn');
        btn.disabled = true;
        const zip = new JSZip();
        const folder = zip.folder(`${currentSubject}-${currentWeek}`);
        
        const promises = allSubmissions.map(async ([uid, sub]) => {
            const res = await fetch(sub.fileUrl);
            const blob = await res.blob();
            folder.file(`${sub.studentName.replace(/\s+/g, '_')}-${sub.academicIndex}.pdf`, blob);
        });
        
        await Promise.all(promises);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${currentSubject}-${currentWeek}.zip`);
        btn.disabled = false;
    };
}

// --- 3. منطق صفحة الطالب (index.html) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        // 1. فحص التنبيهات (لو الأدمن حذف ملفه)
        onValue(ref(db, `notifications/${user.uid}`), (snap) => {
            if (snap.exists()) {
                const notify = snap.val();
                const notifyArea = document.getElementById('notifyArea');
                if (notifyArea) {
                    notifyArea.innerHTML = `<div class="bg-red-600 text-white p-4 rounded-2xl mb-4 font-bold shadow-lg animate-pulse flex justify-between">
                        <span>⚠️ ${notify.message}</span>
                        <button onclick="this.parentElement.remove()">✕</button>
                    </div>`;
                }
            }
        });

        // 2. فحص الموعد النهائي (إغلاق الرفع)
        onValue(ref(db, 'admin_settings'), (snap) => {
            if (snap.exists()) {
                const { deadline } = snap.val();
                const now = new Date().getTime();
                const reopenTime = deadline + (1.5 * 24 * 60 * 60 * 1000); // يفتح بعد 36 ساعة

                if (deadline && now > deadline && now < reopenTime) {
                    const main = document.getElementById('mainContent');
                    if(main) main.innerHTML = `<div class="p-10 text-center bg-slate-800 rounded-[3rem] border border-red-500/20 shadow-2xl">
                        <div class="text-7xl mb-6">🛑</div>
                        <h2 class="text-2xl font-black text-red-500 mb-3">التسليم مغلق حالياً</h2>
                        <p class="text-slate-400 font-bold">انتهى الموعد النهائي لهذا الأسبوع. سيفتح الموقع تلقائياً لاحقاً.</p>
                    </div>`;
                }
            }
        });
    });
}

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "login.html");
});
