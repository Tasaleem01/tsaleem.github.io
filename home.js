import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. الإعدادات (تأكد من صحتها) ---
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
let activeWeek = "";
let countdownInterval;

// --- 2. عند التحميل ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // عرض بيانات المستخدم
    document.getElementById('displayUserName').textContent = currentUser.fullName || "مهندس";
    document.getElementById('displayIndex').textContent = currentUser.academicIndex || "0000";
    document.getElementById('displayCollege').textContent = currentUser.college || "غير محدد";

    loadAdminSettings();

    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
});

// --- 3. جلب الإعدادات والعداد الزمني ---
function loadAdminSettings() {
    onValue(ref(db, 'admin_settings'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            activeWeek = data.activeWeek;
            document.getElementById('weekTaskTitle').textContent = `تكليف: ${data.subjectName} - ${activeWeek}`;
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
            document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-center font-bold text-red-500">⚠️ عفواً يا مهندس، انتهى وقت التسليم</div>`;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        deadlineDisplay.textContent = `${days} يوم و ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// --- 4. اختيار الصور ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    if(selectedFiles.length > 0) {
        status.textContent = `✅ تم اختيار ${selectedFiles.length} صور`;
        status.classList.remove('hidden');
    }
};

// --- 5. تحويل الصور لـ PDF ---
document.getElementById('convertBtn').onclick = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً");

    toggleOverlay(true, "جاري تحويل الصور... انتظر قليلاً");

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        for (let i = 0; i < selectedFiles.length; i++) {
            const imgData = await readFile(selectedFiles[i]);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);

        // المعاينة
        document.getElementById('pdfFrame').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full p-4 gap-4">
                <p class="text-green-400 font-bold italic text-sm">تم تجهيز الملف بنجاح!</p>
                <a href="${pdfUrl}" target="_blank" class="bg-blue-600 px-6 py-3 rounded-xl font-bold">👁️ معاينة الملف المدمج</a>
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

// --- 6. الرفع النهائي ---
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
            const userKey = currentUser.uid || currentUser.academicIndex;
            await set(ref(db, `submissions/${activeWeek}/${userKey}`), {
                studentName: currentUser.fullName,
                academicIndex: currentUser.academicIndex,
                fileUrl: result.secure_url,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            alert("كفو يا مهندس! تم التسليم بنجاح ✅");
            location.reload();
        } else {
            console.error(result);
            alert("فشل الرفع! السبب غالباً إعدادات Cloudinary: " + (result.error ? result.error.message : "خطأ مجهول"));
        }
    } catch (e) {
        alert("فشل الاتصال بالسيرفر. تأكد من الإنترنت.");
    } finally {
        toggleOverlay(false);
    }
};

// وظائف مساعدة
function readFile(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function toggleOverlay(show, text) {
    document.getElementById('statusOverlay').classList.toggle('hidden', !show);
    document.getElementById('statusText').textContent = text;
}

document.getElementById('logoutBtn').onclick = () => {
    localStorage.clear();
    location.reload();
};
