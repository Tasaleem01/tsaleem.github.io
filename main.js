import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let currentSubject = "الكهرباء";

// التحقق من الدخول
onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = "login.html"; }
    else { 
        initSettings(); // تحميل الإعدادات أولاً
        loadData();     // ثم تحميل البيانات
    }
});

// دالة لجلب الإعدادات (الأسبوع والمادة) من قاعدة البيانات
function initSettings() {
    onValue(ref(db, 'admin_settings'), (snapshot) => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            currentWeek = settings.activeWeek;
            currentSubject = settings.subjectName;
            document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
        }
    });
}

// دالة تحميل البيانات وحل مشكلة عدم الظهور
function loadData() {
    // جلب المستخدمين (استخدام onValue ليكون التحديث لحظياً)
    onValue(ref(db, 'users'), (snap) => {
        document.getElementById('totalStudents').innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
    });

    // جلب التسليمات بناءً على الأسبوع الحالي
    onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";
        
        if (snap.exists()) {
            const data = snap.val();
            const subs = Object.values(data);
            document.getElementById('weekSubmissions').innerText = subs.length;

            subs.forEach(sub => {
                tableBody.innerHTML += `
                    <tr class="border-b border-slate-700">
                        <td class="p-4">${sub.studentName}</td>
                        <td class="p-4 text-blue-300">${sub.academicIndex}</td>
                        <td class="p-4 text-xs">${sub.submittedAt}</td>
                        <td class="p-4"><a href="${sub.fileUrl}" target="_blank" class="text-green-400 font-bold">📂 فتح</a></td>
                    </tr>`;
            });
        } else {
            document.getElementById('weekSubmissions').innerText = "0";
            tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-500">لا توجد بيانات لهذا الأسبوع</td></tr>`;
        }
    });
}

// نافذة الإعدادات (الترس)
window.toggleSettings = () => {
    const newSubject = prompt("أدخل اسم المادة الجديد:", currentSubject);
    const newWeek = prompt("أدخل رمز الأسبوع (مثال: week_2):", currentWeek);
    
    if (newSubject && newWeek) {
        set(ref(db, 'admin_settings'), {
            activeWeek: newWeek,
            subjectName: newSubject
        }).then(() => alert("تم تحديث الإعدادات بنجاح!"));
    }
};

document.getElementById('logoutBtn').onclick = () => signOut(auth);
