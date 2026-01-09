regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const academicId = document.getElementById('regIndex').value;
    const college = document.getElementById('regCollege').value;
    const password = document.getElementById('regPass').value;

    try {
        // --- الخطوة الجديدة: التحقق من أن الرقم الأكاديمي فريد ---
        // سنبحث في المسار 'users' عن أي طالب لديه نفس academicIndex
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            // البحث داخل القائمة عن الرقم الأكاديمي
            const isDuplicate = Object.values(allUsers).some(u => u.academicIndex === academicId);
            
            if (isDuplicate) {
                alert("⚠️ هذا الرقم الأكاديمي مسجل مسبقاً! إذا كنت صاحب الرقم، يرجى تسجيل الدخول أو التواصل مع الليدر.");
                return; // إيقاف العملية هنا
            }
        }
        // -------------------------------------------------------

        // 1. إنشاء الحساب (لن يصل الكود هنا إلا إذا كان الرقم فريداً)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. إرسال رابط التوثيق
        await sendEmailVerification(user);

        // 3. حفظ البيانات باستخدام UID كعنوان (لضمان عدم التداخل)
        const userData = {
            fullName: name,
            email: email,
            academicIndex: academicId,
            college: college,
            uid: user.uid
        };

        await set(ref(db, 'users/' + user.uid), userData);
        localStorage.setItem('user', JSON.stringify(userData));

        // 4. إظهار الـ Modal
        showVerificationModal(email);

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            alert("⚠️ هذا البريد الإلكتروني مستخدم بالفعل!");
        } else {
            alert("خطأ أثناء التسجيل: " + error.message);
        }
    }
});