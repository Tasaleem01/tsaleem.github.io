import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- الإعدادات ---
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

let currentWeek = "week_1", currentSubject = "الكهرباء";
let allSubmissions = [], allUsers = {};
let tableBatch = 20, studentBatch = 20;
let tableIndex = 0, studentIndex = 0;
const page = window.location.pathname.split("/").pop() || "index.html";

// --- منطق الأدمن ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        onValue(ref(db, 'admin_settings'), (snap) => {
            if (snap.exists()) {
                const s = snap.val();
                currentWeek = s.activeWeek; currentSubject = s.subjectName;
                document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                if(s.deadline) document.getElementById('deadlineLabel').innerText = `الموعد النهائي: ${new Date(s.deadline).toLocaleString('ar-EG')}`;
                loadSubmissions();
            }
        });

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
                document.getElementById('adminTableBody').innerHTML = `<tr><td colspan="4" class="p-10 text-center font-bold text-slate-500">لا توجد تسليمات</td></tr>`;
                document.getElementById('weekSubmissions').innerText = "0";
            }
        });
    }

    // التحميل الكسول للجدول الرئيسي
    function renderMainTable(append = false) {
        const tbody = document.getElementById('adminTableBody');
        if (!append) { tbody.innerHTML = ""; tableIndex = 0; }

        const nextBatch = allSubmissions.slice(tableIndex, tableIndex + tableBatch);
        nextBatch.forEach(([uid, sub]) => {
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800 transition-all">
                    <td class="p-4 font-bold text-slate-200">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex justify-center gap-2">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold border border-blue-600/20">فتح</a>
                        <button onclick="deleteSubmission('${uid}', '${sub.studentName}')" class="bg-red-600/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-600 transition-all">حذف</button>
                    </td>
                </tr>`);
        });
        tableIndex += tableBatch;
    }

    // التمرير في الجدول
    document.getElementById('mainTableScroll').onscroll = function(e) {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            if (tableIndex < allSubmissions.length) renderMainTable(true);
        }
    };

    // ميزة الحذف (تحديث فوري)
    window.deleteSubmission = async (uid, name) => {
        if (confirm(`حذف ملف المهندس: ${name}؟`)) {
            await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
            await set(ref(db, `notifications/${uid}`), {
                message: `تم حذف ملفك للأسبوع (${currentWeek}). يرجى إعادة الرفع.`,
                timestamp: new Date().getTime()
            });
            // تحديث المصفوفة المحلية فوراً لضمان خروج الطالب من قائمة المسلمين
            allSubmissions = allSubmissions.filter(item => item[0] !== uid);
            renderMainTable(); // إعادة رسم الجدول
            document.getElementById('weekSubmissions').innerText = allSubmissions.length;
            alert("تم الحذف وتحديث القوائم.");
        }
    };

    // إدارة الطلاب (تحميل كسول)
    window.openStudentsModal = () => {
        document.getElementById('studentsListArea').innerHTML = "";
        studentIndex = 0;
        document.getElementById('studentsModal').classList.remove('hidden');
        renderStudentsList();
    };

    function renderStudentsList() {
        const area = document.getElementById('studentsListArea');
        const userEntries = Object.entries(allUsers);
        const submittedUIDs = allSubmissions.map(i => i[0]);
        
        let done = 0, pending = 0;
        userEntries.forEach(([uid]) => submittedUIDs.includes(uid) ? done++ : pending++);
        document.getElementById('countDone').innerText = done;
        document.getElementById('countPending').innerText = pending;

        const next = userEntries.slice(studentIndex, studentIndex + studentBatch);
        next.forEach(([uid, user]) => {
            const hasSub = submittedUIDs.includes(uid);
            area.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-700/50 rounded-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full ${hasSub ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}"></div>
                        <div class="text-sm font-bold">${user.fullName} <span class="block text-[9px] text-slate-500 font-mono">${user.academicIndex}</span></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] px-2 py-1 rounded bg-slate-800">${hasSub ? 'سلم' : 'لم يسلم'}</span>
                        <button onclick="deleteUserAccount('${uid}', '${user.fullName}')" class="text-red-500 p-2">🗑️</button>
                    </div>
                </div>`);
        });
        studentIndex += studentBatch;
    }

    document.getElementById('studentsListArea').onscroll = function(e) {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            if (studentIndex < Object.keys(allUsers).length) renderStudentsList();
        }
    };

    window.closeStudentsModal = () => document.getElementById('studentsModal').classList.add('hidden');

    window.deleteUserAccount = async (uid, name) => {
        if (confirm(`حذف حساب "${name}" نهائياً؟`)) {
            await set(ref(db, `users/${uid}`), null);
            await set(ref(db, `submissions/${currentWeek}/${uid}`), null);
            // تحديث المصفوفات المحلية
            delete allUsers[uid];
            allSubmissions = allSubmissions.filter(i => i[0] !== uid);
            document.getElementById('totalStudents').innerText = Object.keys(allUsers).length;
            openStudentsModal(); 
            renderMainTable();
        }
    };

    // البحث الفوري
    document.getElementById('searchInput').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSubmissions.filter(([u, s]) => s.studentName.toLowerCase().includes(term) || s.academicIndex.includes(term));
        renderMainTableSearch(filtered);
    };
    function renderMainTableSearch(data) {
        const tbody = document.getElementById('adminTableBody');
        tbody.innerHTML = "";
        data.forEach(([uid, sub]) => {
            tbody.insertAdjacentHTML('beforeend', `<tr class="border-b border-slate-700/50">... (نفس الـ HTML السابق) ...</tr>`);
        });
    }

    // ZIP التحميل
    document.getElementById('downloadZipBtn').onclick = async () => {
        const zip = new JSZip();
        const folder = zip.folder(`${currentSubject}-${currentWeek}`);
        const promises = allSubmissions.map(async ([uid, sub]) => {
            const res = await fetch(sub.fileUrl);
            const blob = await res.blob();
            folder.file(`${sub.studentName.replace(/\s+/g,'_')}-${sub.academicIndex}.pdf`, blob);
        });
        await Promise.all(promises);
        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, `${currentSubject}-${currentWeek}.zip`);
    };

    // الإعدادات
    window.openSettings = () => {
        document.getElementById('setSubject').value = currentSubject;
        document.getElementById('setWeek').value = currentWeek;
        document.getElementById('settingsModal').classList.remove('hidden');
    };
    window.closeSettings = () => document.getElementById('settingsModal').classList.add('hidden');
    window.saveSettings = () => {
        const dl = document.getElementById('setDeadline').value;
        set(ref(db, 'admin_settings'), {
            activeWeek: document.getElementById('setWeek').value,
            subjectName: document.getElementById('setSubject').value,
            deadline: dl ? new Date(dl).getTime() : null
        }).then(() => { closeSettings(); alert("تم الحفظ"); });
    };
}

// --- منطق الطالب ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, (user) => {
        if(!user) return;
        onValue(ref(db, `notifications/${user.uid}`), (snap) => {
            if(snap.exists()) alert("⚠️ تنبيه: " + snap.val().message);
        });
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href="login.html"));
