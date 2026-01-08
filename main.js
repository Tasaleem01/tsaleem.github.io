import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA3YrKmw3sAdl2pld-KRCb7wbf3xlnw8G0",
    authDomain: "tasaleem-c2218.firebaseapp.com",
    databaseURL: "https://tasaleem-c2218-default-rtdb.firebaseio.com",
    projectId: "tasaleem-c2218",
    storageBucket: "tasaleem-c2218.firebasestorage.app",
    messagingSenderId: "877790432223",
    appId: "1:877790432223:web:5d7b6a4423f2198af8126a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentUserData = null;
let finalPdfBlob = null;
const page = window.location.pathname.split("/").pop();

// --- منطق صفحة التسجيل ---
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

            if (name.split(/\s+/).length < 3) return alert("يرجى إدخال اسمك الثلاثي!");
            try {
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(userCred.user);
                await set(ref(db, 'users/' + userCred.user.uid), {
                    fullName: name, academicIndex: index, college: college, email: email
                });
                alert("تم التسجيل بنجاح! فعل حسابك من الإيميل.");
                window.location.href = "index.html";
            } catch (err) { alert(err.message); }
        };
    }
}

// --- منطق الصفحة الرئيسية ---
if (page === "" || page === "index.html") {
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        if (user) {
            const snap = await get(ref(db, 'users/' + user.uid));
            if (snap.exists()) {
                currentUserData = snap.val();
                document.getElementById('displayUserName').innerText = currentUserData.fullName;
                document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                document.getElementById('displayCollege').innerText = currentUserData.college;
                document.getElementById('mainContent').classList.remove('hidden');
            } else { document.getElementById('accessDenied').classList.remove('hidden'); }
        } else { document.getElementById('accessDenied').classList.remove('hidden'); }
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.classList.add('hidden'), 500); }
    });

    // تحويل الصور لـ PDF (ضغط الملف داخلياً)
    document.getElementById('convertBtn').onclick = async () => {
        const files = Array.from(document.getElementById('imageInput').files);
        if (files.length === 0) return alert("اختر صوراً أولاً");

        toggleStatus(true, "جاري ضغط ومعالجة الصور... ⏳");

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            for (let i = 0; i < files.length; i++) {
                if (i > 0) doc.addPage();
                const imgData = await readFileAsDataURL(files[i]);
                const imgProps = doc.getImageProperties(imgData);
                const ratio = imgProps.width / imgProps.height;
                const pdfImgHeight = pageWidth / ratio;
                
                // إضافة الصورة مع ضغط متوسط للحفاظ على سرعة الرفع دون التأثير على العين
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pdfImgHeight > pageHeight ? pageHeight : pdfImgHeight, undefined, 'MEDIUM');
            }

            finalPdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(finalPdfBlob);
            document.getElementById('pdfFrame').innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;
            document.getElementById('previewArea').classList.remove('hidden');
            document.getElementById('viewFullPdf').onclick = () => window.open(pdfUrl);
            
            toggleStatus(false);
            document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
        } catch (err) { alert(err.message); toggleStatus(false); }
    };

    // الرفع النهائي مع نسبة مئوية (ProgressBar Logic)
    document.getElementById('finalSubmit').onclick = async () => {
        if (!finalPdfBlob) return;
        
        const fileName = `${currentUserData.academicIndex}_${currentUserData.fullName}.pdf`;
        const storagePath = sRef(storage, `assignments/week_1/${fileName}`);
        
        // استخدام uploadBytesResumable للمراقبة
        const uploadTask = uploadBytesResumable(storagePath, finalPdfBlob);

        uploadTask.on('state_changed', 
            (snapshot) => {
                // حساب النسبة المئوية
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                toggleStatus(true, `جاري الرفع للسحابة: ${progress}% 🚀`);
            }, 
            (error) => {
                alert("فشل الرفع: " + error.message);
                toggleStatus(false);
            }, 
            async () => {
                // عند اكتمال الرفع بنجاح
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await set(ref(db, `submissions/week_1/${auth.currentUser.uid}`), {
                    name: currentUserData.fullName,
                    index: currentUserData.academicIndex,
                    fileUrl: downloadURL,
                    time: new Date().toLocaleString('ar-EG')
                });
                toggleStatus(true, "تم الرفع بنجاح! شكراً يا مهندس ✅");
                setTimeout(() => toggleStatus(false), 3000);
            }
        );
    };
}

// دوال مساعدة
function readFileAsDataURL(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
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

window.handleLogout = () => { signOut(auth).then(() => location.reload()); };