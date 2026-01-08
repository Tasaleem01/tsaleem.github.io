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

// --- [الجزء الأول: صفحة التسجيل] ---
if (page === "register.html") {
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const index = document.getElementById('regIndex').value.trim() || "0000";
            const college = document.getElementById('regCollege').value;
            const pass = document.getElementById('regPass').value;

            if (name.split(/\s+/).length < 3) return alert("يرجى إدخال اسمك الثلاثي!");
            try {
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(userCred.user);
                await set(ref(db, 'users/' + userCred.user.uid), {
                    fullName: name, academicIndex: index, college: college, email: email
                });
                alert("تم التسجيل! فعل حسابك من الإيميل ثم سجل دخولك.");
                window.location.href = "index.html";
            } catch (err) { alert(err.message); }
        };
    }
}

// --- [الجزء الثاني: الصفحة الرئيسية] ---
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

    document.getElementById('convertBtn').onclick = async () => {
        const files = Array.from(document.getElementById('imageInput').files);
        if (files.length === 0) return alert("يرجى اختيار الصور أولاً");

        toggleStatus(true, "جاري تحويل ومعالجة الصور... ⏳");
        updateProgressBar(0);

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
            document.getElementById('viewFullPdf').onclick = () => window.open(pdfUrl);
            
            toggleStatus(false);
            document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
        } catch (err) { alert(err.message); toggleStatus(false); }
    };

    document.getElementById('finalSubmit').onclick = async () => {
        if (!finalPdfBlob) return;
        
        // --- تحديد مسمى الكلية والجامعة ---
        const university = "جامعة السودان العالمية";
        const collegeShort = (currentUserData.college === university) ? "SIU" : "COL"; // اختصار الكلية
        
        // إنشاء اسم الملف المطلوب: جامعة - طالب - اختصار كلية
        const fileName = `${university} - ${currentUserData.fullName} - ${collegeShort}.pdf`;
        
        const week = "الأسبوع_الأول";
        const storagePath = sRef(storage, `assignments/${week}/${fileName}`);
        
        const uploadTask = uploadBytesResumable(storagePath, finalPdfBlob);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                toggleStatus(true, `جاري الرفع النهائي: ${progress}% 🚀`);
                updateProgressBar(progress);
            }, 
            (error) => {
                alert("فشل الرفع: " + error.message);
                toggleStatus(false);
            }, 
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await set(ref(db, `submissions/${week}/${auth.currentUser.uid}`), {
                    studentName: currentUserData.fullName,
                    university: university,
                    college: currentUserData.college,
                    fileUrl: downloadURL,
                    fileName: fileName,
                    submittedAt: new Date().toLocaleString('ar-EG')
                });
                updateProgressBar(100);
                toggleStatus(true, "✅ تم الرفع بنجاح! شكراً لك يا مهندس.");
                setTimeout(() => { toggleStatus(false); updateProgressBar(0); }, 3000);
            }
        );
    };
}

// --- [دوال مساعدة] ---
function readFileAsDataURL(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.readAsDataURL(file);
    });
}

function updateProgressBar(percent) {
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = percent + "%";
}

function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) {
        statusText.innerText = text;
        show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden');
    }
}

window.handleLogout = () => { signOut(auth).then(() => location.replace("index.html")); };

// --- [الجزء الثالث: لوحة تحكم الأدمن admin.html] ---
if (page === "admin.html") {
    // التأكد من أن المستخدم مسجل دخول (يمكنك لاحقاً إضافة شرط أنه "ليدر" فقط)
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        const tableBody = document.getElementById('adminTableBody');
        const totalText = document.getElementById('totalSubmissions');

        try {
            // جلب بيانات التسليمات للأسبوع الأول
            const submissionsRef = ref(db, 'submissions/week_1');
            const snapshot = await get(submissionsRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                tableBody.innerHTML = ""; // مسح نص التحميل
                let count = 0;

                // تحويل الكائن إلى مصفوفة وعرضها
                Object.keys(data).forEach(key => {
                    const submission = data[key];
                    count++;
                    
                    const row = `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="p-4 font-bold text-slate-800">${submission.studentName || submission.name}</td>
                            <td class="p-4 text-sm text-slate-500">${submission.academicIndex || submission.index}</td>
                            <td class="p-4 text-xs text-slate-400">${submission.submittedAt || submission.time}</td>
                            <td class="p-4">
                                <a href="${submission.fileUrl}" target="_blank" 
                                   class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">
                                   📄 فتح الملف
                                </a>
                            </td>
                        </tr>
                    `;
                    tableBody.insertAdjacentHTML('beforeend', row);
                });
                totalText.innerText = count;
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400">لا توجد تسليمات حتى الآن ⭕</td></tr>`;
            }
        } catch (err) {
            console.error("خطأ في جلب البيانات:", err);
            tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-red-500">حدث خطأ أثناء جلب البيانات</td></tr>`;
        }
    });
}