import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let currentWeek = "week_1", currentSubject = "المادة";
let allSubmissions = [], allUsers = {};
let tableBatch = 20, studentBatch = 20;
let tableIndex = 0, studentIndex = 0;
const page = window.location.pathname.split("/").pop() || "index.html";

// --- منطق صفحة الأدمن (admin.html) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; return; }

        // 1. مزامنة الإعدادات
        onValue(ref(db, 'admin_settings'), (snap) => {
            if (snap.exists()) {
                const s = snap.val();
                currentWeek = s.activeWeek; 
                currentSubject = s.subjectName;
                document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                if(s.deadline) {
                    const dlDate = new Date(s.deadline);
                    document.getElementById('deadlineLabel').innerText = `الموعد النهائي: ${dlDate.toLocaleString('ar-EG')}`;
                }
                loadSubmissions(); 
            }
        });

        // 2. مزامنة المسجلين
        onValue(ref(db, 'users'), (snap) => {
            if (snap.exists()) {
                allUsers = snap.val();
                document.getElementById('totalStudents').innerText = Object.keys(allUsers).length;
            }
        });
    });

    function loadSubmissions() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            if (snap.exists()) {
                allSubmissions = Object.entries(snap.val());
                document.getElementById('weekSubmissions').innerText = allSubmissions.length;
                renderMainTable();
            } else {
                allSubmissions = [];
                document.getElementById('adminTableBody').innerHTML = `<tr><td colspan="4" class="p-20 text-center font-bold text-slate-500 italic">لا توجد تسليمات حتى الآن 💨</td></tr>`;
                document.getElementById('weekSubmissions').innerText = "0";
            }
        });
    }

    function renderMainTable(append = false) {
        const tbody = document.getElementById('adminTableBody');
        if (!append) { tbody.innerHTML = ""; tableIndex = 0; }

        const nextBatch = allSubmissions.slice(tableIndex, tableIndex + tableBatch);
        nextBatch.forEach(([uid, sub]) => {
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-all">
                    <td class="p-4 font-bold text-slate-200">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex justify-center gap-2">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all">فتح PDF</a>
                        <button onclick="deleteSubmission('${uid}', '${sub.studentName}')" class="bg-red-600/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold border border-red-600/20 hover:bg-red-500 hover:text-white transition-all">حذف</button>
                    </td>
                </tr>`);
        });
        tableIndex += tableBatch;
    }

    window.deleteSubmission = async (uid, name) => {
        if (confirm(`هل تريد حذف ملف المهندس: ${name}؟ سيتم إرسال تنبيه له.`)) {
            try {
                await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
                await set(ref(db, `notifications/${uid}`), {
                    message: `تم حذف ملفك في ${currentSubject} - ${currentWeek}. يرجى إعادة الرفع فوراً.`,
                    timestamp: new Date().getTime()
                });
                allSubmissions = allSubmissions.filter(item => item[0] !== uid);
                renderMainTable();
                document.getElementById('weekSubmissions').innerText = allSubmissions.length;
            } catch (e) { alert("خطأ في الحذف: " + e.message); }
        }
    };

    document.getElementById('downloadZipBtn').onclick = async () => {
        if (allSubmissions.length === 0) {
            alert("⚠️ لا توجد تسليمات لتحميلها حالياً في هذا الأسبوع!");
            return;
        }
        const btn = document.getElementById('downloadZipBtn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin text-2xl">⏳</span> <span class="font-bold">جاري التجميع...</span>`;
        try {
            const zip = new JSZip();
            const folder = zip.folder(`${currentSubject}-${currentWeek}`);
            const promises = allSubmissions.map(async ([uid, sub]) => {
                const res = await fetch(sub.fileUrl);
                const blob = await res.blob();
                const fileName = `${sub.studentName.replace(/\s+/g, '_')}-${sub.academicIndex}.pdf`;
                folder.file(fileName, blob);
            });
            await Promise.all(promises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${currentSubject}-${currentWeek}.zip`);
        } catch (e) { alert("خطأ أثناء إنشاء ZIP: " + e.message); }
        finally { btn.innerHTML = originalContent; btn.disabled = false; }
    };

    window.openStudentsModal = () => {
        document.getElementById('studentsListArea').innerHTML = "";
        studentIndex = 0;
        document.getElementById('studentsModal').classList.remove('hidden');
        renderStudentsList();
    };

    // --- الوظيفة التي تم إصلاحها للربط الصحيح ---
    function renderStudentsList() {
        const area = document.getElementById('studentsListArea');
        const userEntries = Object.entries(allUsers);
        
        // استخراج قائمة الأرقام الأكاديمية ممن قاموا بالتسليم في الأسبوع الحالي
        const submittedAcademicIndices = allSubmissions.map(item => String(item[1].academicIndex));

        let done = 0, pending = 0;
        userEntries.forEach(([uid, user]) => {
            const academicId = String(user.academicIndex || user.academicId);
            if (submittedAcademicIndices.includes(academicId)) {
                done++;
            } else {
                pending++;
            }
        });

        document.getElementById('countDone').innerText = done;
        document.getElementById('countPending').innerText = pending;

        const next = userEntries.slice(studentIndex, studentIndex + studentBatch);
        next.forEach(([uid, user]) => {
            const academicId = String(user.academicIndex || user.academicId);
            const hasSub = submittedAcademicIndices.includes(academicId);
            
            area.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-700/50 rounded-2xl mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full ${hasSub ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}"></div>
                        <div>
                            <p class="text-sm font-bold text-slate-200">${user.fullName}</p>
                            <p class="text-[9px] text-slate-500 font-mono">${user.academicIndex} | ${user.college || 'غير محدد'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[9px] font-black px-2 py-1 rounded bg-slate-800 ${hasSub ? 'text-emerald-400' : 'text-red-400'}">${hasSub ? 'تَمَّ التسليم' : 'لَمْ يُسَلِّم'}</span>
                        <button onclick="deleteUserAccount('${uid}', '${user.fullName}')" class="text-red-500 p-2 hover:bg-red-500/10 rounded-lg">🗑️</button>
                    </div>
                </div>`);
        });
        studentIndex += studentBatch;
    }

    window.deleteUserAccount = async (uid, name) => {
        if (confirm(`⚠️ تحذير: سيتم حذف حساب "${name}" نهائياً من النظام. هل أنت متأكد؟`)) {
            await set(ref(db, `users/${uid}`), null);
            await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
            delete allUsers[uid];
            allSubmissions = allSubmissions.filter(i => i[0] !== uid);
            document.getElementById('totalStudents').innerText = Object.keys(allUsers).length;
            openStudentsModal(); 
            renderMainTable();
        }
    };

    document.getElementById('studentsListArea').onscroll = function(e) {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            if (studentIndex < Object.keys(allUsers).length) renderStudentsList();
        }
    };
    document.getElementById('mainTableScroll').onscroll = function(e) {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            if (tableIndex < allSubmissions.length) renderMainTable(true);
        }
    };

    document.getElementById('searchInput').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSubmissions.filter(([u, s]) => s.studentName.toLowerCase().includes(term) || s.academicIndex.includes(term));
        const tbody = document.getElementById('adminTableBody');
        tbody.innerHTML = "";
        filtered.forEach(([uid, sub]) => {
            tbody.insertAdjacentHTML('beforeend', `<tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-all">
                <td class="p-4 font-bold text-slate-200">${sub.studentName}</td>
                <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                <td class="p-4 flex justify-center gap-2">
                    <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold border border-blue-600/20">فتح PDF</a>
                </td></tr>`);
        });
    };

    window.openSettings = () => {
        document.getElementById('setSubject').value = currentSubject;
        document.getElementById('setWeek').value = currentWeek;
        document.getElementById('settingsModal').classList.remove('hidden');
    };
    window.closeSettings = () => document.getElementById('settingsModal').classList.add('hidden');
    window.closeStudentsModal = () => document.getElementById('studentsModal').classList.add('hidden');

    window.saveSettings = () => {
        const dl = document.getElementById('setDeadline').value;
        const wk = document.getElementById('setWeek').value;
        const sub = document.getElementById('setSubject').value;
        if (wk && sub) {
            set(ref(db, 'admin_settings'), {
                activeWeek: wk,
                subjectName: sub,
                deadline: dl ? new Date(dl).getTime() : null
            }).then(() => { closeSettings(); alert("تم حفظ الإعدادات وتحديث النظام ✅"); });
        }
    };
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "login.html");
});
