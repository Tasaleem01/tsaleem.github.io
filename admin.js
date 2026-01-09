import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 1. إعدادات Firebase
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

let currentWeek = "week_1"; // قيمة افتراضية
let allSubmissions = [];

// 2. التحقق من الدخول وجلب الإعدادات والبيانات
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        fetchAdminSettings();
        fetchTotalStudents();
    }
});

// 3. جلب إعدادات المادة والأسبوع الحالي
function fetchAdminSettings() {
    const settingsRef = ref(db, 'admin_settings');
    onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            currentWeek = settings.activeWeek || "week_1";
            const subjectName = settings.subjectName || "الكهرباء";

            // تحديث الواجهة
            document.getElementById('adminTitle').innerText = `لوحة تحكم | ${subjectName}`;
            document.getElementById('activeWeekLabel').innerText = `الأسبوع النشط: ${currentWeek}`;
            
            // جلب التسليمات بناءً على الأسبوع الجديد
            fetchSubmissions(currentWeek);
        } else {
            // إذا لم تكن هناك إعدادات، ننشئ واحدة افتراضية
            set(settingsRef, { activeWeek: "week_1", subjectName: "الكهرباء" });
        }
    });
}

// 4. جلب إجمالي الطلاب المسجلين
function fetchTotalStudents() {
    onValue(ref(db, 'users'), (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        document.getElementById('totalStudents').innerText = count;
    });
}

// 5. جلب تسليمات الطلاب وعرضها في الجدول
function fetchSubmissions(week) {
    const subRef = ref(db, `submissions/${week}`);
    onValue(subRef, (snapshot) => {
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";
        allSubmissions = [];

        if (snapshot.exists()) {
            const data = snapshot.val();
            allSubmissions = Object.values(data);
            document.getElementById('weekSubmissions').innerText = allSubmissions.length;

            allSubmissions.forEach(sub => {
                tableBody.innerHTML += `
                    <tr class="border-b border-slate-700 hover:bg-slate-800 transition-colors">
                        <td class="p-5 font-bold">${sub.studentName}</td>
                        <td class="p-5 text-blue-300 font-mono">${sub.academicIndex || '----'}</td>
                        <td class="p-5 text-xs text-slate-400">${sub.submittedAt}</td>
                        <td class="p-5 text-center">
                            <a href="${sub.fileUrl}" target="_blank" class="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all">فتح PDF 📄</a>
                        </td>
                    </tr>
                `;
            });
        } else {
            document.getElementById('weekSubmissions').innerText = "0";
            tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-500 italic">لا توجد تسليمات للأسبوع المختار حالياً.</td></tr>`;
        }
    });
}

// 6. برمجة زر الترس (⚙️) لتغيير الإعدادات
window.toggleSettings = async () => {
    const newSubject = prompt("أدخل اسم المادة:", document.getElementById('adminTitle').innerText.split('|')[1].trim());
    const newWeek = prompt("أدخل رمز الأسبوع الجديد (مثال: week_2):", currentWeek);

    if (newSubject && newWeek) {
        try {
            await set(ref(db, 'admin_settings'), {
                activeWeek: newWeek,
                subjectName: newSubject
            });
            alert("تم تحديث الإعدادات بنجاح! ✨");
        } catch (error) {
            alert("حدث خطأ أثناء التحديث: " + error.message);
        }
    }
};

// 7. برمجة تحميل الـ ZIP (يستخدم روابط Cloudinary)
document.getElementById('downloadZipBtn').onclick = async () => {
    if (allSubmissions.length === 0) return alert("لا توجد ملفات للتحميل");
    
    const btn = document.getElementById('downloadZipBtn');
    btn.disabled = true;
    btn.innerHTML = "جاري التجميع... ⏳";

    const zip = new JSZip();
    const folder = zip.folder(`تسليمات_${currentWeek}`);

    try {
        for (const sub of allSubmissions) {
            const response = await fetch(sub.fileUrl);
            const blob = await response.blob();
            const fileName = `${sub.studentName}-${sub.academicIndex}.pdf`;
            folder.file(fileName, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `التكليفات-${currentWeek}.zip`);
    } catch (e) {
        alert("خطأ في التحميل: تأكد من إعدادات CORS في Cloudinary");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "تحميل الكل (ZIP)";
    }
};

// 8. تسجيل الخروج
document.getElementById('logoutBtn').onclick = () => signOut(auth).then(() => location.href = "login.html");
