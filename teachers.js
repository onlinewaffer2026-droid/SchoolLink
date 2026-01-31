// admin/teachers.js
// إدارة المعلمين وإنشاء أكوادهم

// تهيئة أحداث إدارة المعلمين
document.addEventListener('DOMContentLoaded', function() {
    // تهيئة أحداث البحث والتصفية
    setupTeacherEvents();
});

// إعداد أحداث المعلمين
function setupTeacherEvents() {
    // البحث عن المعلمين
    const teacherSearch = document.getElementById('teacherSearch');
    if (teacherSearch) {
        teacherSearch.addEventListener('input', filterTeachers);
    }
    
    // تصفية حسب التخصص
    const teacherSubjectFilter = document.getElementById('teacherSubjectFilter');
    if (teacherSubjectFilter) {
        teacherSubjectFilter.addEventListener('change', filterTeachers);
    }
}

// تحميل المعلمين
async function loadTeachers() {
    try {
        const schoolId = window.AppState.currentUser?.school_id;
        if (!schoolId) {
            console.error('No school ID found');
            return;
        }

        const { data, error } = await window.EduPath.supabase
            .from('users')
            .select('*, classes:current_class_id(name)')
            .eq('school_id', schoolId)
            .eq('role', 'teacher')
            .order('full_name');

        if (error) {
            console.error("Supabase Error in loadTeachers:", error);
            // عرض رسالة خطأ في الواجهة
            const container = document.getElementById('teachersGrid');
            if (container) {
                container.innerHTML = '<div class="empty-state"><p>حدث خطأ في تحميل بيانات المعلمين</p></div>';
            }
            return;
        }

        // تحديث الحالة العامة
        AdminState.teachers = data || [];
        
        // تحديث العد في التبويب
        document.getElementById('teachersTabBadge').textContent = AdminState.teachers.length;
        
        // عرض المعلمين
        displayTeachers();

    } catch (err) {
        console.error("Unexpected Logic Error in loadTeachers:", err);
        const container = document.getElementById('teachersGrid');
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>حدث خطأ غير متوقع</p></div>';
        }
    }
}

// عرض المعلمين في الواجهة
function displayTeachers() {
    const container = document.getElementById('teachersGrid');
    if (!container) return;
    
    // إذا لم يكن هناك معلمون
    if (!AdminState.teachers || AdminState.teachers.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-chalkboard-teacher"></i>
                <p>لا يوجد معلمون بعد</p>
                <button class="btn btn-primary" onclick="showAddTeacherModal()">
                    <i class="fas fa-user-plus"></i>
                    إضافة أول معلم
                </button>
            </div>
        `;
        return;
    }
    
    // عرض المعلمين
    container.innerHTML = AdminState.teachers.map(teacher => `
        <div class="teacher-card">
            <div class="teacher-header">
                <div class="teacher-avatar">
                    ${getInitials(teacher.full_name)}
                </div>
                <div class="teacher-info">
                    <h3>${teacher.full_name || 'بدون اسم'}</h3>
                    <span class="teacher-subject">${teacher.subject || 'غير محدد'}</span>
                </div>
                <div class="teacher-actions">
                    <button class="btn btn-icon btn-sm" onclick="editTeacher('${teacher.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-sm btn-danger" onclick="deleteTeacher('${teacher.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="teacher-details">
                <div class="detail-item">
                    <i class="fas fa-key"></i>
                    <span>${teacher.login_code || 'لا يوجد كود'}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-chalkboard"></i>
                    <span>${teacher.classes?.name || 'غير مكلف'}</span>
                </div>
                ${teacher.phone ? `
                <div class="detail-item">
                    <i class="fas fa-phone"></i>
                    <span>${teacher.phone}</span>
                </div>
                ` : ''}
                ${teacher.email ? `
                <div class="detail-item">
                    <i class="fas fa-envelope"></i>
                    <span>${teacher.email}</span>
                </div>
                ` : ''}
            </div>
            <div class="teacher-footer">
                <span class="badge badge-primary">معلم</span>
                <span class="teacher-date">${window.Helpers.formatDate(teacher.created_at)}</span>
            </div>
        </div>
    `).join('');
}

// الحصول على الأحرف الأولى من الاسم
function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// تصفية المعلمين
function filterTeachers() {
    const searchTerm = document.getElementById('teacherSearch')?.value.toLowerCase() || '';
    const subjectFilter = document.getElementById('teacherSubjectFilter')?.value || '';
    
    const items = document.querySelectorAll('.teacher-card');
    
    items.forEach(item => {
        const name = item.querySelector('h3')?.textContent.toLowerCase() || '';
        const subject = item.querySelector('.teacher-subject')?.textContent || '';
        const code = item.querySelector('.detail-item:nth-child(1) span')?.textContent.toLowerCase() || '';
        const className = item.querySelector('.detail-item:nth-child(2) span')?.textContent.toLowerCase() || '';
        
        const nameMatch = name.includes(searchTerm);
        const subjectMatch = !subjectFilter || subject === subjectFilter;
        const codeMatch = code.includes(searchTerm);
        const classMatch = className.includes(searchTerm);
        
        // عرض العنصر إذا تطابق مع أي من شروط البحث
        item.style.display = (nameMatch || codeMatch || classMatch) && subjectMatch ? 'block' : 'none';
    });
}

// تعديل معلم
async function editTeacher(teacherId) {
    try {
        const teacher = AdminState.teachers.find(t => t.id === teacherId);
        if (!teacher) {
            window.Helpers.showToast('لم يتم العثور على المعلم', 'error');
            return;
        }

        // إنشاء نافذة تعديل ديناميكية
        const modalContent = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-edit"></i>
                        تعديل بيانات المعلم
                    </h3>
                    <button class="modal-close" onclick="closeModal('editTeacherModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editTeacherForm" class="form">
                        <div class="input-group">
                            <label for="editTeacherFullName" class="input-label">
                                <i class="fas fa-user"></i>
                                الاسم الكامل *
                            </label>
                            <input 
                                type="text" 
                                id="editTeacherFullName" 
                                class="input-field"
                                value="${teacher.full_name || ''}"
                                required
                            >
                        </div>

                        <div class="input-group">
                            <label for="editTeacherSubject" class="input-label">
                                <i class="fas fa-book"></i>
                                التخصص *
                            </label>
                            <select id="editTeacherSubject" class="select-field" required>
                                <option value="">اختر التخصص</option>
                                <option value="الرياضيات" ${teacher.subject === 'الرياضيات' ? 'selected' : ''}>الرياضيات</option>
                                <option value="العلوم" ${teacher.subject === 'العلوم' ? 'selected' : ''}>العلوم</option>
                                <option value="اللغة العربية" ${teacher.subject === 'اللغة العربية' ? 'selected' : ''}>اللغة العربية</option>
                                <option value="اللغة الإنجليزية" ${teacher.subject === 'اللغة الإنجليزية' ? 'selected' : ''}>اللغة الإنجليزية</option>
                                <option value="الاجتماعيات" ${teacher.subject === 'الاجتماعيات' ? 'selected' : ''}>الاجتماعيات</option>
                                <option value="التربية الإسلامية" ${teacher.subject === 'التربية الإسلامية' ? 'selected' : ''}>التربية الإسلامية</option>
                                <option value="الحاسب الآلي" ${teacher.subject === 'الحاسب الآلي' ? 'selected' : ''}>الحاسب الآلي</option>
                                <option value="التربية البدنية" ${teacher.subject === 'التربية البدنية' ? 'selected' : ''}>التربية البدنية</option>
                                <option value="الفنون" ${teacher.subject === 'الفنون' ? 'selected' : ''}>الفنون</option>
                                <option value="أخرى" ${teacher.subject === 'أخرى' ? 'selected' : ''}>أخرى</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <label for="editTeacherClass" class="input-label">
                                <i class="fas fa-chalkboard"></i>
                                الصف المكلف
                            </label>
                            <select id="editTeacherClass" class="select-field">
                                <option value="">غير مكلف بصف (معلم عام)</option>
                                ${AdminState.classes.map(cls => 
                                    `<option value="${cls.id}" ${teacher.current_class_id === cls.id ? 'selected' : ''}>${cls.name}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="input-group">
                            <label for="editTeacherPhone" class="input-label">
                                <i class="fas fa-phone"></i>
                                رقم الهاتف
                            </label>
                            <input 
                                type="tel" 
                                id="editTeacherPhone" 
                                class="input-field"
                                value="${teacher.phone || ''}"
                                placeholder="مثال: 0555123456"
                            >
                        </div>

                        <div class="input-group">
                            <label for="editTeacherEmail" class="input-label">
                                <i class="fas fa-envelope"></i>
                                البريد الإلكتروني
                            </label>
                            <input 
                                type="email" 
                                id="editTeacherEmail" 
                                class="input-field"
                                value="${teacher.email || ''}"
                                placeholder="example@school.edu"
                            >
                        </div>

                        <div class="input-group">
                            <label for="editTeacherLoginCode" class="input-label">
                                <i class="fas fa-key"></i>
                                كود الدخول *
                            </label>
                            <div class="input-with-button">
                                <input 
                                    type="text" 
                                    id="editTeacherLoginCode" 
                                    class="input-field"
                                    value="${teacher.login_code || ''}"
                                    required
                                >
                                <button type="button" class="btn btn-outline btn-sm" onclick="generateEditTeacherCode()">
                                    <i class="fas fa-sync-alt"></i>
                                    توليد
                                </button>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-outline" onclick="closeModal('editTeacherModal')">
                                <i class="fas fa-times"></i>
                                إلغاء
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i>
                                حفظ التغييرات
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // إنشاء المودال
        const modal = document.createElement('div');
        modal.id = 'editTeacherModal';
        modal.className = 'modal';
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);

        // إظهار المودال
        modal.style.display = 'block';

        // إعداد حدث الحفظ
        const editTeacherForm = document.getElementById('editTeacherForm');
        if (editTeacherForm) {
            editTeacherForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await updateTeacher(teacherId);
            });
        }

    } catch (error) {
        console.error('Error in editTeacher:', error);
        window.Helpers.showToast('حدث خطأ أثناء تحضير نموذج التعديل', 'error');
    }
}

// توليد كود جديد للمعلم في نموذج التعديل
function generateEditTeacherCode() {
    const code = 'TCH' + window.Helpers.generateLoginCode(5);
    const codeInput = document.getElementById('editTeacherLoginCode');
    if (codeInput) {
        codeInput.value = code;
    }
}

// تحديث بيانات المعلم
async function updateTeacher(teacherId) {
    try {
        const form = document.getElementById('editTeacherForm');
        if (!form) return;

        const payload = {
            full_name: document.getElementById('editTeacherFullName').value.trim(),
            subject: document.getElementById('editTeacherSubject').value,
            current_class_id: document.getElementById('editTeacherClass').value || null,
            phone: document.getElementById('editTeacherPhone').value.trim() || null,
            email: document.getElementById('editTeacherEmail').value.trim() || null,
            login_code: document.getElementById('editTeacherLoginCode').value.trim()
        };

        // التحقق من المدخلات الأساسية
        if (!payload.full_name || !payload.subject || !payload.login_code) {
            window.Helpers.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
            return;
        }

        const { error } = await window.EduPath.supabase
            .from('users')
            .update(payload)
            .eq('id', teacherId);

        if (error) throw error;

        window.Helpers.showToast('تم تحديث بيانات المعلم بنجاح', 'success');
        
        // إغلاق المودال وإزالته من DOM
        const modal = document.getElementById('editTeacherModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        
        // تحديث البيانات
        await loadTeachers();

    } catch (error) {
        console.error('Error updating teacher:', error);
        window.Helpers.showToast('خطأ في تحديث بيانات المعلم: ' + error.message, 'error');
    }
}

// حذف معلم
async function deleteTeacher(teacherId) {
    if (!confirm('هل أنت متأكد من حذف هذا المعلم؟ لا يمكن التراجع عن هذه العملية.')) {
        return;
    }

    try {
        const { error } = await window.EduPath.supabase
            .from('users')
            .delete()
            .eq('id', teacherId);

        if (error) throw error;

        window.Helpers.showToast('تم حذف المعلم بنجاح', 'success');
        
        // تحديث البيانات
        await loadTeachers();
        if (typeof loadStatistics === 'function') await loadStatistics();

    } catch (error) {
        console.error('Error deleting teacher:', error);
        window.Helpers.showToast('خطأ في حذف المعلم: ' + error.message, 'error');
    }
}

// عرض تفاصيل المعلم
async function viewTeacherDetails(teacherId) {
    try {
        const { data: teacher, error } = await window.EduPath.supabase
            .from('users')
            .select(`
                *,
                classes:current_class_id(name),
                assignments:assignments(count),
                notifications:notifications(count)
            `)
            .eq('id', teacherId)
            .single();

        if (error) throw error;

        // عرض تفاصيل المعلم في نافذة منبثقة
        const modalContent = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-chalkboard-teacher"></i>
                        تفاصيل المعلم
                    </h3>
                    <button class="modal-close" onclick="closeModal('teacherDetailsModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="teacher-profile">
                        <div class="profile-header" style="display: flex; align-items: center; gap: 20px; margin-bottom: 30px;">
                            <div class="teacher-avatar-large">
                                ${getInitials(teacher.full_name)}
                            </div>
                            <div>
                                <h2 style="margin: 0 0 5px;">${teacher.full_name}</h2>
                                <span class="badge badge-primary">معلم</span>
                                <p style="color: var(--gray); margin-top: 5px;">${teacher.subject || 'غير محدد'}</p>
                            </div>
                        </div>

                        <div class="profile-details">
                            <h4><i class="fas fa-info-circle"></i> المعلومات الأساسية</h4>
                            <div class="details-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0;">
                                <div class="detail-item">
                                    <strong>كود الدخول:</strong>
                                    <span class="code-display">${teacher.login_code || 'لا يوجد'}</span>
                                </div>
                                <div class="detail-item">
                                    <strong>الصف المكلف:</strong>
                                    <span>${teacher.classes?.name || 'غير مكلف'}</span>
                                </div>
                                ${teacher.phone ? `
                                <div class="detail-item">
                                    <strong>رقم الهاتف:</strong>
                                    <span>${teacher.phone}</span>
                                </div>
                                ` : ''}
                                ${teacher.email ? `
                                <div class="detail-item">
                                    <strong>البريد الإلكتروني:</strong>
                                    <span>${teacher.email}</span>
                                </div>
                                ` : ''}
                                <div class="detail-item">
                                    <strong>تاريخ الإضافة:</strong>
                                    <span>${window.Helpers.formatDate(teacher.created_at)}</span>
                                </div>
                            </div>

                            <h4 style="margin-top: 30px;"><i class="fas fa-chart-bar"></i> الإحصائيات</h4>
                            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0;">
                                <div class="stat-card-small">
                                    <div class="stat-value">${teacher.assignments?.[0]?.count || 0}</div>
                                    <div class="stat-label">الواجبات</div>
                                </div>
                                <div class="stat-card-small">
                                    <div class="stat-value">${teacher.notifications?.[0]?.count || 0}</div>
                                    <div class="stat-label">الإشعارات</div>
                                </div>
                                <div class="stat-card-small">
                                    <div class="stat-value">${teacher.is_active ? 'نشط' : 'غير نشط'}</div>
                                    <div class="stat-label">الحالة</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('teacherDetailsModal')">
                        <i class="fas fa-times"></i>
                        إغلاق
                    </button>
                    <button class="btn btn-primary" onclick="editTeacher('${teacher.id}')">
                        <i class="fas fa-edit"></i>
                        تعديل البيانات
                    </button>
                </div>
            </div>
        `;

        // إنشاء وإظهار المودال
        const modal = document.createElement('div');
        modal.id = 'teacherDetailsModal';
        modal.className = 'modal';
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        modal.style.display = 'block';

    } catch (error) {
        console.error('Error viewing teacher details:', error);
        window.Helpers.showToast('خطأ في عرض تفاصيل المعلم', 'error');
    }
}

// استيراد معلمين من ملف CSV
async function importTeachersFromCSV(file) {
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const csvContent = e.target.result;
            const rows = parseCSV(csvContent);
            
            if (rows.length < 2) {
                window.Helpers.showToast('الملف فارغ أو لا يحتوي على بيانات', 'error');
                return;
            }
            
            const headers = rows[0];
            const requiredHeaders = ['الاسم_الكامل', 'التخصص', 'كود_الدخول'];
            
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                window.Helpers.showToast(`العناوين المفقودة: ${missingHeaders.join(', ')}`, 'error');
                return;
            }
            
            const schoolId = window.AppState.currentUser.school_id;
            const teachersData = [];
            const errors = [];
            
            for (let i = 1; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    const fullName = row[headers.indexOf('الاسم_الكامل')]?.trim();
                    const subject = row[headers.indexOf('التخصص')]?.trim();
                    const loginCode = row[headers.indexOf('كود_الدخول')]?.trim();
                    
                    if (!fullName || !subject || !loginCode) {
                        errors.push(`صف ${i+1}: بيانات ناقصة`);
                        continue;
                    }
                    
                    teachersData.push({
                        school_id: schoolId,
                        full_name: fullName,
                        subject: subject,
                        login_code: loginCode,
                        role: 'teacher',
                        current_class_id: null
                    });
                    
                } catch (rowError) {
                    errors.push(`صف ${i+1}: خطأ في المعالجة`);
                }
            }
            
            if (teachersData.length === 0) {
                window.Helpers.showToast('لم يتم العثور على بيانات صالحة', 'error');
                return;
            }
            
            // إدخال البيانات دفعة واحدة
            const { error } = await window.EduPath.supabase
                .from('users')
                .insert(teachersData);
            
            if (error) throw error;
            
            let message = `تم استيراد ${teachersData.length} معلم بنجاح`;
            if (errors.length > 0) {
                message += ` (مع ${errors.length} أخطاء)`;
            }
            
            window.Helpers.showToast(message, 'success');
            
            // تحديث البيانات
            await loadTeachers();
            if (typeof loadStatistics === 'function') await loadStatistics();
            
        };
        
        reader.readAsText(file, 'UTF-8');
        
    } catch (error) {
        console.error('Error importing teachers:', error);
        window.Helpers.showToast('خطأ في استيراد المعلمين: ' + error.message, 'error');
    }
}

// تحليل ملف CSV
function parseCSV(csv) {
    const lines = csv.split('\n').map(line => line.trim()).filter(line => line);
    return lines.map(line => {
        const result = [];
        let inQuotes = false;
        let currentField = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        
        result.push(currentField);
        return result.map(field => field.replace(/^"|"$/g, ''));
    });
}

// تصدير بيانات المعلمين
function exportTeachersData() {
    try {
        const data = AdminState.teachers.map(teacher => ({
            'اسم المعلم': teacher.full_name,
            'التخصص': teacher.subject || 'غير محدد',
            'كود الدخول': teacher.login_code || 'لا يوجد',
            'الصف المكلف': teacher.classes?.name || 'غير مكلف',
            'رقم الهاتف': teacher.phone || 'لا يوجد',
            'البريد الإلكتروني': teacher.email || 'لا يوجد',
            'تاريخ الإضافة': window.Helpers.formatDate(teacher.created_at)
        }));
        
        if (data.length === 0) {
            window.Helpers.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }
        
        const csv = convertToCSV(data);
        downloadCSV(csv, 'المعلمون.csv');
        window.Helpers.showToast('تم تصدير بيانات المعلمين بنجاح', 'success');
        
    } catch (error) {
        console.error('Error exporting teachers data:', error);
        window.Helpers.showToast('خطأ في تصدير البيانات', 'error');
    }
}

// توليد أكواد للمعلمين المحددين
async function bulkGenerateTeacherCodes() {
    const selectedTeachers = getSelectedTeachers();
    
    if (selectedTeachers.length === 0) {
        window.Helpers.showToast('يرجى اختيار معلمين لتوليد الأكواد', 'error');
        return;
    }
    
    try {
        const updates = [];
        
        for (const teacher of selectedTeachers) {
            const newCode = 'TCH' + window.Helpers.generateLoginCode(5);
            updates.push({
                id: teacher.id,
                code: newCode
            });
            
            const { error } = await window.EduPath.supabase
                .from('users')
                .update({ login_code: newCode })
                .eq('id', teacher.id);
            
            if (error) throw error;
        }
        
        window.Helpers.showToast(`تم توليد ${updates.length} كود للمعلمين`, 'success');
        
        // تحديث البيانات
        await loadTeachers();
        
        // عرض الأكواد المولدة
        displayGeneratedTeacherCodes(updates);
        
    } catch (error) {
        console.error('Error generating teacher codes:', error);
        window.Helpers.showToast('خطأ في توليد الأكواد', 'error');
    }
}

// الحصول على المعلمين المحددين
function getSelectedTeachers() {
    // هذه الوظيفة تحتاج إلى تعديل إذا كان هناك خانة اختيار للمعلمين
    // حالياً، سنستخدم AdminState.teachers كاملة أو نضيف خاصية الاختيار لاحقاً
    return AdminState.teachers.filter(teacher => teacher.login_code === null);
}

// عرض الأكواد المولدة للمعلمين
function displayGeneratedTeacherCodes(codes) {
    const preview = document.getElementById('generatedCodesPreview');
    if (!preview) return;
    
    preview.innerHTML = `
        <div class="generated-codes-header">
            <h4>
                <i class="fas fa-key"></i>
                الأكواد المولدة حديثاً (معلمين)
            </h4>
            <button class="btn btn-sm btn-outline" onclick="copyAllTeacherCodes()">
                <i class="fas fa-copy"></i>
                نسخ الكل
            </button>
        </div>
        <div class="codes-list">
            ${codes.map(code => {
                const teacher = AdminState.teachers.find(t => t.id === code.id);
                return `
                    <div class="code-item">
                        <span class="code-name">${teacher?.full_name || 'غير معروف'}</span>
                        <span class="code-value">${code.code}</span>
                        <button class="btn btn-icon btn-sm" onclick="copyCode('${code.code}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// نسخ جميع أكواد المعلمين
function copyAllTeacherCodes() {
    const codes = Array.from(document.querySelectorAll('.code-value')).map(el => el.textContent);
    const text = codes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        window.Helpers.showToast('تم نسخ جميع الأكواد', 'success');
    });
}

// تعطيل/تفعيل حساب معلم
async function toggleTeacherStatus(teacherId, isActive) {
    try {
        const { error } = await window.EduPath.supabase
            .from('users')
            .update({ is_active: isActive })
            .eq('id', teacherId);
        
        if (error) throw error;
        
        const status = isActive ? 'تفعيل' : 'تعطيل';
        window.Helpers.showToast(`تم ${status} حساب المعلم بنجاح`, 'success');
        
        // تحديث البيانات
        await loadTeachers();
        
    } catch (error) {
        console.error('Error toggling teacher status:', error);
        window.Helpers.showToast('خطأ في تغيير حالة المعلم', 'error');
    }
}

// البحث المتقدم عن المعلمين
function advancedTeacherSearch(filters) {
    let results = AdminState.teachers;
    
    if (filters.name) {
        const nameTerm = filters.name.toLowerCase();
        results = results.filter(teacher => 
            teacher.full_name.toLowerCase().includes(nameTerm)
        );
    }
    
    if (filters.subject) {
        results = results.filter(teacher => 
            teacher.subject === filters.subject
        );
    }
    
    if (filters.classId) {
        results = results.filter(teacher => 
            teacher.current_class_id === filters.classId
        );
    }
    
    if (filters.hasCode !== undefined) {
        if (filters.hasCode) {
            results = results.filter(teacher => teacher.login_code);
        } else {
            results = results.filter(teacher => !teacher.login_code);
        }
    }
    
    return results;
}

// إحصائيات المعلمين
function getTeacherStatistics() {
    if (!AdminState.teachers || AdminState.teachers.length === 0) {
        return {
            total: 0,
            bySubject: {},
            withCode: 0,
            withoutCode: 0,
            active: 0,
            inactive: 0
        };
    }
    
    const stats = {
        total: AdminState.teachers.length,
        bySubject: {},
        withCode: 0,
        withoutCode: 0,
        active: 0,
        inactive: 0
    };
    
    AdminState.teachers.forEach(teacher => {
        // حسب التخصص
        const subject = teacher.subject || 'غير محدد';
        stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
        
        // حسب وجود الكود
        if (teacher.login_code) {
            stats.withCode++;
        } else {
            stats.withoutCode++;
        }
        
        // حسب النشاط
        if (teacher.is_active) {
            stats.active++;
        } else {
            stats.inactive++;
        }
    });
    
    return stats;
}

// إعادة تعيين كود المعلم
async function resetTeacherCode(teacherId) {
    if (!confirm('هل تريد إعادة تعيين كود الدخول لهذا المعلم؟')) {
        return;
    }
    
    try {
        const newCode = 'TCH' + window.Helpers.generateLoginCode(5);
        
        const { error } = await window.EduPath.supabase
            .from('users')
            .update({ login_code: newCode })
            .eq('id', teacherId);
        
        if (error) throw error;
        
        window.Helpers.showToast(`تم تعيين كود جديد: ${newCode}`, 'success');
        
        // تحديث البيانات
        await loadTeachers();
        
    } catch (error) {
        console.error('Error resetting teacher code:', error);
        window.Helpers.showToast('خطأ في إعادة تعيين الكود', 'error');
    }
}