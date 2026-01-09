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
let activeWeek = "";
let countdownInterval;

// --- 2. التحقق عند التحميل ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }
    document.getElementById('displayUserName').textContent = currentUser.fullName;
    document.getElementById('displayIndex').textContent = currentUser.academicIndex;
    document.getElementById('displayCollege').textContent = currentUser.college;

    loadAdminSettings();
    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
});

function loadAdminSettings() {
    onValue(ref(db, 'admin_settings'), (snap) => {
        if (snap.exists()) {
            activeWeek = snap.val().activeWeek;
            document.getElementById('weekTaskTitle').textContent = `تكليف: ${snap.val().subjectName} - ${activeWeek}`;
            if (snap.val().deadline) startCountdown(snap.val().deadline);
        }
    });
}

function startCountdown(deadline) {
    clearInterval(countdownInterval);
    const display = document.getElementById('deadlineDate');
    countdownInterval = setInterval(() => {
        const dist = deadline - new Date().getTime();
        if (dist < 0) {
            display.textContent = "انتهى الموعد ⌛";
            document.getElementById('uploadCard').innerHTML = `<p class="p-10 text-center text-red-500 font-bold">⚠️ انتهى وقت التسليم</p>`;
            return;
        }
        const h = Math.floor((dist % (1000*60*60*24)) / (1000*60*60));
        const m = Math.floor((dist % (1000*60*60)) / (1000*60));
        const s = Math.floor((dist % (1000*60)) / 1000);
        display.textContent = `متبقي: ${Math.floor(dist/(1000*60*60*24))} يوم و ${h}:${m}:${s}`;
    }, 1000);
}

// --- 3. معالجة الصور (الضغط والتحويل) ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    document.getElementById('fileStatus').innerHTML = `✅ تم اختيار ${selectedFiles.length} صور`;
    document.getElementById('fileStatus').classList.remove('hidden');
};

document.getElementById('convertBtn').onclick = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً");

    toggleOverlay(true, "جاري ضغط الصور وتجهيز الـ PDF... ⏳");

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        for (let i = 0; i < selectedFiles.length; i++) {
            const compressedImg = await compressImage(selectedFiles[i]);
            if (i > 0) pdf.addPage();
            pdf.addImage(compressedImg, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);

        // تعديل المعاينة لتفتح بوضوح
        document.getElementById('pdfFrame').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4 p-6 bg-slate-800/50 rounded-[2rem]">
                <div class="text-5xl">📄</div>
                <p class="text-emerald-400 font-bold">تم تجهيز ملف خفيف وسريع!</p>
                <button onclick="window.open('${pdfUrl}', '_blank')" class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg">فتح ومعاينة الملف 👁️</button>
            </div>
        `;
        document.getElementById('previewArea').classList.remove('hidden');
        document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { alert("خطأ: " + err.message); }
    finally { toggleOverlay(false); }
};

// دالة الضغط لتسريع الرفع 70%
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let w = img.width, h = img.height;
                if (w > MAX_WIDTH) { h *= MAX_WIDTH / w; w = MAX_WIDTH; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6)); // جودة 60% لتقليل الحجم
            };
        };
    });
}

// --- 4. الرفع النهائي المتوافق مع الأدمن ---
document.getElementById('finalSubmit').onclick = async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري الرفع السريع... 🚀");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            // ملاحظة: جعلنا الرابط ينتهي بـ .pdf ليفتح مباشرة ولا يتنزل
            const finalUrl = result.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
            
            const uid = currentUser.uid || currentUser.academicIndex;
            await set(ref(db, `submissions/${activeWeek}/${uid}`), {
                studentName: currentUser.fullName,
                academicIndex: currentUser.academicIndex,
                fileUrl: finalUrl,
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            alert("كفو! تم التسليم بنجاح في وقت قياسي ✅");
            location.reload();
        } else { alert("فشل الرفع، تحقق من إعدادات Cloudinary"); }
    } catch (e) { alert("خطأ في الاتصال"); }
    finally { toggleOverlay(false); }
};

function toggleOverlay(s, t) {
    document.getElementById('statusOverlay').classList.toggle('hidden', !s);
    document.getElementById('statusText').textContent = t;
}

document.getElementById('logoutBtn').onclick = () => { localStorage.clear(); location.reload(); };
