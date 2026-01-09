import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const db = getDatabase(app);

let selectedFiles = [];
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentPdfBlob = null;
let activeWeek = "week_1"; // قيمة افتراضية سيتم تحديثها من الأدمن
let countdownInterval;

// --- 2. عند تحميل الصفحة والتحقق من الهوية ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // عرض بيانات المستخدم في الهيدر (التوافق مع مسميات register.js)
    document.getElementById('displayUserName').textContent = currentUser.fullName || currentUser.name;
    document.getElementById('displayIndex').textContent = currentUser.academicIndex || currentUser.academicId;
    document.getElementById('displayCollege').textContent = currentUser.college || "غير محدد";

    // جلب إعدادات الأسبوع والعد التنازلي من الأدمن
    loadAdminSettings();

    // إخفاء لودر التحقق
    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
});

// --- 3. جلب إعدادات الأدمن والعداد ---
function loadAdminSettings() {
    onValue(ref(db, 'admin_settings'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            activeWeek = data.activeWeek;
            document.getElementById('weekTaskTitle').textContent = `تكليف مادة: ${data.subjectName} - ${activeWeek}`;

            if (data.deadline) {
                startCountdown(data.deadline);
            }
        }
    });
}

function startCountdown(deadlineTimestamp) {
    clearInterval(countdownInterval);
    const deadlineDisplay = document.getElementById('deadlineDate');

    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = deadlineTimestamp - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            deadlineDisplay.textContent = "انتهى الموعد ⌛";
            document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-center font-bold text-red-500 bg-red-50/50 rounded-[2rem]">⚠️ انتهى وقت تسليم هذا التكليف</div>`;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        deadlineDisplay.textContent = `${days} يوم و ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// --- 4. اختيار وتحويل الصور (متوافق مع الهواتف) ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    status.innerHTML = `✅ تم اختيار ${selectedFiles.length} صور`;
    status.classList.remove('hidden');
};

document.getElementById('convertBtn').onclick = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً يا مهندس");

    toggleOverlay(true, "جاري دمج الصور في ملف PDF... ⏳");

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        for (let i = 0; i < selectedFiles.length; i++) {
            const imgData = await readFile(selectedFiles[i]);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);

        // منطقة المعاينة (فتح الملف في نافذة جديدة للهاتف)
        document.getElementById('pdfFrame').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4 text-center p-4">
                <span class="text-4xl">📄</span>
                <p class="text-emerald-400 font-bold">تم تجهيز ملف PDF بنجاح!</p>
                <a href="${pdfUrl}" target="_blank" class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">فتح ومعاينة الملف 👁️</a>
                <p class="text-[10px] text-slate-500 italic">يجب المعاينة للتأكد قبل الإرسال النهائي</p>
            </div>
        `;
        document.getElementById('previewArea').classList.remove('hidden');
        document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert("خطأ في المعالجة: " + err.message);
    } finally {
        toggleOverlay(false);
    }
};

// --- 5. الرفع النهائي (متوافق مع كود الأدمن) ---
document.getElementById('finalSubmit').onclick = async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري رفع التكليف للسيرفر... 🚀");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            // التوافق مع الأدمن: استخدام الـ uid كفهرس في submissions
            const uid = currentUser.uid || currentUser.academicIndex;

            await set(ref(db, `submissions/${activeWeek}/${uid}`), {
                studentName: currentUser.fullName || currentUser.name,
                academicIndex: currentUser.academicIndex || currentUser.academicId,
                fileUrl: result.secure_url,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            alert("كفو يا مهندس! تم تسليم التكليف بنجاح ✅");
            location.reload();
        } else {
            alert("فشل الرفع: تأكد من إعدادات Cloudinary (Unsigned Preset)");
        }
    } catch (e) {
        alert("حدث خطأ في الاتصال، تأكد من جودة الإنترنت.");
    } finally {
        toggleOverlay(false);
    }
};

// وظائف مساعدة
function readFile(file) {
    return new Promise(res => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.readAsDataURL(file);
    });
}

function toggleOverlay(show, text) {
    document.getElementById('statusOverlay').classList.toggle('hidden', !show);
    document.getElementById('statusText').textContent = text;
}

document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('user');
    location.reload();
};
