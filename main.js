import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const auth = getAuth(app);
const db = getDatabase(app);

let currentWeek = "week_1";
let currentSubject = "الكهرباء";
let allSubmissions = []; 
const page = window.location.pathname.split("/").pop() || "index.html";

// --- ⚙️ منطق الأدمن (admin.html) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; }
        else {
            // مراقبة الإعدادات
            onValue(ref(db, 'admin_settings'), (snap) => {
                if (snap.exists()) {
                    const settings = snap.val();
                    currentWeek = settings.activeWeek;
                    currentSubject = settings.subjectName;
                    const deadline = settings.deadline;
                    
                    document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                    document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                    if(deadline) {
                        const dateObj = new Date(deadline);
                        document.getElementById('deadlineLabel').innerText = `الموعد النهائي: ${dateObj.toLocaleString('ar-EG')}`;
                    }
                    loadSubmissions();
                }
            });

            // إحصائيات الطلاب المسجلين
            onValue(ref(db, 'users'), (snap) => {
                document.getElementById('totalStudents').innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
            });
        }
    });

    // تحميل وعرض التسليمات
    function loadSubmissions() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            const tableBody = document.getElementById('adminTableBody');
            if (snap.exists()) {
                allSubmissions = Object.entries(snap.val());
                renderTable(allSubmissions);
                document.getElementById('weekSubmissions').innerText = allSubmissions.length;
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-slate-500 italic font-bold text-lg">لا توجد تسليمات للأسبوع الحالي حتى الآن 💨</td></tr>`;
                document.getElementById('weekSubmissions').innerText = "0";
            }
        });
    }

    function renderTable(data) {
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";
        data.forEach(([uid, sub]) => {
            tableBody.innerHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800 transition-all group">
                    <td class="p-4 font-bold text-slate-200">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex justify-center gap-2">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all">فتح PDF</a>
                        <button onclick="deleteSubmission('${uid}', '${sub.studentName}')" class="bg-red-600/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold border border-red-600/20 hover:bg-red-600 hover:text-white transition-all">حذف</button>
                    </td>
                </tr>`;
        });
    }

    // البحث الفوري
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSubmissions.filter(([uid, sub]) => 
            sub.studentName.toLowerCase().includes(term) || sub.academicIndex.includes(term)
        );
        renderTable(filtered);
    });

    // الحذف وإرسال التنبيه
    window.deleteSubmission = async (uid, name) => {
        if (confirm(`هل أنت متأكد من حذف تسليم المهندس: ${name}؟`)) {
            try {
                await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
                await set(ref(db, `notifications/${uid}`), {
                    message: `تم حذف ملفك (${currentSubject}) - (${currentWeek}). يرجى إعادة رفعه مرة أخرى.`,
                    timestamp: new Date().getTime()
                });
                alert("تم الحذف وتنبيه الطالب.");
            } catch (e) { alert("خطأ: " + e.message); }
        }
    };

    // وظائف النافذة المنبثقة (Modal)
    window.openSettings = () => {
        document.getElementById('setSubject').value = currentSubject;
        document.getElementById('setWeek').value = currentWeek;
        document.getElementById('settingsModal').classList.remove('hidden');
    };
    window.closeSettings = () => document.getElementById('settingsModal').classList.add('hidden');

    window.saveSettings = () => {
        const subject = document.getElementById('setSubject').value;
        const week = document.getElementById('setWeek').value;
        const deadline = document.getElementById('setDeadline').value; // التقاط قيمة datetime-local

        if (subject && week) {
            const settingsUpdate = {
                activeWeek: week,
                subjectName: subject,
                deadline: deadline ? new Date(deadline).getTime() : null
            };
            set(ref(db, 'admin_settings'), settingsUpdate).then(() => {
                closeSettings();
                alert("تم حفظ الإعدادات بنجاح ✅");
            });
        }
    };

    // وظيفة تحميل ملف الـ ZIP
    document.getElementById('downloadZipBtn').onclick = async () => {
        if (allSubmissions.length === 0) return alert("لا توجد ملفات حالياً");
        
        const btn = document.getElementById('downloadZipBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="text-2xl animate-spin">⏳</span><span class="font-bold">جاري التجميع...</span>`;
        btn.disabled = true;

        const zip = new JSZip();
        const folder = zip.folder(`${currentSubject}-${currentWeek}`);

        try {
            const downloadPromises = allSubmissions.map(async ([uid, sub]) => {
                try {
                    const response = await fetch(sub.fileUrl);
                    const blob = await response.blob();
                    const fileName = `${sub.studentName.replace(/\s+/g, '_')}-${sub.academicIndex}.pdf`;
                    folder.file(fileName, blob);
                } catch (e) { console.error("Error downloading student file", sub.studentName); }
            });

            await Promise.all(downloadPromises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${currentSubject}-${currentWeek}.zip`);
        } catch (e) { alert("خطأ في التحميل: " + e.message); }
        finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
}

// --- 🏠 منطق الطالب (index.html) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        // 1. مراقبة التنبيهات (إذا حذف الأدمن ملف)
        onValue(ref(db, `notifications/${user.uid}`), (nSnap) => {
            if (nSnap.exists()) {
                const notify = nSnap.val();
                const notifyArea = document.getElementById('notifyArea'); // تأكد من وجود div بهذا الـ id في index.html
                if (notifyArea) {
                    notifyArea.innerHTML = `
                        <div class="bg-red-600/20 text-red-400 p-4 rounded-2xl mb-4 border border-red-500/30 font-bold flex justify-between items-center">
                            <span>⚠️ ${notify.message}</span>
                            <button onclick="this.parentElement.remove()" class="text-xl">&times;</button>
                        </div>`;
                }
            }
        });

        // 2. فحص الموعد النهائي (الإغلاق التلقائي)
        onValue(ref(db, 'admin_settings'), (s) => {
            if (s.exists()) {
                const settings = s.val();
                const deadline = settings.deadline;
                const now = new Date().getTime();
                const openAgain = deadline + (1.5 * 24 * 60 * 60 * 1000); // يفتح بعد يوم ونصف

                if (deadline && now > deadline && now < openAgain) {
                    const content = document.getElementById('mainContent');
                    if (content) {
                        content.innerHTML = `
                            <div class="p-10 text-center bg-slate-800 rounded-[3rem] border border-red-500/20 shadow-2xl">
                                <div class="text-6xl mb-4">🛑</div>
                                <h2 class="text-2xl font-bold text-red-500 mb-2">عفواً، باب التسليم مغلق</h2>
                                <p class="text-slate-400">لقد انتهى الموعد النهائي لهذا الأسبوع. سيتم فتح الموقع تلقائياً بعد تصحيح الملفات.</p>
                            </div>`;
                    }
                }
            }
        });
    });
}

// زر الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "login.html");
});
