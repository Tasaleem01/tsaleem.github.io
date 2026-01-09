import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let currentWeek = "week_1";
let allSubmissions = [];
const page = window.location.pathname.split("/").pop() || "index.html";

// منطق صفحة الأدمن
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = "login.html";
        
        // جلب الإعدادات (الأسبوع والمادة والموعد)
        onValue(ref(db, 'admin_settings'), (snap) => {
            if (snap.exists()) {
                const settings = snap.val();
                currentWeek = settings.activeWeek;
                document.getElementById('adminTitle').innerText = `لوحة تحكم | ${settings.subjectName}`;
                document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                if(settings.deadline) startCountdown(settings.deadline);
                loadData();
            }
        });

        // إجمالي المسجلين
        onValue(ref(db, 'users'), (s) => {
            document.getElementById('totalStudents').innerText = s.exists() ? Object.keys(s.val()).length : 0;
        });
    });

    function loadData() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            allSubmissions = snap.exists() ? Object.entries(snap.val()) : [];
            renderTable(allSubmissions);
        });
    }

    window.renderTable = (data) => {
        const body = document.getElementById('adminTableBody');
        body.innerHTML = "";
        document.getElementById('weekSubmissions').innerText = data.length;
        data.forEach(([id, sub]) => {
            body.innerHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <td class="p-4 font-bold">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex gap-2 justify-center">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold">فتح 📂</a>
                        <button onclick="deleteSubmission('${id}')" class="bg-red-500/20 text-red-500 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">حذف 🗑️</button>
                    </td>
                </tr>`;
        });
    };

    window.handleSearch = (q) => {
        const filtered = allSubmissions.filter(([id, sub]) => 
            sub.studentName.includes(q) || sub.academicIndex.includes(q)
        );
        renderTable(filtered);
    };

    window.deleteSubmission = async (studentId) => {
        if (confirm("سيتم حذف التكليف وإخطار الطالب. هل أنت متأكد؟")) {
            await remove(ref(db, `submissions/${currentWeek}/${studentId}`));
            await set(ref(db, `notifications/${studentId}`), {
                message: `تم حذف تكليفك للأسبوع (${currentWeek}) من قبل الليدر. يرجى إعادة الرفع.`,
                type: 'error'
            });
            alert("تم الحذف بنجاح ✅");
        }
    };

    window.openSettingsModal = () => document.getElementById('settingsModal').classList.remove('hidden');
    window.closeSettingsModal = () => document.getElementById('settingsModal').classList.add('hidden');
    
    window.saveAdminSettings = () => {
        const s = document.getElementById('setSubject').value;
        const w = document.getElementById('setWeek').value;
        const d = document.getElementById('setDeadline').value;
        if(s && w && d) {
            set(ref(db, 'admin_settings'), { activeWeek: w, subjectName: s, deadline: d });
            closeSettingsModal();
        } else alert("يرجى ملء جميع الحقول");
    };

    function startCountdown(date) {
        const el = document.getElementById('deadlineDisplay');
        const timer = setInterval(() => {
            const diff = new Date(date).getTime() - new Date().getTime();
            if (diff <= 0) {
                clearInterval(timer);
                el.innerText = "❌ التسليم مغلق";
                return;
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            el.innerText = `⏳ متبقي: ${d}ي ${h}س ${m}د`;
        }, 1000);
    }
}
// زر الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href = "login.html"));
