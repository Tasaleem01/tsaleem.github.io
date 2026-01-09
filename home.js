import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. إعدادات المشروع ---
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
const UPLOAD_PRESET = "student_uploads"; // تأكد أنه Unsigned في إعدادات Cloudinary
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. متغيرات الحالة ---
let selectedFiles = [];
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentPdfBlob = null;
let activeWeek = "";
let countdownInterval;

// --- 3. عند تحميل الصفحة ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // إظهار المحتوى وإخفاء اللودر
    setTimeout(() => {
        document.getElementById('initialLoader').style.opacity = '0';
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }, 500);

    // عرض بيانات المهندس
    document.getElementById('displayUserName').textContent = currentUser.fullName || "مهندس غير معروف";
    document.getElementById('displayIndex').textContent = currentUser.academicIndex || "0000";
    document.getElementById('displayCollege').textContent = currentUser.college || "غير محدد";

    loadAdminSettings();
});

// --- 4. جلب إعدادات الأسبوع والعد التنازلي ---
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
            deadlineDisplay.textContent = "انتهى الوقت ⌛";
            document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-center font-bold text-red-500">⚠️ انتهى موعد التسليم لهذه المادة</div>`;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        deadlineDisplay.textContent = `متبقي: ${days} يوم و ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// --- 5. اختيار الصور وتحويلها لـ PDF ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    if (selectedFiles.length > 0) {
        status.textContent = `✅ تم اختيار ${selectedFiles.length} صور`;
        status.classList.remove('hidden');
    }
};

document.getElementById('convertBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("الرجاء اختيار الصور أولاً يا مهندس!");

    toggleOverlay(true, "جاري معالجة الصور وتحويلها لـ PDF... 📄");

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        for (let i = 0; i < selectedFiles.length; i++) {
            const imgData = await readFile(selectedFiles[i]);
            if (i > 0) pdf.addPage();
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            // إضافة الصورة لتغطي كامل الصفحة
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);

        // عرض المعاينة
        const frame = document.getElementById('pdfFrame');
        frame.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none rounded-2xl"></iframe>`;

        document.getElementById('previewArea').classList.remove('hidden');
        document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert("حدث خطأ أثناء معالجة الصور.");
    } finally {
        toggleOverlay(false);
    }
});

// --- 6. الرفع النهائي لـ Cloudinary وحفظ البيانات ---
document.getElementById('finalSubmit').addEventListener('click', async () => {
    if (!currentPdfBlob) return;
    
    toggleOverlay(true, "جاري رفع التكليف إلى السيرفر... 🚀");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            // المفتاح الفريد للطالب هو الـ UID أو الـ Academic Index
            const studentKey = currentUser.uid || currentUser.academicIndex;

            await set(ref(db, `submissions/${activeWeek}/${studentKey}`), {
                studentName: currentUser.fullName,
                academicIndex: currentUser.academicIndex,
                fileUrl: result.secure_url,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            toggleOverlay(false);
            alert("كفو يا مهندس! تم تسليم ملفك بنجاح ✅");
            location.reload();
        } else {
            // إذا فشل الرفع من جهة Cloudinary
            console.error("Cloudinary Error:", result);
            alert("فشل الرفع: تأكد من إعدادات Cloudinary (خاصة الـ Unsigned Preset)");
            toggleOverlay(false);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
        alert("حدث خطأ في الاتصال بالسيرفر. حاول مرة أخرى.");
        toggleOverlay(false);
    }
});

// --- وظائف مساعدة ---
function readFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function toggleOverlay(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (show) {
        statusText.textContent = text;
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// تسجيل الخروج
document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('user');
    location.reload();
};
