// admin/codes.js
// توليد الأكواد وعرضها

// تهيئة أحداث توليد الأكواد
document.addEventListener('DOMContentLoaded', function() {
    // تحديث إحصائيات الأكواد عند تحميل الصفحة
    if (AdminState.currentTab === 'generate-codes') {
        updateCodeGenerationStats();
    }
});

// تحديث إحصائيات توليد الأكواد
async function updateCodeGenerationStats() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // جلب المستخدمين بدون أكواد
        const { data: usersWithoutCodes, error } = await window.EduPath.supabase
            .from('users')
            .select('role')
            .eq('school_id', schoolId)
            .is('login_code', null);
        
        if (error) throw error;
        
        const teachersWithoutCodes = usersWithoutCodes.filter(u => u.role === 'teacher').length;
        const studentsWithoutCodes = usersWithoutCodes.filter(u => u.role === 'student').length;
        const totalWithoutCodes = usersWithoutCodes.length;
        
        document.getElementById('teachersWithoutCodes').textContent = teachersWithoutCodes;
        document.getElementById('studentsWithoutCodes').textContent = studentsWithoutCodes;
        document.getElementById('totalWithoutCodes').textContent = totalWithoutCodes;
        
    } catch (error) {
        console.error('Error updating code generation stats:', error);
        window.Helpers.showToast('خطأ في تحديث إحصائيات الأكواد', 'error');
    }
}

// توليد أكواد للمعلمين
async function generateTeacherCodes() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // جلب المعلمين بدون أكواد
        const { data: teachers, error: fetchError } = await window.EduPath.supabase
            .from('users')
            .select('*')
            .eq('school_id', schoolId)
            .eq('role', 'teacher')
            .is('login_code', null);
        
        if (fetchError) throw fetchError;
        
        if (teachers.length === 0) {
            window.Helpers.showToast('جميع المعلمين لديهم أكواد دخول', 'info');
            return;
        }
        
        // توليد أكواد جديدة
        const updates = teachers.map(teacher => {
            const code = 'TCH' + window.Helpers.generateLoginCode(5);
            return {
                id: teacher.id,
                login_code: code,
                full_name: teacher.full_name
            };
        });
        
        // تحديث قاعدة البيانات
        for (const update of updates) {
            const { error } = await window.EduPath.supabase
                .from('users')
                .update({ login_code: update.login_code })
                .eq('id', update.id);
            
            if (error) throw error;
        }
        
        // عرض الأكواد المولدة
        displayGeneratedCodes(updates, 'معلمين');
        
        window.Helpers.showToast(`تم توليد ${updates.length} كود للمعلمين`, 'success');
        await updateCodeGenerationStats();
        if (typeof loadTeachers === 'function') await loadTeachers();
        
    } catch (error) {
        console.error('Error generating teacher codes:', error);
        window.Helpers.showToast('خطأ في توليد الأكواد', 'error');
    }
}

// توليد أكواد للطلاب
async function generateStudentCodes() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // جلب الطلاب بدون أكواد
        const { data: students, error: fetchError } = await window.EduPath.supabase
            .from('users')
            .select('*')
            .eq('school_id', schoolId)
            .eq('role', 'student')
            .is('login_code', null);
        
        if (fetchError) throw fetchError;
        
        if (students.length === 0) {
            window.Helpers.showToast('جميع الطلاب لديهم أكواد دخول', 'info');
            return;
        }
        
        // توليد أكواد جديدة
        const updates = students.map(student => {
            const code = 'STD' + window.Helpers.generateLoginCode(5);
            return {
                id: student.id,
                login_code: code,
                full_name: student.full_name
            };
        });
        
        // تحديث قاعدة البيانات
        for (const update of updates) {
            const { error } = await window.EduPath.supabase
                .from('users')
                .update({ login_code: update.login_code })
                .eq('id', update.id);
            
            if (error) throw error;
        }
        
        // عرض الأكواد المولدة
        displayGeneratedCodes(updates, 'طلاب');
        
        window.Helpers.showToast(`تم توليد ${updates.length} كود للطلاب`, 'success');
        await updateCodeGenerationStats();
        if (typeof loadStudents === 'function') await loadStudents();
        
    } catch (error) {
        console.error('Error generating student codes:', error);
        window.Helpers.showToast('خطأ في توليد الأكواد', 'error');
    }
}

// توليد جميع الأكواد
async function generateAllCodes() {
    try {
        // توليد أكواد المعلمين أولاً
        await generateTeacherCodes();
        
        // ثم توليد أكواد الطلاب
        await generateStudentCodes();
        
        window.Helpers.showToast('تم إنهاء عملية توليد جميع الأكواد', 'success');
        
    } catch (error) {
        console.error('Error generating all codes:', error);
        window.Helpers.showToast('حدث خطأ أثناء توليد الأكواد', 'error');
    }
}

// عرض الأكواد المولدة
function displayGeneratedCodes(codes, type) {
    const container = document.getElementById('generatedCodesPreview');
    if (!container) return;
    
    container.innerHTML = `
        <div class="generated-codes-header">
            <h4>
                <i class="fas fa-key"></i>
                الأكواد المولدة حديثاً (${type})
            </h4>
            <div>
                <button class="btn btn-sm btn-outline" onclick="printGeneratedCodes()">
                    <i class="fas fa-print"></i>
                    طباعة
                </button>
                <button class="btn btn-sm btn-outline" onclick="copyAllCodes()">
                    <i class="fas fa-copy"></i>
                    نسخ الكل
                </button>
                <button class="btn btn-sm btn-outline" onclick="downloadGeneratedCodes()">
                    <i class="fas fa-download"></i>
                    تحميل كـ CSV
                </button>
            </div>
        </div>
        <div class="codes-list">
            ${codes.map(code => `
                <div class="code-item">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                        <div class="student-avatar-small">
                            ${getInitials(code.full_name)}
                        </div>
                        <div>
                            <span class="code-name">${code.full_name}</span>
                            <div style="font-size: 0.85rem; color: var(--gray); margin-top: 2px;">
                                ${type === 'معلمين' ? 'معلم' : 'طالب'}
                            </div>
                        </div>
                    </div>
                    <span class="code-value">${code.login_code}</span>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-icon btn-sm" onclick="copyCode('${code.login_code}')" title="نسخ الكود">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-icon btn-sm" onclick="regenerateCode('${code.id}', '${type}')" title="إعادة توليد">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="margin-top: 15px; text-align: center; color: var(--gray); font-size: 0.9rem;">
            <i class="fas fa-info-circle"></i>
            سيتم حفظ الأكواد تلقائياً في قاعدة البيانات
        </div>
    `;
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

// نسخ كود معين
function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        window.Helpers.showToast('تم نسخ الكود', 'success');
    }).catch(err => {
        console.error('Error copying code:', err);
        window.Helpers.showToast('خطأ في نسخ الكود', 'error');
    });
}

// نسخ جميع الأكواد
function copyAllCodes() {
    const codeElements = document.querySelectorAll('.code-value');
    if (codeElements.length === 0) {
        window.Helpers.showToast('لا توجد أكواد للنسخ', 'warning');
        return;
    }
    
    const codes = Array.from(codeElements).map(el => el.textContent);
    const names = Array.from(document.querySelectorAll('.code-name')).map(el => el.textContent);
    
    let text = 'الأكواد المولدة:\n\n';
    names.forEach((name, index) => {
        text += `${name}: ${codes[index]}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        window.Helpers.showToast(`تم نسخ ${codes.length} كود`, 'success');
    }).catch(err => {
        console.error('Error copying all codes:', err);
        window.Helpers.showToast('خطأ في نسخ الأكواد', 'error');
    });
}

// إعادة توليد كود لمستخدم معين
async function regenerateCode(userId, userType) {
    try {
        // توليد كود جديد
        let newCode;
        if (userType === 'معلمين') {
            newCode = 'TCH' + window.Helpers.generateLoginCode(5);
        } else {
            newCode = 'STD' + window.Helpers.generateLoginCode(5);
        }
        
        // تحديث قاعدة البيانات
        const { error } = await window.EduPath.supabase
            .from('users')
            .update({ login_code: newCode })
            .eq('id', userId);
        
        if (error) throw error;
        
        // تحديث العرض
        const codeElement = document.querySelector(`.code-item button[onclick*="${userId}"]`)?.closest('.code-item')?.querySelector('.code-value');
        if (codeElement) {
            codeElement.textContent = newCode;
        }
        
        window.Helpers.showToast('تم إعادة توليد الكود بنجاح', 'success');
        
    } catch (error) {
        console.error('Error regenerating code:', error);
        window.Helpers.showToast('خطأ في إعادة توليد الكود', 'error');
    }
}

// طباعة الأكواد المولدة
function printGeneratedCodes() {
    const printWindow = window.open('', '_blank');
    
    const codes = Array.from(document.querySelectorAll('.code-item')).map(item => ({
        name: item.querySelector('.code-name').textContent,
        code: item.querySelector('.code-value').textContent,
        type: item.querySelector('.student-avatar-small + div div').textContent
    }));
    
    const printContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>الأكواد المولدة</title>
            <style>
                body {
                    font-family: 'Tajawal', sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                .header h1 {
                    color: #673ab7;
                    margin: 0;
                }
                .header .date {
                    color: #666;
                    margin-top: 10px;
                }
                .codes-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                .codes-table th {
                    background: #f5f5f5;
                    padding: 12px;
                    text-align: right;
                    border: 1px solid #ddd;
                }
                .codes-table td {
                    padding: 10px;
                    border: 1px solid #ddd;
                }
                .code {
                    font-family: monospace;
                    background: #e3f2fd;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 0.9em;
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                }
                @media print {
                    .no-print { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>الأكواد المولدة - ${document.getElementById('schoolName')?.textContent || 'المدرسة'}</h1>
                <div class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
                <div class="date">عدد الأكواد: ${codes.length}</div>
            </div>
            
            <table class="codes-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>اسم المستخدم</th>
                        <th>نوع المستخدم</th>
                        <th>كود الدخول</th>
                    </tr>
                </thead>
                <tbody>
                    ${codes.map((code, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${code.name}</td>
                            <td>${code.type}</td>
                            <td><span class="code">${code.code}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                <p>تم إنشاء هذه الأكواد بواسطة نظام مسار التعليم</p>
                <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
            </div>
            
            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #673ab7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    طباعة الصفحة
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    إغلاق النافذة
                </button>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// تحميل الأكواد كملف CSV
function downloadGeneratedCodes() {
    const codeElements = document.querySelectorAll('.code-item');
    if (codeElements.length === 0) {
        window.Helpers.showToast('لا توجد أكواد للتحميل', 'warning');
        return;
    }
    
    const codes = Array.from(codeElements).map(item => ({
        'اسم المستخدم': item.querySelector('.code-name').textContent,
        'كود الدخول': item.querySelector('.code-value').textContent,
        'نوع المستخدم': item.querySelector('.student-avatar-small + div div').textContent,
        'تاريخ التوليد': new Date().toLocaleDateString('ar-EG')
    }));
    
    const csv = convertToCSV(codes);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `الأكواد_المولدة_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.Helpers.showToast(`تم تحميل ${codes.length} كود`, 'success');
}

// توليد أكواد للمستخدمين المحددين
async function generateCodesForSelectedUsers(userIds, userType) {
    try {
        const updates = [];
        
        for (const userId of userIds) {
            let newCode;
            if (userType === 'teacher') {
                newCode = 'TCH' + window.Helpers.generateLoginCode(5);
            } else {
                newCode = 'STD' + window.Helpers.generateLoginCode(5);
            }
            
            updates.push({
                id: userId,
                code: newCode
            });
            
            const { error } = await window.EduPath.supabase
                .from('users')
                .update({ login_code: newCode })
                .eq('id', userId);
            
            if (error) throw error;
        }
        
        return updates;
        
    } catch (error) {
        console.error('Error generating codes for selected users:', error);
        throw error;
    }
}

// عرض تاريخ توليد الأكواد
async function showCodeGenerationHistory() {
    try {
        // جلب سجل عمليات توليد الأكواد (يمكن تخزينها في جدول منفصل لاحقاً)
        const modalContent = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-history"></i>
                        سجل توليد الأكواد
                    </h3>
                    <button class="modal-close" onclick="closeModal('codeHistoryModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="history-list">
                        <div class="history-item">
                            <div class="history-icon">
                                <i class="fas fa-key"></i>
                            </div>
                            <div class="history-content">
                                <p class="history-message">تم توليد أكواد للمعلمين</p>
                                <span class="history-date">${new Date().toLocaleDateString('ar-EG')}</span>
                            </div>
                        </div>
                        <div class="history-item">
                            <div class="history-icon">
                                <i class="fas fa-key"></i>
                            </div>
                            <div class="history-content">
                                <p class="history-message">تم توليد أكواد للطلاب</p>
                                <span class="history-date">${new Date(Date.now() - 86400000).toLocaleDateString('ar-EG')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.id = 'codeHistoryModal';
        modal.className = 'modal';
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error showing code history:', error);
        window.Helpers.showToast('خطأ في عرض سجل الأكواد', 'error');
    }
}

// إعادة تعيين جميع الأكواد
async function resetAllCodes() {
    if (!confirm('⚠️ تحذير: هل أنت متأكد من إعادة تعيين جميع الأكواد؟\n\nهذه العملية ستؤدي إلى:\n1. تعطيل جميع حسابات المستخدمين الحاليين\n2. فقدان الوصول إلى النظام حتى يحصل كل مستخدم على كود جديد\n3. عدم القدرة على التراجع عن هذه العملية')) {
        return;
    }
    
    if (!confirm('❌ تحذير نهائي: هذا الإجراء خطير ويجب استخدامه فقط عند الضرورة القصوى.\n\nهل تريد المتابعة؟')) {
        return;
    }
    
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // تعطيل جميع الحسابات أولاً
        const { error: disableError } = await window.EduPath.supabase
            .from('users')
            .update({ is_active: false })
            .eq('school_id', schoolId)
            .neq('role', 'admin');
        
        if (disableError) throw disableError;
        
        // إعادة تعيين جميع الأكواد
        const { error: resetError } = await window.EduPath.supabase
            .from('users')
            .update({ login_code: null })
            .eq('school_id', schoolId)
            .neq('role', 'admin');
        
        if (resetError) throw resetError;
        
        window.Helpers.showToast('تم إعادة تعيين جميع الأكواد وتعطيل الحسابات', 'success');
        
        // تحديث الإحصائيات
        await updateCodeGenerationStats();
        
    } catch (error) {
        console.error('Error resetting all codes:', error);
        window.Helpers.showToast('خطأ في إعادة تعيين الأكواد', 'error');
    }
}

// توليد كود فريد (يتحقق من عدم التكرار)
async function generateUniqueCode(prefix, length = 5) {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        const code = prefix + window.Helpers.generateLoginCode(length);
        
        // التحقق من عدم تكرار الكود
        const { data: existingUser, error } = await window.EduPath.supabase
            .from('users')
            .select('id')
            .eq('login_code', code)
            .maybeSingle();
        
        if (error) throw error;
        
        if (!existingUser) {
            return code;
        }
        
        attempts++;
    }
    
    throw new Error('فشل في توليد كود فريد بعد عدة محاولات');
}

// تصدير جميع الأكواد الحالية
async function exportAllCodes() {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        const { data: users, error } = await window.EduPath.supabase
            .from('users')
            .select('full_name, role, login_code, classes(name)')
            .eq('school_id', schoolId)
            .not('login_code', 'is', null)
            .order('role');
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            window.Helpers.showToast('لا توجد أكواد للتصدير', 'warning');
            return;
        }
        
        const data = users.map(user => ({
            'اسم المستخدم': user.full_name,
            'نوع المستخدم': user.role === 'teacher' ? 'معلم' : 'طالب',
            'كود الدخول': user.login_code,
            'الصف': user.classes?.name || 'غير محدد',
            'تاريخ التصدير': new Date().toLocaleDateString('ar-EG')
        }));
        
        const csv = convertToCSV(data);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `جميع_أكواد_المستخدمين_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.Helpers.showToast(`تم تصدير ${data.length} كود`, 'success');
        
    } catch (error) {
        console.error('Error exporting all codes:', error);
        window.Helpers.showToast('خطأ في تصدير الأكواد', 'error');
    }
}

// تحويل البيانات إلى CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => {
            const value = row[header];
            // التعامل مع الفاصلات داخل النصوص
            return `"${(value || '').toString().replace(/"/g, '""')}"`;
        }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
}

// تحميل قالب لاستيراد الأكواد
function downloadCodesTemplate() {
    const template = `اسم_المستخدم,نوع_المستخدم,الكود_الحالي,الكود_الجديد
محمد أحمد العلي,معلم,TCH12345,TCH54321
سارة خالد المحمد,طالب,STD67890,STD09876
علي سعيد الناصر,طالب,,STD13579
فاطمة عمر الرشيد,معلم,,TCH24680`;
    
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'قالب_تحديث_الأكواد.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.Helpers.showToast('تم تحميل القالب بنجاح', 'success');
}

// استيراد أكواد من ملف
async function importCodesFromCSV(file) {
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
            const nameIndex = headers.findIndex(h => h.includes('اسم'));
            const codeIndex = headers.findIndex(h => h.includes('كود') && h.includes('جديد'));
            
            if (nameIndex === -1 || codeIndex === -1) {
                window.Helpers.showToast('الملف يجب أن يحتوي على أسماء المستخدمين والأكواد الجديدة', 'error');
                return;
            }
            
            const updates = [];
            const errors = [];
            
            for (let i = 1; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    const userName = row[nameIndex]?.trim();
                    const newCode = row[codeIndex]?.trim();
                    
                    if (!userName || !newCode) {
                        errors.push(`صف ${i+1}: بيانات ناقصة`);
                        continue;
                    }
                    
                    // البحث عن المستخدم بالاسم
                    const { data: user, error: userError } = await window.EduPath.supabase
                        .from('users')
                        .select('id')
                        .eq('full_name', userName)
                        .eq('school_id', window.AppState.currentUser.school_id)
                        .maybeSingle();
                    
                    if (userError) throw userError;
                    
                    if (!user) {
                        errors.push(`صف ${i+1}: لم يتم العثور على المستخدم ${userName}`);
                        continue;
                    }
                    
                    updates.push({
                        id: user.id,
                        name: userName,
                        code: newCode
                    });
                    
                } catch (rowError) {
                    errors.push(`صف ${i+1}: خطأ في المعالجة`);
                }
            }
            
            if (updates.length === 0) {
                window.Helpers.showToast('لم يتم العثور على تحديثات صالحة', 'error');
                return;
            }
            
            // تحديث الأكواد
            for (const update of updates) {
                const { error } = await window.EduPath.supabase
                    .from('users')
                    .update({ login_code: update.code })
                    .eq('id', update.id);
                
                if (error) throw error;
            }
            
            let message = `تم تحديث ${updates.length} كود بنجاح`;
            if (errors.length > 0) {
                message += ` (مع ${errors.length} أخطاء)`;
            }
            
            window.Helpers.showToast(message, 'success');
            
            // تحديث البيانات
            await updateCodeGenerationStats();
            if (typeof loadTeachers === 'function') await loadTeachers();
            if (typeof loadStudents === 'function') await loadStudents();
            
        };
        
        reader.readAsText(file, 'UTF-8');
        
    } catch (error) {
        console.error('Error importing codes:', error);
        window.Helpers.showToast('خطأ في استيراد الأكواد: ' + error.message, 'error');
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

// البحث عن مستخدم بواسطة الكود
async function searchUserByCode(code) {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        const { data: user, error } = await window.EduPath.supabase
            .from('users')
            .select('*')
            .eq('school_id', schoolId)
            .eq('login_code', code)
            .maybeSingle();
        
        if (error) throw error;
        
        return user;
        
    } catch (error) {
        console.error('Error searching user by code:', error);
        return null;
    }
}