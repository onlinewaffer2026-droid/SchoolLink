// index.js - منطق صفحة الدخول الرئيسية
// =====================================

// دالة التمرير إلى قسم معين
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// دالة عرض نافذة الفيديو التعريفي
function showDemoVideo() {
    document.getElementById('demoModal').style.display = 'block';
}

// دالة عرض نافذة المساعدة
function showHelp() {
    document.getElementById('helpModal').style.display = 'block';
}

// دالة عرض سياسة الخصوصية
function showPrivacyPolicy() {
    document.getElementById('privacyModal').style.display = 'block';
}

// دالة إغلاق النافذة المنبثقة
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// دالة الدخول الرئيسية
async function handleLogin() {
    // 1. جلب الكود من الحقل وتنظيف الفراغات الزائدة
    const loginCode = document.getElementById('loginCode').value.trim();
    
    // 2. التحقق من أن الحقل ليس فارغاً
    if (!loginCode) {
        window.Helpers.showToast('يرجى إدخال كود الدخول', 'error');
        return;
    }
    
    // 3. إظهار مؤشر التحميل وتغيير حالة الزر
    const loginBtn = document.querySelector('.btn-login');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';
    loginBtn.disabled = true;
    
    try {
        // 4. استدعاء دالة الدخول المركزية من ملف config.js
        const userData = await window.Helpers.loginWithCode(loginCode);
        
        if (userData) {
            // 5. في حال نجاح الكود، التوجيه للصفحة المخصصة للدور
            window.Helpers.redirectBasedOnRole(userData);
        } else {
            // 6. في حال كان الكود خاطئاً، استعادة حالة الزر الأصلية
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    } catch (error) {
        console.error("Login process error:", error);
        window.Helpers.showToast('حدث خطأ تقني أثناء الدخول', 'error');
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// تهيئة الصفحة عند تحميل DOM
document.addEventListener('DOMContentLoaded', function() {
    // إضافة تأثيرات للبطاقات العائمة
    const floatingCards = document.querySelectorAll('.floating-card');
    
    floatingCards.forEach((card, index) => {
        // تأخير متدرج للظهور
        card.style.animationDelay = `${index * 0.2}s`;
        
        // إضافة تأثير التطاير عند المرور بالماوس
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // إضافة تأثير التمرير الناعم لروابط التنقل
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    // ربط الأزرار بالدوال
    document.getElementById('startJourneyBtn').addEventListener('click', () => {
        scrollToSection('features');
    });
    
    document.getElementById('demoVideoBtn').addEventListener('click', showDemoVideo);
    document.getElementById('helpBtn').addEventListener('click', showHelp);
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('privacyLink').addEventListener('click', showPrivacyPolicy);
    
    // ربط أزرار إغلاق النوافذ
    document.getElementById('closeHelpModal').addEventListener('click', () => {
        closeModal('helpModal');
    });
    
    document.getElementById('closeDemoModal').addEventListener('click', () => {
        closeModal('demoModal');
    });
    
    document.getElementById('closePrivacyModal').addEventListener('click', () => {
        closeModal('privacyModal');
    });
    
    document.getElementById('understandHelpBtn').addEventListener('click', () => {
        closeModal('helpModal');
    });
    
    document.getElementById('acceptPrivacyBtn').addEventListener('click', () => {
        closeModal('privacyModal');
    });
    
    // السماح بالدخول بالضغط على Enter في حقل الكود
    document.getElementById('loginCode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // إغلاق النافذة المنبثقة بالنقر خارجها
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };
    
    // التحقق إذا كان المستخدم مسجلاً بالفعل
    if (window.AppState?.currentUser) {
        window.Helpers.showToast('أنت مسجل الدخول بالفعل', 'info');
        // إعادة التوجيه بعد ثانيتين
        setTimeout(() => {
            window.Helpers.redirectBasedOnRole(window.AppState.currentUser);
        }, 2000);
    }
});