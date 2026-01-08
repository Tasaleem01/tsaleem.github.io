import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- إعداداتك الخاصة ---
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
const UPLOAD_PRESET = "student_upload"; // تأكد أنه Unsigned في Cloudinary

// تهيئة الخدمات
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// عناصر الواجهة
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authOverlay = document.getElementById('authOverlay');
const statusDiv = document.getElementById('status');
const imageInput = document.getElementById('imageInput');

// --- نظام المصادقة ---

loginBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        authOverlay.classList.add('hidden');
        document.getElementById('userNameDisplay').innerText = user.displayName;
        
        const userRef = ref(db, 'users/' + user.uid);
        const snap = await get(userRef);
        
        if (snap.exists()) {
            document.getElementById('studentName').value = snap.val().fullName;
            document.getElementById('studentId').value = snap.val().academicId;
        } else {
            const name = prompt("أدخل اسمك الرباعي:");
            const id = prompt("أدخل رقمك الجامعي:");
            if(name && id) {
                await set(userRef, { fullName: name, academicId: id });
                location.reload();
            }
        }
    } else {
        authOverlay.classList.remove('hidden');
    }
});

// تحديث عدد الصور المختارة
imageInput.onchange = () => {
    const count = imageInput.files.length;
    const label = document.getElementById('fileCount');
    label.innerText = `تم اختيار ${count} صور`;
    label.classList.remove('hidden');
};

// --- نظام الرفع والمعالجة ---

document.getElementById('uploadForm').onsubmit = async (e) => {
    e.preventDefault();
    const files = Array.from(imageInput.files);
    if (files.length === 0) return alert("اختر الصور!");

    statusDiv.className = "p-4 rounded-xl text-center font-bold text-sm border bg-blue-50 text-blue-700 border-blue-200 block";
    statusDiv.innerText = "جاري تحسين الصور ورفعها لـ Cloudinary... ⏳";

    try {
        const urls = [];
        for (let file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            urls.push(data.secure_url);
        }

        statusDiv.innerText = "جاري تجميع ملف الـ PDF... 📄";
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        for (let i = 0; i < urls.length; i++) {
            if (i > 0) pdf.addPage();
            const imgData = await getBase64(urls[i]);
            pdf.addImage(imgData, 'JPEG', 10, 10, 190, 280);
        }

        const pdfBlob = pdf.output('blob');
        const week = document.getElementById('weekNumber').value;
        const sName = document.getElementById('studentName').value;
        const sId = document.getElementById('studentId').value;

        statusDiv.innerText = "جاري الرفع النهائي لـ Firebase... 🚀";
        const fileRef = sRef(storage, `homework/week_${week}/${sId}_${sName}.pdf`);
        await uploadBytes(fileRef, pdfBlob);
        const finalUrl = await getDownloadURL(fileRef);

        // حفظ سجل التسليم
        await set(ref(db, `submissions/week_${week}/${sId}`), {
            studentName: sName,
            fileUrl: finalUrl,
            time: new Date().toLocaleString('ar-EG')
        });

        statusDiv.className = "p-4 rounded-xl text-center font-bold text-sm border bg-green-50 text-green-700 border-green-200 block";
        statusDiv.innerText = "تم التسليم بنجاح يا مهندس! ✅";
        
    } catch (err) {
        console.error(err);
        statusDiv.className = "p-4 rounded-xl text-center font-bold text-sm border bg-red-50 text-red-700 border-red-200 block";
        statusDiv.innerText = "حدث خطأ: " + err.message;
    }
};

async function getBase64(url) {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise(res => {
        const f = new FileReader();
        f.onload = () => res(f.result);
        f.readAsDataURL(b);
    });
}