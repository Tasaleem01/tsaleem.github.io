import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. إعدادات Firebase (نفس إعدادات مشروعك) ---
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

let allSubmissions = [];

// --- 2. التحقق من صلاحية الدخول وجلب البيانات ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    loadDashboardData();
});

async function loadDashboardData() {
    try {
        // جلب عدد الطلاب الكلي
        const usersSnap = await get(ref(db, 'users'));
        if (usersSnap.exists()) {
            document.getElementById('totalStudents').innerText = Object.keys(usersSnap.val()).length;
        }

        // جلب التسليمات
        const subSnap = await get(ref(db, 'submissions/week_1'));
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";

        if (subSnap.exists()) {
            const data = subSnap.val();
            allSubmissions = Object.values(data);
            document.getElementById('weekSubmissions').innerText = allSubmissions.length;

            allSubmissions.forEach(sub => {
                const row = `
                    <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                        <td class="p-4">${sub.studentName}</td>
                        <td class="p-4 font-mono text-blue-300">${sub.academicIndex || '----'}</td>
                        <td class="p-4 text-xs text-slate-400">${sub.submittedAt}</td>
                        <td class="p-4">
                            <a href="${sub.fileUrl}" target="_blank" class="text-green-400 hover:underline">عرض الملف 📄</a>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } else {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-500">لا توجد تسليمات لهذا الأسبوع بعد.</td></tr>`;
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// --- 3. وظيفة تحميل الملفات كمجلد مضغوط (ZIP) ---
document.getElementById('downloadZipBtn').onclick = async () => {
    if (allSubmissions.length === 0) return alert("لا توجد ملفات لتحميلها!");

    const btn = document.getElementById('downloadZipBtn');
    const originalText = btn.innerText;
    btn.innerText = "جاري التحضير... ⏳";
    btn.disabled = true;

    const zip = new JSZip();
    const folder = zip.folder("تسليمات_الأسبوع_الأول");

    try {
        // تحميل كل ملف PDF من Cloudinary وإضافته للـ ZIP
        const downloadPromises = allSubmissions.map(async (sub) => {
            const response = await fetch(sub.fileUrl);
            const blob = await response.blob();
            // تسمية الملف داخل الـ ZIP بنفس الاسم المسجل
            const fileName = `${sub.studentName} - ${sub.academicIndex}.pdf`;
            folder.file(fileName, blob);
        });

        await Promise.all(downloadPromises);

        // توليد ملف الـ ZIP وتحميله
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Assignments_Week_1.zip");

    } catch (error) {
        alert("حدث خطأ أثناء تجميع الملفات: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// تسجيل الخروج
document.getElementById('logoutBtn').onclick = () => signOut(auth).then(() => location.href = "login.html");
