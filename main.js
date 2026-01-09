import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. إعدادات الخدمات ---
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
const auth = getAuth(app);
const db = getDatabase(app);

let currentUserData = null;
let finalPdfBlob = null;
let currentWeek = "week_1"; 
let currentSubject = "الكهرباء";
let allSubmissions = []; // لتخزين البيانات لغرض البحث
const page = window.location.pathname.split("/").pop() || "index.html";

// --- 2. منطق الحسابات (تسجيل ودخول) ---
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
                await set(ref(db, 'users/' + cred.user.uid), { fullName: name, academicIndex: index, college: college, email: email });
                window.location.href = "index.html";
            } catch (err) { alert("خطأ: " + err.message); }
        };
    }
}

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

// --- 3. منطق صفحة الطالب (index.html) ---
if (page === "index.html" || page === "") {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.emailVerified) { renderVerificationUI(user.email); return; }
            
            // جلب بيانات الطالب
            const snap = await get(ref(db, 'users/' + user.uid));
            if (snap.exists()) {
                currentUserData = snap.val();
                document.getElementById('displayUserName').innerText = currentUserData.fullName;
                document.getElementById('displayIndex').innerText = currentUserData.academicIndex;
                document.getElementById('displayCollege').innerText = currentUserData.college;
                document.getElementById('mainContent').classList.remove('hidden');
                
                // فحص الإشعارات (إذا حذف الليدر ملفه)
                checkStudentNotifications(user.uid);
                
                // مزامنة الأسبوع والموعد النهائي
                onValue(ref(db, 'admin_settings'), (s) => { 
                    if(s.exists()) {
                        currentWeek = s.val().activeWeek;
                        currentSubject = s.val().subjectName;
                        const deadline = s.val().deadline;
                        startDeadlineMonitor(deadline);
                        // فحص هل الطالب سلم هذا الأسبوع؟
                        checkSubmissionStatus(user.uid, currentWeek);
                    }
                });
            }
        } else { window.location.href = "login.html"; }
        if (document.getElementById('initialLoader')) document.getElementById('initialLoader').classList.add('hidden');
    });

    // تحويل الصور لـ PDF
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.onclick = async () => {
            const files = Array.from(document.getElementById('imageInput').files);
            if (files.length === 0) return alert("اختر الصور أولاً");
            toggleStatus(true, "جاري معالجة الصور... ⏳");
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            for (let i = 0; i < files.length; i++) {
                if (i > 0) doc.addPage();
                const imgData = await readFileAsDataURL(files[i]);
                const props = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (props.height * pdfWidth) / props.width;
                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            finalPdfBlob = doc.output('blob');
            document.getElementById('pdfFrame').innerHTML = `<iframe src="${URL.createObjectURL(finalPdfBlob)}" class="w-full h-full border-none rounded-xl"></iframe>`;
            document.getElementById('previewArea').classList.remove('hidden');
            toggleStatus(false);
        };
    }

    // الرفع النهائي
    const finalSubmit = document.getElementById('finalSubmit');
    if (finalSubmit) {
        finalSubmit.onclick = async () => {
            if (!finalPdfBlob) return alert("قم بمعالجة الصور أولاً");
            toggleStatus(true, "جاري الرفع للسحابة... 🚀");
            
            const fileName = `${currentUserData.fullName.replace(/\s+/g, '-')}-${Date.now()}`;
            const formData = new FormData();
            formData.append("file", finalPdfBlob);
            formData.append("upload_preset", UPLOAD_PRESET);
            formData.append("public_id", fileName);

            try {
                const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
                const data = await res.json();
                if (data.secure_url) {
                    await set(ref(db, `submissions/${currentWeek}/${auth.currentUser.uid}`), {
                        studentName: currentUserData.fullName,
                        academicIndex: currentUserData.academicIndex,
                        fileUrl: data.secure_url,
                        submittedAt: new Date().toLocaleString('ar-EG')
                    });
                    toggleStatus(true, "✅ تم التسليم بنجاح!");
                    setTimeout(() => toggleStatus(false), 3000);
                }
            } catch (e) { alert("خطأ: " + e.message); toggleStatus(false); }
        };
    }
}

// --- 4. منطق صفحة الأدمن (admin.html) ---
if (page === "admin.html") {
    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = "login.html"; }
        else {
            onValue(ref(db, 'admin_settings'), (snapshot) => {
                if (snapshot.exists()) {
                    const settings = snapshot.val();
                    currentWeek = settings.activeWeek;
                    currentSubject = settings.subjectName;
                    document.getElementById('adminTitle').innerText = `لوحة تحكم | ${currentSubject}`;
                    document.getElementById('activeWeekLabel').innerText = `الأسبوع: ${currentWeek}`;
                    if(settings.deadline) startDeadlineMonitor(settings.deadline);
                    loadSubmissions();
                }
            });
            onValue(ref(db, 'users'), (snap) => {
                document.getElementById('totalStudents').innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
            });
        }
    });

    function loadSubmissions() {
        onValue(ref(db, `submissions/${currentWeek}`), (snap) => {
            allSubmissions = snap.exists() ? Object.entries(snap.val()) : [];
            renderAdminTable(allSubmissions);
        });
    }

    window.renderAdminTable = (data) => {
        const tableBody = document.getElementById('adminTableBody');
        tableBody.innerHTML = "";
        document.getElementById('weekSubmissions').innerText = data.length;
        data.forEach(([userId, sub]) => {
            tableBody.innerHTML += `
                <tr class="border-b border-slate-700 hover:bg-slate-800 transition-colors">
                    <td class="p-4 font-bold">${sub.studentName}</td>
                    <td class="p-4 text-blue-300 font-mono">${sub.academicIndex}</td>
                    <td class="p-4 text-[10px] text-slate-500">${sub.submittedAt}</td>
                    <td class="p-4 flex gap-2 justify-center">
                        <a href="${sub.fileUrl}" target="_blank" class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold">فتح</a>
                        <button onclick="deleteSubmission('${userId}')" class="bg-red-500/20 text-red-500 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all">حذف</button>
                    </td>
                </tr>`;
        });
    };

    window.handleSearch = (query) => {
        const filtered = allSubmissions.filter(([id, sub]) => 
            sub.studentName.includes(query) || sub.academicIndex.includes(query)
        );
        renderAdminTable(filtered);
    };

    window.deleteSubmission = async (userId) => {
        if (confirm("هل تريد حذف هذا التكليف؟ سيتم إخطار الطالب.")) {
            await remove(ref(db, `submissions/${currentWeek}/${userId}`));
            await set(ref(db, `notifications/${userId}`), {
                message: `تم حذف تكليفك للأسبوع (${currentWeek}). يرجى إعادة الرفع بشكل صحيح.`,
                timestamp: Date.now()
            });
            alert("تم الحذف وإرسال تنبيه للطالب.");
        }
    };

    window.openSettingsModal = () => document.getElementById('settingsModal').classList.remove('hidden');
    window.closeSettingsModal = () => document.getElementById('settingsModal').classList.add('hidden');
    
    window.saveAdminSettings = () => {
        const subj = document.getElementById('setSubject').value;
        const week = document.getElementById('setWeek').value;
        const dead = document.getElementById('setDeadline').value;
        if(subj && week && dead) {
            set(ref(db, 'admin_settings'), { activeWeek: week, subjectName: subj, deadline: dead });
            closeSettingsModal();
        } else { alert("اكمل كافة البيانات"); }
    };

    document.getElementById('downloadZipBtn').onclick = async () => {
        if(allSubmissions.length === 0) return alert("لا توجد ملفات");
        const zip = new JSZip();
        const folder = zip.folder(currentWeek);
        const btn = document.getElementById('downloadZipBtn');
        btn.disabled = true;
        btn.innerText = "جاري تجميع الـ ZIP... ⏳";

        const promises = allSubmissions.map(async ([id, sub]) => {
            const res = await fetch(sub.fileUrl.replace('/upload/', '/upload/fl_attachment/'));
            const blob = await res.blob();
            folder.file(`${sub.studentName.replace(/\s+/g, '-')}-${sub.academicIndex}.pdf`, blob);
        });
        await Promise.all(promises);
        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, `${currentSubject}-${currentWeek}.zip`);
        btn.disabled = false;
        btn.innerText = "تحميل ملف ZIP";
    };
}

// --- 5. وظائف مساعدة مشتركة ---
function readFileAsDataURL(file) { return new Promise(res => { const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.readAsDataURL(file); }); }

function toggleStatus(show, text = "") {
    const overlay = document.getElementById('statusOverlay');
    const statusText = document.getElementById('statusText');
    if (overlay && statusText) { statusText.innerText = text; show ? overlay.classList.remove('hidden') : overlay.classList.add('hidden'); }
}

function startDeadlineMonitor(deadlineString) {
    const timerElement = document.getElementById('deadlineDisplay');
    const submitBtn = document.getElementById('finalSubmit');
    
    const x = setInterval(() => {
        const distance = new Date(deadlineString).getTime() - new Date().getTime();
        if (distance < 0) {
            clearInterval(x);
            if(timerElement) timerElement.innerText = "❌ التسليم مغلق";
            if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "انتهى الوقت"; submitBtn.className = "w-full bg-slate-700 py-4 rounded-2xl font-bold cursor-not-allowed"; }
            return;
        }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        if(timerElement) timerElement.innerText = `⏳ الموعد: ${d}ي ${h}س ${m}د`;
    }, 1000);
}

function checkStudentNotifications(userId) {
    onValue(ref(db, `notifications/${userId}`), (snap) => {
        if (snap.exists()) {
            alert("⚠️ تنبيه إداري: " + snap.val().message);
            remove(ref(db, `notifications/${userId}`));
        }
    });
}

function checkSubmissionStatus(userId, week) {
    onValue(ref(db, `submissions/${week}/${userId}`), (snap) => {
        const card = document.getElementById('statusCard');
        const timeText = document.getElementById('lastUploadTime');
        if (snap.exists() && card) {
            card.classList.remove('hidden');
            timeText.innerText = `توقيت الرفع: ${snap.val().submittedAt}`;
        } else if (card) {
            card.classList.add('hidden');
        }
    });
}

function renderVerificationUI(email) {
    document.body.innerHTML = `<div class="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-center text-white font-sans"><div class="bg-slate-800 p-10 rounded-[2.5rem] border border-slate-700 shadow-2xl"><h1 class="text-2xl font-black mb-4">📧 تفعيل الحساب</h1><p class="text-slate-400 mb-6">تأكد من تفعيل بريدك:<br><span class="text-blue-400 font-bold">${email}</span></p><button onclick="location.reload()" class="w-full bg-blue-600 py-4 rounded-2xl font-bold hover:shadow-lg transition-all">لقد فعلت ✅</button></div></div>`;
}

document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href = "login.html"));
