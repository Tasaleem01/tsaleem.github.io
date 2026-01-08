import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
  authDomain: "tasaleem-c2218.firebaseapp.com",
  databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
  projectId: "tasaleem-c2218",
  storageBucket: "tasaleem-c2218.firebasestorage.app",
  messagingSenderId: "877790432223",
  appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

// إعدادات Cloudinary
const CLOUD_NAME = "dilxydgpn";
const UPLOAD_PRESET = "student_uploads";

// تهيئة الخدمات
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// --- التعامل مع واجهة المستخدم ---

const loginBtn = document.getElementById('loginBtn');
const authOverlay = document.getElementById('authOverlay');
const uploadForm = document.getElementById('uploadForm');
const statusDiv = document.getElementById('status');

// 1. تفعيل زر تسجيل الدخول
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("خطأ في الدخول:", error);
        alert("حدث خطأ أثناء الاتصال بجوجل: " + error.message);
    }
});

// 2. مراقبة حالة المستخدم (هل هو مسجل دخول؟)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authOverlay.classList.add('hidden'); // إخفاء واجهة الدخول
        document.getElementById('userNameDisplay').innerText = `أهلاً، ${user.displayName}`;
        
        // جلب بيانات الطالب من Realtime Database
        const userRef = ref(db, 'users/' + user.uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            document.getElementById('studentName').value = snapshot.val().fullName;
            document.getElementById('studentId').value = snapshot.val().academicId;
        } else {
            // التسجيل لأول مرة
            const fullName = prompt("يرجى إدخال اسمك الرباعي:");
            const academicId = prompt("يرجى إدخال رقمك الجامعي:");
            if (fullName && academicId) {
                await set(userRef, { fullName, academicId, email: user.email });
                document.getElementById('studentName').value = fullName;
                document.getElementById('studentId').value = academicId;
            }
        }
    } else {
        authOverlay.classList.remove('hidden');
    }
});

// 3. منطق الرفع (Cloudinary + Firebase)
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = document.getElementById('imageInput').files;
    if (files.length === 0) return alert("اختر الصور أولاً!");

    statusDiv.classList.remove('hidden', 'bg-green-100', 'text-green-700');
    statusDiv.classList.add('bg-blue-100', 'text-blue-700');
    statusDiv.innerText = "جاري تحسين الصور ورفعها... ⏳";

    try {
        // هنا سنضع كود الرفع لـ Cloudinary وتحويل PDF في الخطوة التالية
        // هل تريدني أن أكمل الجزء الخاص بـ PDF الآن؟
        statusDiv.innerText = "تم الاتصال بنجاح، جاري تجهيز المعالج...";
    } catch (err) {
        statusDiv.innerText = "فشل الرفع: " + err.message;
    }
});



// استكمال كود الرفع داخل app.js
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const imageInput = document.getElementById('imageInput');
    const files = Array.from(imageInput.files);
    const week = document.getElementById('weekNumber').value;
    const sName = document.getElementById('studentName').value;
    const sId = document.getElementById('studentId').value;

    if (files.length === 0) return alert("يرجى اختيار صور التكليف أولاً!");

    statusDiv.classList.remove('hidden');
    statusDiv.innerText = "جاري معالجة الصور ورفعها... ⏳";

    try {
        const uploadedUrls = [];

        // 1. الرفع إلى Cloudinary للحصول على روابط الصور المحسنة
        for (let file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "student_upload"); // تأكد من الاسم الدقيق هنا

            const res = await fetch(`https://api.cloudinary.com/v1_1/dilxydgpn/upload`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            uploadedUrls.push(data.secure_url);
        }

        statusDiv.innerText = "جاري إنشاء ملف PDF واحد... 📄";

        // 2. تحويل الروابط إلى PDF واحد
        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF();

        for (let i = 0; i < uploadedUrls.length; i++) {
            if (i > 0) docPdf.addPage();
            const imgData = await getBase64FromUrl(uploadedUrls[i]);
            // ضبط أبعاد الصورة لتناسب ورقة A4
            docPdf.addImage(imgData, 'JPEG', 10, 10, 190, 277);
        }

        const pdfBlob = docPdf.output('blob');

        // 3. رفع الـ PDF النهائي إلى Firebase Storage
        statusDiv.innerText = "جاري الرفع النهائي لسحابة الليدر... 🚀";
        const fileName = `week_${week}/${sId}_${sName}.pdf`;
        const storageRef = sRef(storage, `assignments/${fileName}`);
        
        await uploadBytes(storageRef, pdfBlob);
        const downloadURL = await getDownloadURL(storageRef);

        // 4. تسجيل العملية في Realtime Database ليراها الأدمن
        const submissionRef = dbRef(db, `submissions/week_${week}/${sId}`);
        await set(submissionRef, {
            name: sName,
            id: sId,
            fileUrl: downloadURL,
            timestamp: new Date().toISOString()
        });

        statusDiv.innerText = "تم التسليم بنجاح يا هندسة! ✅";
        statusDiv.className = "p-4 rounded-lg text-center text-sm font-bold bg-green-100 text-green-700 mt-4";
        uploadForm.reset();

    } catch (error) {
        console.error(error);
        statusDiv.innerText = "حدث خطأ: " + error.message;
        statusDiv.className = "p-4 rounded-lg text-center text-sm font-bold bg-red-100 text-red-700 mt-4";
    }
});

// دالة مساعدة لتحويل الرابط إلى Base64 (يحتاجها jsPDF)
async function getBase64FromUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}