import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. إعدادات Firebase و Cloudinary ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    appId: "YOUR_APP_ID"
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/upload";
const CLOUDINARY_PRESET = "YOUR_UNSIGNED_PRESET";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. متغيرات الحالة ---
let selectedFiles = [];
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentPdfBlob = null;

// --- 3. التشغيل عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // إظهار المحتوى
    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    
    // عرض بيانات المستخدم
    document.getElementById('displayUserName').textContent = currentUser.name;
    document.getElementById('displayIndex').textContent = currentUser.academicId;
    document.getElementById('displayCollege').textContent = currentUser.college;

    loadSettings();
});

// --- 4. جلب إعدادات الآدمن ---
function loadSettings() {
    const settingsRef = ref(db, 'systemSettings');
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('weekTaskTitle').textContent = `تكليف مادة: ${data.subject} - ${data.week}`;
            document.getElementById('deadlineDate').textContent = new Date(data.deadline).toLocaleString('ar-EG');
            
            if (new Date() > new Date(data.deadline)) {
                document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-red-400 font-bold">⚠️ انتهى وقت التسليم!</div>`;
            }
        }
    });
}

// --- 5. التعامل مع الصور وتحويلها لـ PDF ---
document.getElementById('imageInput').addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    status.textContent = `تم اختيار ${selectedFiles.length} صور`;
    status.classList.remove('hidden');
});

document.getElementById('convertBtn').addEventListener('click', async () => {
    if (selectedFiles.length === 0) return alert("الرجاء اختيار صور");
    
    toggleOverlay(true, "جاري إنشاء ملف PDF...");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < selectedFiles.length; i++) {
        const imgData = await readFile(selectedFiles[i]);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 10, 10, 190, 280);
        updateProgress(((i + 1) / selectedFiles.length) * 100);
    }

    currentPdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(currentPdfBlob);
    document.getElementById('pdfFrame').innerHTML = `<embed src="${pdfUrl}" width="100%" height="100%" />`;
    document.getElementById('previewArea').classList.remove('hidden');
    toggleOverlay(false);
});

// --- 6. الرفع النهائي ---
document.getElementById('finalSubmit').addEventListener('click', async () => {
    toggleOverlay(true, "جاري رفع الملف للسيرفر...");
    
    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const data = await res.json();

        if (data.secure_url) {
            await set(ref(db, `submissions/${currentUser.academicId}`), {
                name: currentUser.name,
                academicId: currentUser.academicId,
                pdfUrl: data.secure_url,
                time: new Date().toISOString()
            });
            alert("تم التسليم بنجاح!");
            location.reload();
        }
    } catch (err) {
        alert("فشل الرفع، تأكد من اتصالك");
    } finally {
        toggleOverlay(false);
    }
});

// دالة تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    location.reload();
});

// وظائف مساعدة
function readFile(file) {
    return new Promise(res => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.readAsDataURL(file);
    });
}

function toggleOverlay(show, text = "") {
    const ov = document.getElementById('statusOverlay');
    ov.classList.toggle('hidden', !show);
    document.getElementById('statusText').textContent = text;
}

function updateProgress(p) {
    document.getElementById('progressBar').style.width = p + '%';
}
