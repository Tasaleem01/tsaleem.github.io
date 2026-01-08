import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. إعدادات Firebase (تأكد من صحة هذه البيانات من وحدة تحكم Firebase الخاصة بك)
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

// --- [الجزء الأول: صفحة التسجيل register.html] ---
if (page === "register.html") {
    const regForm = document.getElementById('regForm');
    const msgDiv = document.getElementById('regMessage');

    const showMsg = (text, type) => {
        msgDiv.innerText = text;
        msgDiv.className = `block text-center font-bold p-4 rounded-2xl text-sm mt-4 `;
        if (type === 'error') msgDiv.className += "bg-red-50 text-red-700 border border-red-100";
        if (type === 'success') msgDiv.className += "bg-green-50 text-green-700 border border-green-100";
        if (type === 'info') msgDiv.className += "bg-blue-50 text-blue-700 border border-blue-100";
        msgDiv.classList.remove('hidden');
    };

    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const index = document.getElementById('regIndex').value.trim() || "0000";
            const college = document.getElementById('regCollege').value;
            const pass = document.getElementById('regPass').value;
            const confirm = document.getElementById('regConfirm').value;

            if (name.split(/\s+/).length < 3) return showMsg("يرجى إدخال اسمك الثلاثي على الأقل!", "error");
            if (pass !== confirm) return showMsg("كلمات المرور غير متطابقة!", "error");
            if (pass.length < 6) return showMsg("كلمة المرور يجب أن تكون 6 أحرف فأكثر", "error");

            showMsg("جاري إنشاء الحساب... ⏳", "info");

            try {
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                await sendEmailVerification(userCred.user);
                
                // حفظ البيانات في قاعدة البيانات
                await set(ref(db, 'users/' + userCred.user.uid), {
                    fullName: name,
                    academicIndex: index,
                    college: college,
                    email: email,
                    role: "student",
                    createdAt: new Date().toISOString()
                });

                showMsg("✅ تم التسجيل! فعل حسابك من الإيميل ثم سجل دخولك.", "success");
                setTimeout(() => window.location.href = "index.html", 3000);
            } catch (err) {
                showMsg(err.message, "error");
            }
        };
    }
}

// --- [الجزء الثاني: الصفحة الرئيسية index.html] ---
if (page === "" || page === "index.html") {
    onAuthStateChanged(auth, async (user) => {
        const loader = document.getElementById('initialLoader');
        if (user) {
            try {
                const snap = await get(ref(db, 'users/' + user.uid));
                if (snap.exists()) {
                    currentUserData = snap.val();
                    document.getElementById('displayUserName').innerText = currentUserData.fullName;
                    document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                    document.getElementById('displayCollege').innerText = currentUserData.college;
                    document.getElementById('mainContent').classList.remove('hidden');
                } else {
                    document.getElementById('accessDenied').classList.remove('hidden');
                }
            } catch (e) {
                document.getElementById('accessDenied').classList.remove('hidden');
            }
        } else {
            document.getElementById('accessDenied').classList.remove('hidden');
        }
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.classList.add('hidden'), 500); }
    });

    // معالجة الصور وتحويلها لـ PDF
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.onclick = async () => {
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
                    
                    // ضغط متوسط لسرعة الرفع مع جودة ممتازة
                    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pdfImgHeight > pageHeight ? pageHeight : pdfImgHeight, undefined, 'MEDIUM');
                }

                finalPdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(finalPdfBlob);
                document.getElementById('pdfFrame').innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full border-none"></iframe>`;
                document.getElementById('previewArea').classList.remove('hidden');
                document.getElementById('viewFullPdf').onclick = () => window.open(pdfUrl);
                
                toggleStatus(false);
            } catch (err) {
                alert("خطأ أثناء المعالجة: " + err.message);
                toggleStatus(false);
            }
        };
    }

    // الرفع النهائي مع تسمية الملف المطلوبة (جامعة - طالب - اختصار)
    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return;

            const university = "جامعة السودان العالمية";
            const collegeShort = "SIU"; // يمكنك جعل هذا متغيراً بناءً على اختيار الكلية
            const fileName = `${university} - ${currentUserData.fullName} - ${collegeShort}.pdf`;
            
            toggleStatus(true, "بدء الرفع... 🚀");
            const storagePath = sRef(storage, `assignments/week_1/${fileName}`);
            const uploadTask = uploadBytesResumable(storagePath, finalPdfBlob);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    toggleStatus(true, `جاري الرفع النهائي: ${progress}% 🚀`);
                    updateProgressBar(progress);
                }, 
                (error) => { alert("فشل الرفع: " + error.message); toggleStatus(false); }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await set(ref(db, `submissions/week_1/${auth.currentUser.uid}`), {
                        studentName: currentUserData.fullName,
                        academicIndex: currentUserData.academicIndex,
                        fileUrl: downloadURL,
                        fileName: fileName,
                        submittedAt: new Date().toLocaleString('ar-EG')
                    });
                    toggleStatus(true, "✅ تم الرفع بنجاح! شكراً يا مهندس.");
                    setTimeout(() => toggleStatus(false), 3000);
                }
            );
        };
    }
}

// --- [الجزء الثالث: لوحة تحكم الأدمن admin.html] ---
if (page === "admin.html") {
    onAuthStateChanged(auth, async (user) => {
        const tableBody = document.getElementById('adminTableBody');
        const totalText = document.getElementById('totalSubmissions');
        
        if (!user) { window.location.href = "index.html"; return; }

        try {
            const snapshot = await get(ref(db, 'submissions/week_1'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                tableBody.innerHTML = "";
                let count = 0;
                Object.keys(data).forEach(key => {
                    count++;
                    const sub = data[key];
                    tableBody.innerHTML += `
                        <tr class="border-b border-slate-50 hover:bg-slate-50">
                            <td class="p-4 font-bold">${sub.studentName}</td>
                            <td class="p-4 text-sm">${sub.academicIndex || '---'}</td>
                            <td class="p-4 text-xs text-slate-400">${sub.submittedAt}</td>
                            <td class="p-4">
                                <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold">تحميل</a>
                            </td>
                        </tr>`;
                });
                totalText.innerText = count;
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center">لا توجد تسليمات بعد</td></tr>`;
            }
        } catch (err) { console.error(err); }
    });
}

// --- [دوال عامة مساعدة] ---
function readFileAsDataURL(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
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

// جعل دالة الخروج متاحة عالمياً
window.handleLogout = () => {
    signOut(auth).then(() => window.location.href = "index.html");
};