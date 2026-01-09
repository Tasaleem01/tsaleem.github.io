import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let activeWeek = "week_1"; // قيمة افتراضية سيتم تحديثها من السيرفر
let subjectName = "";

// --- 3. تشغيل الصفحة ---
window.addEventListener('load', () => {
    if (!currentUser) {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }

    document.getElementById('initialLoader').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('initialLoader').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }, 500);
    
    document.getElementById('displayUserName').textContent = currentUser.name;
    document.getElementById('displayIndex').textContent = currentUser.academicId;
    document.getElementById('displayCollege').textContent = currentUser.college;

    loadAdminSettings();
});

// --- 4. جلب إعدادات الآدمن (التعديل الجوهري هنا) ---
function loadAdminSettings() {
    // نستخدم نفس المسار الموجود في كود الآدمن
    const settingsRef = ref(db, 'admin_settings');
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            activeWeek = data.activeWeek; // الأسبوع النشط (مثلاً: week_1)
            subjectName = data.subjectName; // اسم المادة

            document.getElementById('weekTaskTitle').textContent = `تكليف مادة: ${subjectName} - ${activeWeek}`;
            
            if (data.deadline) {
                const dlDate = new Date(data.deadline);
                document.getElementById('deadlineDate').textContent = dlDate.toLocaleString('ar-EG');

                // تحقق من انتهاء الوقت
                if (new Date().getTime() > data.deadline) {
                    document.getElementById('uploadCard').innerHTML = `
                        <div class="text-center p-10">
                            <div class="text-6xl mb-4">⌛</div>
                            <h3 class="text-xl font-bold text-red-400">عذراً يا مهندس، انتهى وقت التسليم!</h3>
                            <p class="text-slate-400 mt-2 italic">لا يمكن رفع التكليفات للأسبوع الحالي بعد الموعد المحدد.</p>
                        </div>`;
                }
            }
        }
    });
}

// --- 5. تحويل الصور لـ PDF ---
document.getElementById('convertBtn').addEventListener('click', async () => {
    if (selectedFiles.length === 0) return alert("اختر الصور أولاً");
    
    toggleOverlay(true, "جاري معالجة الصور...");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < selectedFiles.length; i++) {
        const imgData = await readFile(selectedFiles[i]);
        if (i > 0) pdf.addPage();
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        updateProgress(((i + 1) / selectedFiles.length) * 100);
    }

    currentPdfBlob = pdf.output('blob');
    document.getElementById('pdfFrame').innerHTML = `<embed src="${URL.createObjectURL(currentPdfBlob)}" width="100%" height="100%" />`;
    document.getElementById('previewArea').classList.remove('hidden');
    toggleOverlay(false);
});

// --- 6. الإرسال (يتوافق مع هيكلة الآدمن) ---
document.getElementById('finalSubmit').addEventListener('click', async () => {
    if (!currentPdfBlob) return;
    toggleOverlay(true, "جاري الرفع لـ Cloudinary...");

    const formData = new FormData();
    formData.append('file', currentPdfBlob);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.secure_url) {
            toggleOverlay(true, "جاري تسجيل البيانات في النظام...");
            
            // التسليم يتم في مسار: submissions/{الأسبوع}/{معرف المستخدم}
            // استخدمنا academicId كمفتاح فريد (UID) كما يفعل الآدمن
            const uid = currentUser.academicId; 
            const submissionRef = ref(db, `submissions/${activeWeek}/${uid}`);

            await set(submissionRef, {
                studentName: currentUser.name,
                academicIndex: currentUser.academicId,
                fileUrl: result.secure_url, // الآدمن يبحث عن fileUrl
                submittedAt: new Date().toLocaleString('ar-EG'),
                timestamp: new Date().getTime()
            });

            alert("تم التسليم بنجاح! شكراً لك يا مهندس.");
            location.reload();
        }
    } catch (e) {
        alert("فشل الرفع: " + e.message);
    } finally {
        toggleOverlay(false);
    }
});

// وظائف مساعدة
document.getElementById('imageInput').onchange = (e) => {
    selectedFiles = Array.from(e.target.files);
    document.getElementById('fileStatus').textContent = `✅ تم اختيار ${selectedFiles.length} صور`;
    document.getElementById('fileStatus').classList.remove('hidden');
};

function readFile(file) { return new Promise(res => { const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(file); }); }
function toggleOverlay(s, t) { document.getElementById('statusOverlay').classList.toggle('hidden', !s); document.getElementById('statusText').textContent = t; }
function updateProgress(v) { document.getElementById('progressBar').style.width = v + '%'; }
document.getElementById('logoutBtn').onclick = () => { localStorage.removeItem('user'); location.reload(); };
