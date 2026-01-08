import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. إعدادات Firebase (مفاتيحك الخاصة)
const firebaseConfig = {
    apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
    authDomain: "tasaleem-c2218.firebaseapp.com",
    databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
    projectId: "tasaleem-c2218",
    storageBucket: "tasaleem-c2218.firebasestorage.app",
    messagingSenderId: "877790432223",
    appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

// تهيئة الخدمات
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentUserData = null;
let finalPdfBlob = null;

// معرفة الصفحة الحالية
const path = window.location.pathname;
const page = path.split("/").pop();

// ---------------------------------------------------------
// أولاً: منطق صفحة التسجيل (register.html)
// ---------------------------------------------------------
if (page === "register.html") {
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const index = document.getElementById('regIndex').value.trim() || "indexnumber";
            const college = document.getElementById('regCollege').value;
            const pass = document.getElementById('regPass').value;
            const confirm = document.getElementById('regConfirm').value;

            // التحقق من الاسم الثلاثي
            if (name.split(/\s+/).filter(p => p.length > 0).length < 3) {
                return alert("يرجى إدخال اسمك الثلاثي على الأقل!");
            }
            if (pass !== confirm) return alert("كلمات المرور غير متطابقة!");

            try {
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(userCred.user);
                
                // حفظ البيانات في القاعدة
                await set(ref(db, 'users/' + userCred.user.uid), {
                    fullName: name,
                    academicIndex: index,
                    college: college,
                    email: email
                });

                alert("تم إنشاء الحساب! يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب ثم سجل دخولك.");
                window.location.href = "index.html";
            } catch (err) {
                alert("خطأ: " + err.message);
            }
        };
    }
}

// ---------------------------------------------------------
// ثانياً: منطق الصفحة الرئيسية (index.html)
// ---------------------------------------------------------
if (page === "" || page === "index.html") {
    // 1. التحقق من الدخول وحماية الصفحة
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        const main = document.getElementById('mainContent');
        const denied = document.getElementById('accessDenied');

        if (user) {
            try {
                const snap = await get(ref(db, 'users/' + user.uid));
                if (snap.exists()) {
                    currentUserData = snap.val();
                    // عرض البيانات في الهيدر
                    document.getElementById('displayUserName').innerText = currentUserData.fullName;
                    document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                    document.getElementById('displayCollege').innerText = currentUserData.college;
                    
                    if (main) main.classList.remove('hidden');
                } else {
                    if (denied) denied.classList.remove('hidden');
                }
            } catch (e) {
                if (denied) denied.classList.remove('hidden');
            }
        } else {
            if (denied) denied.classList.remove('hidden');
        }
        // إخفاء الـ Spinner بعد التأكد
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
    });

    // 2. تحديث عدد الصور المختارة
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.onchange = (e) => {
            const status = document.getElementById('fileStatus');
            if (status) {
                status.innerText = `تم اختيار ${e.target.files.length} صور`;
                status.classList.remove('hidden');
            }
        };
    }

    // 3. تحويل الصور لـ PDF بجودة عالية
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.onclick = async () => {
            const files = Array.from(imageInput.files);
            if (files.length === 0) return alert("يرجى اختيار الصور أولاً");

            toggleStatus(true, "جاري تحويل الصور لـ PDF بجودة عالية... ⏳");

            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();

                for (let i = 0; i < files.length; i++) {
                    const imgData = await readFileAsDataURL(files[i]);
                    const imgProps = doc.getImageProperties(imgData);
                    
                    // حساب النسبة للحفاظ على الوضوح
                    const ratio = imgProps.width / imgProps.height;
                    const pdfImgHeight = pageWidth / ratio;

                    if (i > 0) doc.addPage();
                    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pdfImgHeight > pageHeight ? pageHeight : pdfImgHeight, undefined, 'FAST');
                }

                finalPdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(finalPdfBlob);
                
                // عرض المعاينة
                const frame = document.getElementById('pdfFrame');
                if (frame) frame.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;
                document.getElementById('previewArea').classList.remove('hidden');
                
                // زر المعاينة بوضوح
                const fullViewBtn = document.getElementById('viewFullPdf');
                if (fullViewBtn) fullViewBtn.onclick = () => window.open(pdfUrl, '_blank');
                
                toggleStatus(false);
                document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
            } catch (err) {
                alert("فشل التحويل: " + err.message);
                toggleStatus(false);
            }
        };
    }

    // 4. الإرسال النهائي لـ Firebase
    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return;
            toggleStatus(true, "جاري الرفع النهائي لليدر... يرجى عدم إغلاق الصفحة 🚀");

            try {
                const week = "الأسبوع_الأول";
                const fileName = `${currentUserData.academicIndex}_${currentUserData.fullName}.pdf`;
                const storagePath = sRef(storage, `assignments/${week}/${fileName}`);

                await uploadBytes(storagePath, finalPdfBlob);
                const downloadURL = await getDownloadURL(storagePath);

                // حفظ في قاعدة البيانات
                await set(ref(db, `submissions/${week}/${auth.currentUser.uid}`), {
                    name: currentUserData.fullName,
                    index: currentUserData.academicIndex,
                    college: currentUserData.college,
                    fileUrl: downloadURL,
                    time: new Date().toLocaleString('ar-EG')
                });

                toggleStatus(true, "تم الرفع بنجاح! يمكنك الخروج الآن ✅");
                setTimeout(() => toggleStatus(false), 3000);
            } catch (err) {
                alert("خطأ في الرفع: " + err.message);
                toggleStatus(false);
            }
        };
    }
}

// ---------------------------------------------------------
// دوال مساعدة عامة
// ---------------------------------------------------------
function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) {
        statusText.innerText = text;
        show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden');
    }
}

// جعل دالة الخروج متاحة عالمياً
window.handleLogout = () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
};