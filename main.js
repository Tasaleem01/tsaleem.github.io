import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- 1. إعدادات Firebase ---
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
const path = window.location.pathname;
const page = path.split("/").pop() || "index.html";

// --- 2. منطق صفحة التسجيل (register.html) ---
if (page === "register.html") {
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const pass = document.getElementById('regPass').value;
            const index = document.getElementById('regIndex').value || "0000";
            const college = document.getElementById('regCollege').value;

            try {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(cred.user);
                await set(ref(db, 'users/' + cred.user.uid), {
                    fullName: name, academicIndex: index, college: college, email: email
                });
                window.location.href = "index.html";
            } catch (err) { alert("حدث خطأ: " + err.message); }
        };
    }
}

// --- 3. منطق صفحة تسجيل الدخول (login.html) ---
if (page === "login.html") {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPass').value;
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                window.location.href = "index.html";
            } catch (err) { alert("فشل الدخول: تأكد من البيانات"); }
        };
    }
}

// --- 4. منطق الصفحة الرئيسية (index.html) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        if (user) {
            if (!user.emailVerified) {
                renderVerificationUI(user.email);
                return;
            }

            const snap = await get(ref(db, 'users/' + user.uid));
            if (snap.exists()) {
                currentUserData = snap.val();
                document.getElementById('displayUserName').innerText = currentUserData.fullName;
                document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                document.getElementById('displayCollege').innerText = currentUserData.college;
                document.getElementById('mainContent').classList.remove('hidden');
            } else { window.location.href = "login.html"; }
        } else {
            window.location.href = "login.html";
        }
        if (loader) loader.classList.add('hidden');
    });

    // --- معالجة الصور وتحويلها لـ PDF ---
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.onclick = async () => {
            const files = Array.from(document.getElementById('imageInput').files);
            if (files.length === 0) return alert("اختر الصور أولاً");
            
            toggleStatus(true, "جاري تحويل ومعالجة الصور... ⏳");
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
                    
                    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pdfImgHeight > pageHeight ? pageHeight : pdfImgHeight, undefined, 'MEDIUM');
                }

                finalPdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(finalPdfBlob);
                document.getElementById('pdfFrame').innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;
                document.getElementById('previewArea').classList.remove('hidden');
                toggleStatus(false);
            } catch (err) { 
                alert(err.message); 
                toggleStatus(false); 
            }
        };
    }

    // --- رفع الملف النهائي (المشكلة التي سألت عنها) ---
    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return alert("يرجى معالجة الصور أولاً");

            // إنشاء التاريخ بصيغة يوم-شهر
            const now = new Date();
            const dateStr = `${now.getDate()}-${now.getMonth() + 1}`;
            
            // تسمية الملف: اسم الطالب + التاريخ
            const fileName = `${currentUserData.fullName} ${dateStr}.pdf`;
            const storagePath = sRef(storage, `assignments/week_1/${fileName}`);
            
            const uploadTask = uploadBytesResumable(storagePath, finalPdfBlob);
            
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    toggleStatus(true, `جاري الرفع: ${progress}% 🚀`);
                    if(document.getElementById('progressBar')) {
                        document.getElementById('progressBar').style.width = progress + "%";
                    }
                }, 
                (error) => { 
                    alert("خطأ في الرفع: " + error.message); 
                    toggleStatus(false); 
                }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // حفظ السجل في قاعدة البيانات
                    await set(ref(db, `submissions/week_1/${auth.currentUser.uid}`), {
                        studentName: currentUserData.fullName,
                        academicIndex: currentUserData.academicIndex,
                        fileUrl: downloadURL,
                        submittedAt: new Date().toLocaleString('ar-EG'),
                        fileName: fileName
                    });

                    toggleStatus(true, "✅ تم رفع التكليف بنجاح يا مهندس!");
                    setTimeout(() => toggleStatus(false), 3000);
                }
            );
        };
    }
}

// --- 5. الدوال المساعدة ---

function readFileAsDataURL(file) { 
    return new Promise(res => { 
        const reader = new FileReader(); 
        reader.onload = e => res(e.target.result); 
        reader.readAsDataURL(file); 
    }); 
}

function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) { 
        statusText.innerText = text; 
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
            if(document.getElementById('progressBar')) document.getElementById('progressBar').style.width = "0%";
        }
    }
}

function renderVerificationUI(email) {
    document.body.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
            <div class="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 max-w-md">
                <div class="text-6xl mb-6">📧</div>
                <h1 class="text-2xl font-bold text-slate-800 mb-4">يجب تفعيل حسابك أولاً</h1>
                <p class="text-slate-500 mb-6 leading-relaxed">لقد أرسلنا رابط تفعيل لبريدك:<br><span class="font-bold text-blue-600">${email}</span></p>
                <div class="flex flex-col gap-3">
                    <button onclick="location.reload()" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700">لقد فعلت الحساب، دخول ✅</button>
                    <button id="logoutBtn" class="text-slate-400 text-sm font-bold hover:text-red-500">تسجيل الخروج</button>
                </div>
            </div>
        </div>`;
    document.getElementById('logoutBtn').onclick = () => signOut(auth).then(() => location.href = 'login.html');
}

// جعل دالة الخروج متاحة عالمياً
window.handleLogout = () => signOut(auth).then(() => location.href = "login.html");
