import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. الإعدادات الكاملة ---
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

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. متغيرات الحالة ---
let selectedFiles = [];
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentPdfBlob = null;

// --- 3. تهيئة الصفحة ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    // إظهار الواجهة
    const loader = document.getElementById('initialLoader');
    loader.style.opacity = '0';
    setTimeout(() => {
        loader.classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }, 500);
    
    // عرض البيانات
    document.getElementById('displayUserName').textContent = currentUser.name;
    document.getElementById('displayIndex').textContent = currentUser.academicId;
    document.getElementById('displayCollege').textContent = currentUser.college;

    loadSystemSettings();
});

// --- 4. جلب إعدادات الآدمن ---
function loadSystemSettings() {
    const settingsRef = ref(db, 'systemSettings');
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('weekTaskTitle').textContent = `تكليف مادة: ${data.subject} - ${data.week}`;
            document.getElementById('deadlineDate').textContent = new Date(data.deadline).toLocaleString('ar-EG');
            
            if (new Date() > new Date(data.deadline)) {
                document.getElementById('uploadCard').innerHTML = `
                    <div class="text-center p-10">
                        <div class="text-6xl mb-4">⌛</div>
                        <h3 class="text-xl font-bold text-red-400">عذراً، انتهى وقت التسليم!</h3>
                    </div>`;
            }
        } else {
            document.getElementById('weekTaskTitle').textContent = "لا توجد تكاليف نشطة حالياً";
        }
    });
}

// --- 5. منطق الصور والـ PDF ---
const imageInput = document.getElementById('imageInput');
imageInput.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
        const status = document.getElementById('fileStatus');
        status.textContent = `✅ تم اختيار ${selectedFiles.length} صور`;
        status.classList.remove('hidden');
    }
});

document.getElementById('convertBtn').addEventListener('click', async () => {
    if (selectedFiles.length === 0) return alert("اختر صور أولاً يا مهندس");
    
    toggleOverlay(true, "جاري معالجة الصور وتحويلها لـ PDF...");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const imgData = await readFileAsDataURL(selectedFiles[i]);
            if (i > 0) pdf.addPage();
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            updateProgress(((i + 1) / selectedFiles.length) * 100);
        }

        currentPdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(currentPdfBlob);
        document.getElementById('pdfFrame').innerHTML = `<embed src="${pdfUrl}" type="application/pdf" width="100%" height="100%" />`;
        document.getElementById('previewArea').classList.remove('hidden');
    } catch (err) {
        alert("حدث خطأ في إنشاء الملف.");
    } finally {
        toggleOverlay(false);
    }
});

// --- 6. الرفع النهائي ---
document.getElementById('finalSubmit').addEventListener('click', async () => {
    if (!currentPdfBlob) return;

    toggleOverlay(true, "جاري رفع التكليف للسيرفر... 🚀");
    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            await set(ref(db, `submissions/${currentUser.academicId}`), {
                name: currentUser.name,
                academicId: currentUser.academicId,
                college: currentUser.college,
                pdfUrl: result.secure_url,
                time: new Date().toLocaleString('ar-EG'),
                status: "Done"
            });
            alert("تم التسليم بنجاح! 🎉");
            location.reload();
        }
    } catch (error) {
        alert("فشل الرفع، تأكد من اتصالك بالإنترنت.");
    } finally {
        toggleOverlay(false);
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    location.reload();
});

function readFileAsDataURL(file) {
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

function updateProgress(val) {
    document.getElementById('progressBar').style.width = `${val}%`;
}
