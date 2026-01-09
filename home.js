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

// --- 2. متغيرات الحالة ---
let selectedFiles = [];
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentPdfBlob = null;
let activeWeek = "";
let countdownInterval;

window.addEventListener('load', () => {
    // التحقق من وجود بيانات المستخدم
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // إخفاء اللودر التدريجي
    document.getElementById('initialLoader').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }, 500);

    // عرض البيانات (استخدام المسميات الجديدة من register.js)
    document.getElementById('displayUserName').textContent = currentUser.fullName || "مهندس غير معروف";
    document.getElementById('displayIndex').textContent = currentUser.academicIndex || "0000";
    document.getElementById('displayCollege').textContent = currentUser.college || "غير محدد";

    loadAdminSettings();
});

// --- 3. جلب الإعدادات والعد التنازلي ---
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
            document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-center font-bold text-red-500">⚠️ انتهى موعد التسليم</div>`;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        deadlineDisplay.textContent = `متبقي: ${days} يوم و ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// --- 4. تحويل الصور ومعاينة الملف ---
document.getElementById('convertBtn').addEventListener('click', async (e) => {
    e.preventDefault(); 
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً");

    toggleOverlay(true, "جاري إنشاء ملف PDF للمعاينة...");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < selectedFiles.length; i++) {
        const imgData = await readFile(selectedFiles[i]);
        if (i > 0) pdf.addPage();
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    currentPdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(currentPdfBlob);

    const frame = document.getElementById('pdfFrame');
    frame.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;

    document.getElementById('previewArea').classList.remove('hidden');
    document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
    toggleOverlay(false);
});

// --- 5. الرفع النهائي إلى Cloudinary ---
document.getElementById('finalSubmit').addEventListener('click', async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري رفع الملف للسيرفر... 🚀");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            // المفتاح يجب أن يكون الـ UID أو الـ academicIndex لضمان الترتيب
            const userKey = currentUser.uid || currentUser.academicIndex; 
            
            await set(ref(db, `submissions/${activeWeek}/${userKey}`), {
                studentName: currentUser.fullName, // ليتوافق مع جدول الآدمن
                academicIndex: currentUser.academicIndex, // ليتوافق مع جدول الآدمن
                fileUrl: result.secure_url,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            alert("تم التسليم بنجاح يا مهندس! ✅");
            location.reload();
        } else {
            throw new Error("لم يتم الحصول على رابط الملف");
        }
    } catch (e) {
        console.error(e);
        alert("فشل الرفع، تأكد من إعدادات Cloudinary وحاول ثانية");
        toggleOverlay(false);
    }
});

// وظائف مساعدة
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    status.textContent = `✅ تم اختيار ${selectedFiles.length} صور`;
    status.classList.remove('hidden');
};

function readFile(file) { 
    return new Promise(res => { 
        const r = new FileReader(); 
        r.onload = (e) => res(e.target.result); 
        r.readAsDataURL(file); 
    }); 
}

function toggleOverlay(s, t) { 
    document.getElementById('statusOverlay').classList.toggle('hidden', !s); 
    document.getElementById('statusText').textContent = t; 
}

document.getElementById('logoutBtn').onclick = () => { 
    localStorage.removeItem('user'); 
    location.reload(); 
};
