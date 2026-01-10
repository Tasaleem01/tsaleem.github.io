import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. الإعدادات والربط ---
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

// --- 2. التحقق عند التحميل وبدء التشغيل ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // عرض بيانات الطالب في الهيدر
    document.getElementById('displayUserName').textContent = currentUser.fullName || "مهندس";
    document.getElementById('displayIndex').textContent = currentUser.academicIndex || "0000";
    document.getElementById('displayCollege').textContent = currentUser.college || "عام";

    // جلب إعدادات الآدمن وفحص حالة التسليم
    loadAdminSettings();

    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
});

// --- 3. إدارة إعدادات الآدمن والوقت ---
function loadAdminSettings() {
    onValue(ref(db, 'admin_settings'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            activeWeek = data.activeWeek;
            document.getElementById('weekTaskTitle').textContent = `تكليف مادة: ${data.subjectName} - ${activeWeek}`;
            if (data.deadline) startCountdown(data.deadline);

            // بمجرد معرفة الاسبوع النشط، نفحص هل الطالب سلم فيه أم لا
            checkIfSubmitted();
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
            deadlineDisplay.textContent = "عفوا لقد انتهئ موعد التسليم  ⌛";
            document.getElementById('uploadCard').innerHTML = `<div class="p-10 text-center font-bold text-red-500 bg-red-50/50 rounded-[2.5rem]">⚠️ عفواً لقد انتهئ موعد التسليم لهذا الاسبوع </div>`;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        deadlineDisplay.textContent = `${days} يوم و ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// --- 4. التحقق اللحظي من حالة التسليم (فكرتك الرهيبة) ---
async function checkIfSubmitted() {
    const statusArea = document.getElementById('submissionStatusArea');
    const uid = currentUser.uid || currentUser.academicIndex;

    // مراقبة المسار في قاعدة البيانات
    onValue(ref(db, `submissions/${activeWeek}/${uid}`), (snapshot) => {
        if (statusArea) {
            statusArea.classList.remove('hidden');
            if (snapshot.exists()) {
                const data = snapshot.val();
                statusArea.innerHTML = `
                    <div class="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-700">
                        <div class="flex items-center gap-4 text-right">
                            <div class="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center text-2xl">✓</div>
                            <div>
                                <h4 class="text-emerald-400 font-black text-lg">تم تسليم تكليفك بنجاح!</h4>
                                <p class="text-slate-400 text-[10px]">تاريخ الرفع: ${data.submittedAt}</p>
                            </div>
                        </div>
                        <a href="${data.fileUrl}" target="_blank" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-lg hover:scale-105">
                            👁️ معاينة ملفي المرفوع
                        </a>
                    </div>
                `;
                document.getElementById('convertBtn').innerText = "🔄 تحديث التسليم الحالي (استبدال)";
            } else {
                statusArea.innerHTML = `
                    <div class="bg-slate-800/40 border border-slate-700/50 p-6 rounded-[2.5rem] flex items-center gap-4">
                        <div class="w-12 h-12 bg-slate-700/50 text-slate-500 rounded-full flex items-center justify-center text-2xl">⏳</div>
                        <div>
                            <h4 class="text-slate-300 font-bold">بانتظار إبداعك يا مهندس</h4>
                            <p class="text-slate-500 text-[10px]">لم ترفع تكليف ${activeWeek} حتى الآن</p>
                        </div>
                    </div>
                `;
                document.getElementById('convertBtn').innerText = "تحويل الصور ومعاينة الـ PDF 📄";
            }
        }
    });
}

// --- 5. معالجة الصور وتحويلها لـ PDF (السرعة القصوى) ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    if (selectedFiles.length > 0) {
        status.innerHTML = `✅ تم اختيار ${selectedFiles.length} صور`;
        status.classList.remove('hidden');
    }
};

document.getElementById('convertBtn').onclick = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً يا مهندس");

    toggleOverlay(true, "جاري المعالجة  وضغط الملف (pdf)... ⚡🚀");

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

        // معالجة متوازية لجميع الصور (Parallel Processing)
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
                <p class="text-emerald-400 font-bold">تم تجهيز ملف الـ PDF بنجاح!</p>
                <a href="${pdfUrl}" target="_blank" class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all">معاينة الملف قبل الإرسال 👁️</a>
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

async function processImageFast(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const targetWidth = 1000; // دقة مثالية للمستندات
                const scaleFactor = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scaleFactor;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6)); // ضغط 60%
            };
        };
    });
}

// --- 6. الرفع النهائي للسيرفر (Cloudinary + Firebase) ---
document.getElementById('finalSubmit').onclick = async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري الرفع النهائي لليدر...لا تغلق الصفحة  ... 🚀");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            const uid = currentUser.uid || currentUser.academicIndex;

            await set(ref(db, `submissions/${activeWeek}/${uid}`), {
                studentName: currentUser.fullName || "مجهول",
                academicIndex: currentUser.academicIndex || "0000",
                fileUrl: result.secure_url,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime(),
                college: currentUser.college || "غير محدد"
            });

            alert("كفو يا مهندس! تم التسليم بنجاح ✅");
            location.reload();
        } else {
            alert("فشل الرفع: تأكد من إعدادات التخزين");
        }
    } catch (e) {
        alert("حدث خطأ في الاتصال، حاول مرة أخرى.");
    } finally {
        toggleOverlay(false);
    }
};

// --- وظائف مساعدة للواجهة ---
function toggleOverlay(show, text) {
    const overlay = document.getElementById('statusOverlay');
    if(overlay) {
        overlay.classList.toggle('hidden', !show);
        document.getElementById('statusText').textContent = text;
    }
}

document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('user');
    window.location.href = "login.html"; // أو الصفحة التي تفضلها
};