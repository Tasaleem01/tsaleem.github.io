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
let activeWeek = "week_1";
let countdownInterval;

// --- 2. التحقق من الهوية عند التحميل ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    document.getElementById('displayUserName').textContent = currentUser.fullName || currentUser.name;
    document.getElementById('displayIndex').textContent = currentUser.academicIndex || currentUser.academicId;
    document.getElementById('displayCollege').textContent = currentUser.college || "غير محدد";

    loadAdminSettings();

    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
});

// --- 3. إدارة التوقيت والإعدادات ---
function loadAdminSettings() {
    onValue(ref(db, 'admin_settings'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            activeWeek = data.activeWeek;
            document.getElementById('weekTaskTitle').textContent = `تكليف مادة: ${data.subjectName} - ${activeWeek}`;
            if (data.deadline) startCountdown(data.deadline);
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
            document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-center font-bold text-red-500 bg-red-50/50 rounded-[2rem]">⚠️ انتهى وقت التسليم</div>`;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        deadlineDisplay.textContent = `${days} يوم و ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// --- 4. معالجة الصور المتوازية (السرعة القصوى) ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    status.innerHTML = `✅ تم اختيار ${selectedFiles.length} صور`;
    status.classList.remove('hidden');
};

document.getElementById('convertBtn').onclick = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً يا مهندس");

    toggleOverlay(true, "جاري المعالجة البرقية... ⚡🚀");

    try {
        const { jsPDF } = window.jspdf;
        // إنشاء PDF مع خاصية الضغط وتجاهل الدقة العالية غير الضرورية
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        // [سر السرعة]: معالجة جميع الصور في وقت واحد بدلاً من التوالي
        const optimizedImages = await Promise.all(selectedFiles.map(file => processImageFast(file)));

        optimizedImages.forEach((imgData, i) => {
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        });

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);

        document.getElementById('pdfFrame').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4 text-center p-4">
                <span class="text-5xl">⚡</span>
                <p class="text-emerald-400 font-bold">تم الضغط والتجهيز بسرعة فائقة!</p>
                <a href="${pdfUrl}" target="_blank" class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform">معاينة سريعة 👁️</a>
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

// وظيفة المعالجة فائقة السرعة باستخدام Canvas
async function processImageFast(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // عرض 1000px مثالي جداً لملفات التكليف (وضوح عالٍ وحجم ريشة)
                const targetWidth = 1000;
                const scaleFactor = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scaleFactor;

                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = false; // زيادة سرعة المعالجة
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // جودة 0.6 توفر ضغطاً هائلاً دون تأثر وضوح الكتابة
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// --- 5. الرفع النهائي للسيرفر ---
document.getElementById('finalSubmit').onclick = async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري الرفع الصاروخي... 🚀");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            const uid = currentUser.uid || currentUser.academicIndex;

            await set(ref(db, `submissions/${activeWeek}/${uid}`), {
                studentName: currentUser.fullName || currentUser.name,
                academicIndex: currentUser.academicIndex || currentUser.academicId,
                fileUrl: result.secure_url,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            alert("كفو يا مهندس! تم التسليم بنجاح وبسرعة قياسية ✅");
            location.reload();
        } else {
            alert("فشل الرفع: تأكد من إعدادات Cloudinary");
        }
    } catch (e) {
        alert("حدث خطأ في الاتصال، تأكد من جودة الإنترنت.");
    } finally {
        toggleOverlay(false);
    }
};

// وظائف التحكم في الواجهة
function toggleOverlay(show, text) {
    const overlay = document.getElementById('statusOverlay');
    if(overlay) {
        overlay.classList.toggle('hidden', !show);
        document.getElementById('statusText').textContent = text;
    }
}

document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('user');
    location.reload();
};
