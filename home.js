// دالة لتحويل وضغط الصور قبل وضعها في الـ PDF
async function processAndOptimizeImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // تحديد أبعاد معقولة (A4 بوضوح جيد ولكن خفيف)
                const maxWidth = 1200; 
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;

                // رسم الصورة على الكانفاس بضغط 0.7 (جودة ممتازة وحجم صغير)
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
    });
}
