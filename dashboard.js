// admin/dashboard.js
// تهيئة الصفحة والتحكم الرئيسي

// حالة الصفحة
const AdminState = {
    currentSection: 'dashboard',
    currentTab: 'teachers',
    currentWizardStep: 1,
    school: null,
    activeYear: null,
    classes: [],
    teachers: [],
    students: [],
    selectedStudentIds: new Set(),
    promotionData: {
        sourceClassId: null,
        targetClassId: null,
        selectedStudents: []
    }
};

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', async function() {
    // التحقق من صلاحية المستخدم
    if (!window.AppState.currentUser || window.AppState.currentUser.role !== 'admin') {
        window.Helpers.showToast('ليس لديك صلاحية الوصول إلى هذه الصفحة', 'error');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        return;
    }

    // تحديث اسم المستخدم
    document.getElementById('currentUserName').textContent = window.AppState.currentUser.full_name;

    // تحميل بيانات المدرسة
    await loadSchoolData();

    // تهيئة التنقل
    initializeNavigation();

    // تحميل البيانات الأولية
    await loadInitialData();

    // تفعيل Realtime للتنبيهات
    setupRealtime();

    // توليد أكواد تلقائية للنماذج
    generateTeacherCode();
    generateStudentLoginCode();
    
    // إعداد أحداث النماذج
    setupFormEvents();
});

// تحميل بيانات المدرسة
async function loadSchoolData() {
    try {
        // التأكد من وجود school_id
        if (!window.AppState.currentUser || !window.AppState.currentUser.school_id) {
            console.error('No school ID found for user');
            return;
        }

        const { data, error } = await window.EduPath.supabase
            .from('schools')
            .select('*')
            .eq('id', window.AppState.currentUser.school_id)
            .single();

        if (error) throw error;

        if (data) {
            AdminState.school = data;
            document.getElementById('schoolName').textContent = data.name;
        }
    } catch (error) {
        console.error('Error loading school:', error);
        window.Helpers.showToast('فشل تحميل بيانات المدرسة', 'error');
    }
}

// تحميل البيانات الأولية
async function loadInitialData() {
    try {
        // 1. جلب المدرسة والعام الدراسي
        await loadSchoolData();
        await loadActiveAcademicYear();
        
        // 2. جلب الصفوف (ضرورية للإحصائيات)
        await loadClasses();
        
        // 3. تحديث الرئيسية
        await loadStatistics();
        await loadRecentActivity();
        
        console.log("Dashboard initialized successfully");
    } catch (error) {
        console.error('Load initial data error:', error);
    }
}

// دالة ربط أزرار القائمة بحدث النقر
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            // التأكد أن الرابط يبدأ بـ # (رابط داخلي)
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const sectionId = href.substring(1);
                navigateToSection(sectionId);
            }
        });
    });
}

// التنقل بين الأقسام
function navigateToSection(sectionId) {
    // تحديث روابط القائمة
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) link.classList.add('active');
    });

    // تبديل الأقسام
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active-section'));
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active-section');
        AdminState.currentSection = sectionId;
        
        // تشغيل الجلب التلقائي حسب القسم
        switch (sectionId) {
            case 'dashboard': 
                loadStatistics(); 
                loadRecentActivity(); 
                break;
            case 'academic-years': 
                loadAcademicYears(); 
                break;
            case 'promotion': 
                initializePromotionWizard(); 
                break;
            case 'users': 
                switchTab('teachers'); 
                break;
        }

        // إغلاق قائمة الموبايل
        const navLinksContainer = document.querySelector('.nav-links');
        if (navLinksContainer) navLinksContainer.classList.remove('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// التبديل بين الأقسام من JavaScript
function switchToSection(sectionId) {
    const link = document.querySelector(`a[href="#${sectionId}"]`);
    if (link) {
        link.click();
    }
}

// تحميل العام الدراسي النشط
async function loadActiveAcademicYear() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        const { data: years, error } = await window.EduPath.supabase
            .from('academic_years')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        AdminState.activeYear = years || null;
        
        if (AdminState.activeYear) {
            document.getElementById('activeAcademicYear').textContent = AdminState.activeYear.name;
        }

    } catch (error) {
        console.error('Error loading active academic year:', error);
    }
}

// تحميل الصفوف
async function loadClasses() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // طلب بسيط ومباشر
        const { data: classes, error } = await window.EduPath.supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId)
            .order('name');

        if (error) {
            console.error('Error loading classes table:', error);
            // لا تتوقف هنا، اجعل المصفوفة فارغة لمنع انهيار باقي الكود
            AdminState.classes = [];
        } else {
            AdminState.classes = classes || [];
        }
        
        // تحديث القوائم المنسدلة (Selects)
        updateClassSelects();

    } catch (error) {
        console.error('Global classes load error:', error);
        AdminState.classes = [];
    }
}

// تحديث قوائم الصفوف المنسدلة
function updateClassSelects() {
    const selects = ['sourceClass', 'targetClass', 'teacherClass', 'studentClass', 'studentClassFilter', 'broadcastClass'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = `<option value="">${id.includes('Filter') ? 'جميع الصفوف' : 'اختر الصف...'}</option>`;
        AdminState.classes.forEach(cls => {
            el.innerHTML += `<option value="${cls.id}">${cls.name}</option>`;
        });
        el.value = currentVal; // الحفاظ على اختيار المستخدم
    });
}

// تحميل الإحصائيات
async function loadStatistics() {
    try {
        const schoolId = window.AppState.currentUser.school_id;

        // 1. جلب عدد الطلاب
        const { count: studentCount, error: studentError } = await window.EduPath.supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('role', 'student');

        // 2. جلب عدد المعلمين
        const { count: teacherCount, error: teacherError } = await window.EduPath.supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('role', 'teacher');

        // 3. عدد الصفوف (موجود بالفعل في AdminState.classes)
        const classCount = AdminState.classes.length;

        // تحديث الواجهة
        document.getElementById('totalStudents').textContent = studentCount || 0;
        document.getElementById('totalTeachers').textContent = teacherCount || 0;
        document.getElementById('totalClasses').textContent = classCount || 0;

        // تحديث رسائل "الزيادة/النقصان" (اختياري - كنسبة بسيطة)
        document.getElementById('studentsChange').textContent = `إجمالي المسجلين`;
        document.getElementById('teachersChange').textContent = `طاقم التدريس`;
        document.getElementById('classesChange').textContent = `الفصول الحالية`;

    } catch (error) {
        console.error('Error in loadStatistics:', error);
    }
}

// تحميل النشاط الأخير
async function loadRecentActivity() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        const container = document.getElementById('recentActivity');

        // جلب آخر 5 إشعارات تتعلق بمستخدمي هذه المدرسة
        const { data: activities, error } = await window.EduPath.supabase
            .from('notifications')
            .select(`
                id,
                message,
                created_at,
                users!inner (
                    school_id
                )
            `)
            .eq('users.school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="activity-item empty">
                    <i class="fas fa-history"></i>
                    <p>لا توجد أنشطة مسجلة بعد</p>
                </div>`;
            return;
        }

        container.innerHTML = activities.map(act => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-message">${act.message}</p>
                    <div class="activity-meta">
                        <span class="activity-time">${window.Helpers.formatDate(act.created_at)}</span>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error in loadRecentActivity:', error);
        document.getElementById('recentActivity').innerHTML = '<p class="text-danger">فشل تحميل الأنشطة</p>';
    }
}

// تحديث النشاط
function refreshActivity() {
    loadRecentActivity();
    window.Helpers.showToast('جاري تحديث النشاط...', 'info');
}

// عرض جميع الطلاب
function viewAllStudents() {
    switchTab('students');
    switchToSection('users');
}

// عرض جميع المعلمين
function viewAllTeachers() {
    switchTab('teachers');
    switchToSection('users');
}

// إدارة الصفوف
function manageClasses() {
    document.getElementById('classesModal').style.display = 'block';
    loadClassesList();
}

// تبديل تبويب الصفوف
function switchClassTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.modal-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.querySelector(`.modal-tab[onclick="switchClassTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}ClassTab`).classList.add('active');
}

// إضافة معلم جديد
function addNewUser(role) {
    if (role === 'teacher') {
        showAddTeacherModal();
    } else if (role === 'student') {
        showAddStudentModal();
    }
}

// إظهار نافذة إضافة معلم
function showAddTeacherModal() {
    // 1. إظهار النافذة المنبثقة
    document.getElementById('addTeacherModal').style.display = 'block';
    
    // 2. تصفير النموذج لضمان خلوه من بيانات سابقة
    document.getElementById('addTeacherForm').reset();
    
    // 3. توليد كود دخول جديد فور الفتح
    generateTeacherCode();
}

// إظهار نافذة إضافة طالب
function showAddStudentModal() {
    document.getElementById('addStudentModal').style.display = 'block';
}

// إنشاء صف جديد
function createNewClass() {
    manageClasses();
    switchClassTab('add');
}

// توليد أكواد الدخول
function generateLoginCodes() {
    switchTab('generate-codes');
    switchToSection('users');
    updateCodeGenerationStats();
}

// إرسال إشعار عام
function sendBroadcastMessage() {
    document.getElementById('broadcastModal').style.display = 'block';
}

// إعداد أحداث النماذج
function setupFormEvents() {
    // معالجة إضافة معلم
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            const payload = {
                school_id: window.AppState.currentUser.school_id,
                full_name: document.getElementById('teacherFullName').value.trim(),
                subject: document.getElementById('teacherSubject').value,
                current_class_id: document.getElementById('teacherClass').value || null,
                login_code: document.getElementById('teacherLoginCode').value.trim(),
                role: 'teacher'
            };

            try {
                const { error } = await window.EduPath.supabase.from('users').insert([payload]);

                if (error) throw error;

                window.Helpers.showToast('تمت إضافة المعلم بنجاح', 'success');
                
                closeModal('addTeacherModal'); // إغلاق النافذة
                if (typeof loadTeachers === 'function') loadTeachers(); // تحديث القائمة
                if (typeof loadStatistics === 'function') loadStatistics(); // تحديث الأرقام

            } catch (error) {
                console.error("Error adding teacher:", error);
                window.Helpers.showToast('خطأ في الحفظ: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    // معالجة إضافة طالب
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // جلب البيانات من النموذج
            const fullName = document.getElementById('studentFullName').value.trim();
            const classId = document.getElementById('studentClass').value;
            const loginCode = document.getElementById('studentLoginCode').value.trim();
            const parentCode = document.getElementById('studentParentCode').value.trim();
            
            // التحقق من المدخلات الأساسية
            if (!fullName || !classId || !loginCode) {
                window.Helpers.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
                return;
            }

            // استخراج اسم الأب (كل الأسماء بعد الاسم الأول)
            const nameParts = fullName.split(' ');
            if (nameParts.length < 2) {
                window.Helpers.showToast('يرجى إدخال الاسم ثلاثياً على الأقل لربط ولي الأمر', 'warning');
                return;
            }
            const fatherNameOnly = nameParts.slice(1).join(' ');
            const fatherFullName = fatherNameOnly + " (ولي أمر)";

            try {
                const schoolId = window.AppState.currentUser.school_id;

                // 1. إضافة الطالب أولاً
                const { error: studentError } = await window.EduPath.supabase
                    .from('users')
                    .insert([{
                        school_id: schoolId,
                        full_name: fullName,
                        role: 'student',
                        login_code: loginCode,
                        current_class_id: classId
                    }]);

                if (studentError) throw studentError;

                // 2. معالجة حساب ولي الأمر (إذا تم إدخال كود)
                if (parentCode) {
                    // نتحقق: هل هذا الكود موجود مسبقاً في النظام؟
                    const { data: existingParent, error: searchError } = await window.EduPath.supabase
                        .from('users')
                        .select('id')
                        .eq('login_code', parentCode)
                        .maybeSingle();

                    if (!existingParent) {
                        // الحالة أ: ولي أمر جديد تماماً (أول ابن يسجل)
                        const { error: parentInsertError } = await window.EduPath.supabase
                            .from('users')
                            .insert([{
                                school_id: schoolId,
                                full_name: fatherFullName,
                                role: 'student',
                                login_code: parentCode,
                                current_class_id: classId
                            }]);
                        
                        if (parentInsertError) throw parentInsertError;
                        window.Helpers.showToast('تم إضافة الطالب وإنشاء حساب جديد لولي الأمر', 'success');
                    } else {
                        // الحالة ب: ولي الأمر موجود مسبقاً (تم الربط تلقائياً بالكود)
                        window.Helpers.showToast('تم إضافة الطالب وربطه بولي الأمر الحالي بنجاح', 'success');
                    }
                } else {
                    window.Helpers.showToast('تم إضافة الطالب بنجاح (بدون ربط ولي أمر)', 'success');
                }

                // 3. تنظيف الواجهة وتحديث البيانات
                closeModal('addStudentModal');
                if (typeof loadStudents === 'function') await loadStudents();
                if (typeof loadStatistics === 'function') await loadStatistics();
                
                // إعادة تعيين النموذج والحالة
                this.reset();
                const parentStatus = document.getElementById('parentStatus');
                if (parentStatus) parentStatus.textContent = "";
                document.getElementById('studentParentCode').readOnly = false;
                
                // توليد أكواد جديدة للعملية القادمة
                generateStudentLoginCode();

            } catch (error) {
                console.error('Error in addStudentForm:', error);
                window.Helpers.showToast('حدث خطأ أثناء الحفظ: ' + error.message, 'error');
            }
        });
    }

    // معالجة إرسال إشعار عام
    const broadcastForm = document.getElementById('broadcastForm');
    if (broadcastForm) {
        broadcastForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const message = document.getElementById('broadcastMessage').value.trim();
            const sendToTeachers = document.getElementById('sendToTeachers').checked;
            const sendToStudents = document.getElementById('sendToStudents').checked;
            const sendToSpecificClass = document.getElementById('sendToSpecificClass').checked;
            const specificClass = document.getElementById('broadcastClass').value;
            
            if (!message) {
                window.Helpers.showToast('يرجى كتابة نص الإشعار', 'error');
                return;
            }
            
            if (!sendToTeachers && !sendToStudents && !sendToSpecificClass) {
                window.Helpers.showToast('يرجى اختيار فئة المستلمين', 'error');
                return;
            }
            
            try {
                const schoolId = window.AppState.currentUser.school_id;
                
                // تحديد المستلمين
                let query = window.EduPath.supabase
                    .from('users')
                    .select('id')
                    .eq('school_id', schoolId);
                
                if (sendToSpecificClass && specificClass) {
                    query = query.eq('current_class_id', specificClass);
                } else {
                    const roles = [];
                    if (sendToTeachers) roles.push('teacher');
                    if (sendToStudents) roles.push('student');
                    query = query.in('role', roles);
                }
                
                const { data: recipients, error: recipientsError } = await query;
                
                if (recipientsError) throw recipientsError;
                
                // إرسال الإشعار لكل مستلم
                const notifications = recipients.map(recipient => ({
                    user_id: recipient.id,
                    message: message,
                    is_read: false
                }));
                
                const { error } = await window.EduPath.supabase
                    .from('notifications')
                    .insert(notifications);
                
                if (error) throw error;
                
                window.Helpers.showToast(`تم إرسال الإشعار إلى ${recipients.length} مستلم`, 'success');
                closeModal('broadcastModal');
                this.reset();
                await loadRecentActivity();
                
            } catch (error) {
                console.error('Error sending broadcast:', error);
                window.Helpers.showToast('خطأ في إرسال الإشعار', 'error');
            }
        });
    }

    // تحديث عرض الصف المحدد للإشعارات
    const sendToSpecificClass = document.getElementById('sendToSpecificClass');
    if (sendToSpecificClass) {
        sendToSpecificClass.addEventListener('change', function() {
            const classSelect = document.getElementById('broadcastClass');
            classSelect.style.display = this.checked ? 'block' : 'none';
        });
    }

    // معالجة إضافة عام دراسي جديد
    const newAcademicYearForm = document.getElementById('newAcademicYearForm');
    if (newAcademicYearForm) {
        newAcademicYearForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const yearName = document.getElementById('yearName').value.trim();
            const autoActivate = document.getElementById('autoActivate').checked;
            const copyClasses = document.getElementById('copyPreviousClasses').checked;

            if (!yearName) {
                window.Helpers.showToast('يرجى إدخال اسم العام الدراسي', 'error');
                return;
            }

            try {
                const schoolId = window.AppState.currentUser.school_id;
                
                // إضافة العام الدراسي الجديد
                const { data: newYear, error } = await window.EduPath.supabase
                    .from('academic_years')
                    .insert([{
                        school_id: schoolId,
                        name: yearName,
                        is_active: autoActivate
                    }])
                    .select()
                    .single();

                if (error) throw error;

                // إذا تم طلب التفعيل التلقائي
                if (autoActivate) {
                    await activateYear(newYear.id);
                }

                // إذا تم طلب نسخ هيكل الصفوف
                if (copyClasses && AdminState.classes.length > 0) {
                    await copyClassesStructure(newYear.id);
                }

                window.Helpers.showToast('تم فتح العام الدراسي الجديد بنجاح', 'success');
                resetYearForm();
                await loadAcademicYears();

            } catch (error) {
                console.error('Error adding academic year:', error);
                window.Helpers.showToast('خطأ في إضافة العام الدراسي', 'error');
            }
        });
    }
}

// توليد كود معلم
function generateTeacherCode() {
    const code = 'TCH' + window.Helpers.generateLoginCode(5);
    document.getElementById('teacherLoginCode').value = code;
}

// توليد كود طالب
function generateStudentLoginCode() {
    const code = 'STD' + window.Helpers.generateLoginCode(5);
    document.getElementById('studentLoginCode').value = code;
}

// توليد كود ولي أمر
function generateParentCode() {
    const code = 'PRT' + window.Helpers.generateLoginCode(5);
    document.getElementById('studentParentCode').value = code;
}

// إعادة تعيين نموذج السنة الدراسية
function resetYearForm() {
    document.getElementById('newAcademicYearForm').reset();
    document.getElementById('yearName').value = '';
}

// نسخ هيكل الصفوف
async function copyClassesStructure(yearId) {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        const newClasses = AdminState.classes.map(cls => ({
            school_id: schoolId,
            academic_year_id: yearId,
            name: cls.name
        }));

        const { error } = await window.EduPath.supabase
            .from('classes')
            .insert(newClasses);

        if (error) throw error;

        window.Helpers.showToast(`تم نسخ ${AdminState.classes.length} صف إلى العام الجديد`, 'success');

    } catch (error) {
        console.error('Error copying classes structure:', error);
        window.Helpers.showToast('خطأ في نسخ هيكل الصفوف', 'error');
    }
}

// تحميل السنوات الدراسية
async function loadAcademicYears() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        const { data: years, error } = await window.EduPath.supabase
            .from('academic_years')
            .select('*')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // تحديث المعلومات الحالية
        if (years.length > 0) {
            const activeYear = years.find(y => y.is_active);
            if (activeYear) {
                AdminState.activeYear = activeYear;
                document.getElementById('activeAcademicYear').textContent = activeYear.name;
                
                document.getElementById('currentYearInfo').innerHTML = `
                    <div class="year-details">
                        <h3>${activeYear.name}</h3>
                        <div class="year-meta">
                            <span class="meta-item">
                                <i class="far fa-calendar"></i>
                                تاريخ الفتح: ${window.Helpers.formatDate(activeYear.created_at)}
                            </span>
                            <span class="meta-item">
                                <i class="fas fa-check-circle"></i>
                                الحالة: <span class="text-success">نشط</span>
                            </span>
                        </div>
                    </div>
                    <div class="year-actions">
                        <button class="btn btn-outline btn-sm" onclick="deactivateYear('${activeYear.id}')">
                            <i class="fas fa-ban"></i>
                            تعطيل هذا العام
                        </button>
                    </div>
                `;
            }
        }

        // تحديث قائمة السنوات السابقة
        const previousYears = years.filter(y => !y.is_active);
        const container = document.getElementById('previousYearsList');
        
        if (previousYears.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>لا توجد سنوات دراسية سابقة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = previousYears.map(year => `
            <div class="year-list-item">
                <div class="year-info">
                    <i class="fas fa-calendar"></i>
                    <div>
                        <h4>${year.name}</h4>
                        <span class="year-date">${window.Helpers.formatDate(year.created_at)}</span>
                    </div>
                </div>
                <div class="year-actions">
                    <button class="btn btn-outline btn-sm" onclick="activateYear('${year.id}')">
                        <i class="fas fa-check"></i>
                        تفعيل
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading academic years:', error);
        window.Helpers.showToast('خطأ في تحميل السنوات الدراسية', 'error');
    }
}

// تفعيل عام دراسي
async function activateYear(yearId) {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // تعطيل جميع السنوات أولاً
        await window.EduPath.supabase
            .from('academic_years')
            .update({ is_active: false })
            .eq('school_id', schoolId);

        // تفعيل العام المحدد
        const { error } = await window.EduPath.supabase
            .from('academic_years')
            .update({ is_active: true })
            .eq('id', yearId);

        if (error) throw error;

        window.Helpers.showToast('تم تفعيل العام الدراسي بنجاح', 'success');
        await loadAcademicYears();
        await loadActiveAcademicYear();

    } catch (error) {
        console.error('Error activating year:', error);
        window.Helpers.showToast('خطأ في تفعيل العام الدراسي', 'error');
    }
}

// تعطيل عام دراسي
async function deactivateYear(yearId) {
    if (!confirm('هل أنت متأكد من تعطيل هذا العام الدراسي؟')) {
        return;
    }

    try {
        const { error } = await window.EduPath.supabase
            .from('academic_years')
            .update({ is_active: false })
            .eq('id', yearId);

        if (error) throw error;

        window.Helpers.showToast('تم تعطيل العام الدراسي بنجاح', 'success');
        await loadAcademicYears();
        await loadActiveAcademicYear();

    } catch (error) {
        console.error('Error deactivating year:', error);
        window.Helpers.showToast('خطأ في تعطيل العام الدراسي', 'error');
    }
}

// تبديل قائمة الجوال
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('show');
}

// إغلاق النافذة المنبثقة
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// تفعيل Realtime
function setupRealtime() {
    // الاشتراك في تحديثات المستخدمين
    const usersChannel = window.EduPath.supabase.channel('admin_users_channel')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'users',
                filter: `school_id=eq.${window.AppState.currentUser.school_id}`
            }, 
            payload => {
                window.Helpers.showToast('تمت إضافة مستخدم جديد', 'info');
                loadStatistics();
                updateUsersCount();
            }
        )
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `school_id=eq.${window.AppState.currentUser.school_id}`
            },
            payload => {
                if (payload.new.role === 'teacher') {
                    if (typeof loadTeachers === 'function') loadTeachers();
                } else if (payload.new.role === 'student') {
                    if (typeof loadStudents === 'function') loadStudents();
                }
            }
        )
        .subscribe();

    // الاشتراك في تحديثات الإشعارات
    const notificationsChannel = window.EduPath.supabase.channel('admin_notifications_channel')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            },
            payload => {
                loadRecentActivity();
            }
        )
        .subscribe();
}

// تحديث أعداد المستخدمين
function updateUsersCount() {
    document.getElementById('teachersTabBadge').textContent = AdminState.teachers.length;
    document.getElementById('studentsTabBadge').textContent = AdminState.students.length;
}

// ==================== دالة البحث عن ولي الأمر ====================
async function findExistingParent() {
    const fullName = document.getElementById('studentFullName').value.trim();
    const nameParts = fullName.split(' ');
    const parentStatus = document.getElementById('parentStatus');
    const parentCodeInput = document.getElementById('studentParentCode');

    // نحتاج على الأقل لاسمين (الاسم واسم الأب) للبدء في البحث
    if (nameParts.length >= 2) {
        // استخراج اسم الأب والجد (كل ما بعد الاسم الأول)
        const fatherName = nameParts.slice(1).join(' ');
        const expectedParentName = `${fatherName} (ولي أمر)`;

        parentStatus.textContent = "جاري البحث عن ولي أمر مرتبط...";

        try {
            const { data, error } = await window.EduPath.supabase
                .from('users')
                .select('login_code')
                .eq('full_name', expectedParentName)
                .eq('school_id', window.AppState.currentUser.school_id)
                .maybeSingle();

            if (data) {
                // إذا وجدنا الأب مسبقاً، نضع الكود الخاص به تلقائياً
                parentCodeInput.value = data.login_code;
                parentCodeInput.readOnly = true; // نجعله للقراءة فقط لضمان الربط
                parentStatus.textContent = `✅ تم الربط تلقائياً بولي الأمر: ${fatherName}`;
                parentStatus.style.color = "green";
            } else {
                // إذا لم يوجد، نسمح للمدير بتوليد كود جديد
                if (parentCodeInput.readOnly) {
                    parentCodeInput.value = "";
                    parentCodeInput.readOnly = false;
                }
                parentStatus.textContent = "ℹ️ ولي أمر جديد (سيتم إنشاء حساب له)";
                parentStatus.style.color = "var(--gray)";
            }
        } catch (err) {
            console.error("Error searching parent:", err);
        }
    } else {
        parentStatus.textContent = "";
    }
}

// ==================== الوظائف المشتركة ====================

// تحويل البيانات إلى CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => JSON.stringify(row[header])).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

// تنزيل ملف CSV
function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// تهيئة معالج الترقية (يتم استدعاؤها من promotion.js)
function initializePromotionWizard() {
    AdminState.promotionData = {
        sourceClassId: null,
        targetClassId: null,
        selectedStudents: []
    };
    AdminState.selectedStudentIds.clear();
    if (typeof goToStep === 'function') goToStep(1);
}

// التبديل بين التبويبات
function switchTab(tabName) {
    // 1. إزالة الفعالية عن جميع الأزرار والمحتويات
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 2. تحديد الزر الذي تم الضغط عليه
    const targetTabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    
    // 3. تحديد المحتوى المطلوب (مع معالجة مشكلة التسمية في generate-codes)
    let contentId = `${tabName}Tab`;
    if (tabName === 'generate-codes') {
        contentId = 'generateCodesTab'; // تصحيح المسمى ليتوافق مع الـ ID في HTML
    }
    const targetContent = document.getElementById(contentId);

    // 4. التحقق من وجود العناصر قبل إضافة classList لضمان عدم توقف الكود
    if (targetTabBtn) {
        targetTabBtn.classList.add('active');
    } else {
        console.warn(`Tab button with data-tab="${tabName}" not found.`);
    }

    if (targetContent) {
        targetContent.classList.add('active');
    } else {
        console.warn(`Tab content with id="${contentId}" not found.`);
    }

    AdminState.currentTab = tabName;

    // 5. تحميل البيانات حسب التبويب المختار
    switch(tabName) {
        case 'teachers':
            if (typeof loadTeachers === 'function') loadTeachers();
            break;
        case 'students':
            if (typeof loadStudents === 'function') loadStudents();
            break;
        case 'generate-codes':
            if (typeof updateCodeGenerationStats === 'function') updateCodeGenerationStats();
            break;
    }
}




// دالة لفتح أي نافذة منبثقة
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // منع التمرير خلف النافذة
    }
}

// دالة لإغلاق أي نافذة منبثقة
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// إغلاق النافذة عند الضغط خارجها
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}


// أضف هذا الكود في نهاية الملف تماماً (خارج أي أقواس أخرى)
window.manageClasses = function() {
    console.log("جاري محاولة فتح النافذة...");
    
    const modal = document.getElementById('classesModal');
    
    if (!modal) {
        alert("خطأ: لم يتم العثور على نافذة باسم classesModal في ملف HTML. تأكد من وجود id='classesModal'");
        return;
    }

    // 1. إظهار النافذة وإجبارها على التصدر (Force Show)
    modal.style.setProperty('display', 'block', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('z-index', '99999', 'important');
    modal.style.setProperty('position', 'fixed', 'important');

    // 2. ضمان ظهور المحتوى الداخلي
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.setProperty('display', 'block', 'important');
        content.style.setProperty('z-index', '100000', 'important');
    }

    // 3. تشغيل التبويب الأول وجلب البيانات
    window.switchClassTab('list');
    
    console.log("تم تنفيذ أوامر الإظهار");
};

// دالة التنقل بين التبويبات معدلة لضمان الظهور
window.switchClassTab = function(tabName) {
    const listTab = document.getElementById('classListTab');
    const addTab = document.getElementById('addClassTab');
    const tabs = document.querySelectorAll('.modal-tab');

    if (!listTab || !addTab) return;

    tabs.forEach(t => t.classList.remove('active'));
    
    if (tabName === 'list') {
        listTab.style.setProperty('display', 'block', 'important');
        addTab.style.setProperty('display', 'none', 'important');
        if(tabs[0]) tabs[0].classList.add('active');
        window.loadClassesList(); // جلب الصفوف
    } else {
        addTab.style.setProperty('display', 'block', 'important');
        listTab.style.setProperty('display', 'none', 'important');
        if(tabs[1]) tabs[1].classList.add('active');
    }
};

// دالة جلب الصفوف مع أزرار التعديل والحذف
window.loadClassesList = async function() {
    const container = document.getElementById('classesList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">جاري جلب البيانات...</div>';

    try {
        const { data, error } = await window.EduPath.supabase
            .from('classes')
            .select('*')
            .eq('school_id', window.AppState.currentUser.school_id)
            .order('name');

        if (error) throw error;

        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px;">لا توجد صفوف.</p>';
            return;
        }

        data.forEach(cls => {
            const div = document.createElement('div');
            div.style = "display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; background:#f9f9f9; margin-bottom:5px; border-radius:8px;";
            div.innerHTML = `
                <span style="font-weight:bold; color:#333;">${cls.name}</span>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.editClass('${cls.id}', '${cls.name}')" style="background:#673ab7; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">تعديل</button>
                    <button onclick="window.deleteClass('${cls.id}')" style="background:#f44336; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">حذف</button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = '<p style="color:red; text-align:center;">حدث خطأ أثناء جلب البيانات</p>';
    }
};




window.editClass = async function(id, oldName) {
    const newName = prompt("تعديل اسم الصف:", oldName);
    if (!newName || newName === oldName) return;

    const { error } = await window.EduPath.supabase.from('classes').update({ name: newName }).eq('id', id);
    if (!error) {
        alert("تم التعديل بنجاح");
        window.loadClassesList();
    }
};

window.deleteClass = async function(id) {
    if (!confirm("هل أنت متأكد من حذف الصف؟")) return;

    const { error } = await window.EduPath.supabase.from('classes').delete().eq('id', id);
    if (!error) {
        alert("تم الحذف بنجاح");
        window.loadClassesList();
    }
};


window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};





