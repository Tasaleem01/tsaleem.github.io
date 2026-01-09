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

window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }
    
    document.getElementById('displayUserName').textContent = currentUser.fullName;
    document.getElementById('displayIndex').textContent = currentUser.academicIndex;
    document.getElementById('displayCollege').textContent = currentUser.college;

    onValue(ref(db, 'admin_settings'), (snap) => {
        if (snap.exists()) {
            activeWeek = snap.val().activeWeek;
            document.getElementById('weekTaskTitle').textContent = `تكليف: ${snap.val().subjectName} - ${activeWeek}`;
        }
    });

    document.getElementById('initialLoader').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
});

// --- التقاط الصور ---
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    const status = document.getElementById('fileStatus');
    status.innerHTML = `✅ تم اختيار ${selectedFiles.length} صور`;
    status.classList.remove('hidden');
};

// --- تحويل الصور ومعاينتها (معدل للهاتف) ---
document.getElementById('convertBtn').onclick = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً");

    toggleOverlay(true, "جاري معالجة الصور... قد يستغرق ذلك ثوانٍ");

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        for (let i = 0; i < selectedFiles.length; i++) {
            const imgData = await readFileAsDataURL(selectedFiles[i]);
            if (i > 0) pdf.addPage();
            
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // إضافة الصورة بضغط متوسط لضمان نجاح الرفع من الهاتف
            pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);

        // إنشاء زر "فتح المعاينة" يفتح في نافذة جديدة (أفضل للهاتف)
        const frame = document.getElementById('pdfFrame');
        frame.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4 p-4">
                <p class="text-blue-400 text-sm">تم إنشاء الملف بنجاح!</p>
                <a href="${pdfUrl}" target="_blank" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg">اضغط هنا لفتح ومعاينة الملف 👁️</a>
                <p class="text-[10px] text-slate-500 italic">بعد المعاينة، ارجع للموقع واضغط "إرسال"</p>
            </div>
        `;

        document.getElementById('previewArea').classList.remove('hidden');
        document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert("حدث خطأ أثناء معالجة الصور: " + err.message);
    } finally {
        toggleOverlay(false);
    }
};

// --- الرفع النهائي ---
document.getElementById('finalSubmit').onclick = async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري الرفع... 🚀");

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

            alert("كفو! تم التسليم بنجاح ✅");
            location.reload();
        } else {
            alert("خطأ في السيرفر: " + (result.error ? result.error.message : "يرجى مراجعة إعدادات Cloudinary"));
        }
    } catch (e) {
        alert("فشل الرفع. تأكد من جودة الإنترنت وحاول مرة أخرى.");
    } finally {
        toggleOverlay(false);
    }
};

// وظائف مساعدة
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
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
