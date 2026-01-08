import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// إعدادات Firebase
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

// --- [منطق صفحة التسجيل register.html] ---
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
                // إنشاء الحساب (يتم تسجيل الدخول تلقائياً بعد هذه الخطوة)
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                // إرسال رابط التفعيل
                await sendEmailVerification(cred.user);
                // حفظ البيانات في قاعدة البيانات
                await set(ref(db, 'users/' + cred.user.uid), {
                    fullName: name, academicIndex: index, college: college, email: email
                });
                
                // الانتقال فوراً للصفحة الرئيسية (ستظهر له رسالة التفعيل هناك)
                window.location.href = "index.html";
            } catch (err) { alert("حدث خطأ: " + err.message); }
        };
    }
}

// --- [منطق صفحة تسجيل الدخول login.html] ---
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
    // ميزة نسيت كلمة المرور
    document.getElementById('forgotPassBtn').onclick = async () => {
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) return alert("اكتب بريدك أولاً");
        try { await sendPasswordResetEmail(auth, email); alert("تم إرسال رابط استعادة كلمة المرور لإيميلك"); } catch (err) { alert(err.message); }
    };
}

// --- [منطق الصفحة الرئيسية index.html] ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        if (user) {
            // التحقق من تفعيل الإيميل (التصميم الذي أعجبك)
            if (!user.emailVerified) {
                document.body.innerHTML = `
                    <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
                        <div class="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 max-w-md">
                            <div class="text-6xl mb-6">📧</div>
                            <h1 class="text-2xl font-bold text-slate-800 mb-4">يجب تفعيل حسابك أولاً</h1>
                            <p class="text-slate-500 mb-6 leading-relaxed">لقد أرسلنا رابط تفعيل لبريدك:<br><span class="font-bold text-blue-600">${user.email}</span></p>
                            <p class="text-xs text-slate-400 mb-8 italic">إذا لم تجد الرسالة، تفقد مجلد الرسائل غير المرغوب فيها (Spam).</p>
                            <div class="flex flex-col gap-3">
                                <button onclick="location.reload()" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all">لقد فعلت الحساب، دخول ✅</button>
                                <button onclick="signOut(auth).then(()=>location.href='login.html')" class="text-slate-400 text-sm font-bold hover:text-red-500 transition-colors">تسجيل الخروج</button>
                            </div>
                        </div>
                    </div>`;
                return;
            }

            // جلب بيانات المستخدم الموثق
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

    // --- كود الرفع ومعالجة الصور (يُترك كما هو في الملف السابق) ---
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
            } catch (err) { alert(err.message); toggleStatus(false); }
        };
    }

    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return;
            const university = "جامعة السودان العالمية";
            const fileName = `${university} - ${currentUserData.fullName} - SIU.pdf`;
            const storagePath = sRef(storage, `assignments/week_1/${fileName}`);
            const uploadTask = uploadBytesResumable(storagePath, finalPdfBlob);
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    toggleStatus(true, `جاري الرفع: ${progress}% 🚀`);
                    if(document.getElementById('progressBar')) document.getElementById('progressBar').style.width = progress + "%";
                }, 
                (error) => { alert(error.message); toggleStatus(false); }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await set(ref(db, `submissions/week_1/${auth.currentUser.uid}`), {
                        studentName: currentUserData.fullName,
                        fileUrl: downloadURL,
                        submittedAt: new Date().toLocaleString('ar-EG')
                    });
                    toggleStatus(true, "✅ تم الرفع بنجاح!");
                    setTimeout(() => toggleStatus(false), 3000);
                }
            );
        };
    }
}

// --- كود الأدمن والدوال المساعدة (تُترك كما هي) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        const tableBody = document.getElementById('adminTableBody');
        const snap = await get(ref(db, 'submissions/week_1'));
        if (snap.exists()) {
            const data = snap.val();
            tableBody.innerHTML = "";
            Object.keys(data).forEach(key => {
                const sub = data[key];
                tableBody.innerHTML += `<tr><td class="p-4 font-bold">${sub.studentName}</td><td class="p-4 text-xs">${sub.submittedAt}</td><td class="p-4"><a href="${sub.fileUrl}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs">فتح</a></td></tr>`;
            });
        }
    });
}

function readFileAsDataURL(file) { return new Promise(res => { const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.readAsDataURL(file); }); }
function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) { statusText.innerText = text; show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden'); }
}
window.signOutUser = () => signOut(auth).then(() => location.href = "login.html");