/**
 * ملف إدارة الطلاب - لوحة تحكم المدير
 * الوظائف: تحميل الطلاب، إضافة طالب، حذف طالب، تصدير البيانات، الاستيراد من ملف
 */

// حالة الطلاب
const StudentsState = {
    allStudents: [],
    filteredStudents: [],
    selectedStudentIds: new Set(),
    currentFilter: {
        search: '',
        classId: ''
    }
};

// تهيئة وحدة الطلاب
async function initStudentsModule() {
    try {
        await loadAllStudents();
        setupStudentsEventListeners();
        updateClassFilter();
        console.log('✅ وحدة الطلاب جاهزة');
    } catch (error) {
        console.error('❌ خطأ في تهيئة وحدة الطلاب:', error);
    }
}

// تحميل جميع الطلاب
async function loadAllStudents() {
    try {
        const schoolId = window.AppState.currentUser?.school_id;
        if (!schoolId) {
            console.warn('⚠️ لا يوجد school_id');
            return;
        }

        // جلب الطلاب مع معلومات الصف
        const { data, error } = await window.EduPath.supabase
            .from('users')
            .select(`
                *,
                classes!left (
                    name,
                    academic_year_id
                )
            `)
            .eq('school_id', schoolId)
            .eq('role', 'student')
            .order('full_name');

        if (error) {
            console.error('❌ خطأ في جلب الطلاب:', error);
            window.Helpers.showToast('فشل تحميل الطلاب', 'error');
            return;
        }

        StudentsState.allStudents = data || [];
        StudentsState.filteredStudents = [...StudentsState.allStudents];
        
        // تحديث الواجهة
        displayStudentsTable();
        updateStudentsCount();
        updateCodeGenerationStats();

    } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
        window.Helpers.showToast('خطأ في تحميل الطلاب', 'error');
    }
}

// تحديث عدد الطلاب
function updateStudentsCount() {
    const totalCount = StudentsState.allStudents.length;
    const filteredCount = StudentsState.filteredStudents.length;
    
    // تحديث العداد في التبويب
    document.getElementById('studentsTabBadge').textContent = totalCount;
    
    // تحديث العداد في شريط التصفية
    const counterElement = document.querySelector('.students-count');
    if (!counterElement) {
        // إنشاء عنصر العداد إذا لم يكن موجوداً
        const filterBar = document.querySelector('.filter-bar');
        if (filterBar) {
            const counter = document.createElement('div');
            counter.className = 'students-count';
            counter.innerHTML = `<span class="badge badge-primary">${filteredCount}/${totalCount}</span>`;
            filterBar.appendChild(counter);
        }
    } else {
        counterElement.innerHTML = `<span class="badge badge-primary">${filteredCount}/${totalCount}</span>`;
    }
}

// عرض الطلاب في الجدول
function displayStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (StudentsState.filteredStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-user-graduate fa-2x" style="color: var(--gray); margin-bottom: 15px;"></i>
                        <p style="color: var(--gray); margin-bottom: 20px;">لا يوجد طلاب</p>
                        <button class="btn btn-primary" onclick="showAddStudentModal()">
                            <i class="fas fa-user-plus"></i>
                            إضافة أول طالب
                        </button>
                        <button class="btn btn-outline" onclick="showImportStudentsModal()" style="margin-right: 10px;">
                            <i class="fas fa-file-import"></i>
                            استيراد من ملف
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = StudentsState.filteredStudents.map(student => {
        const isSelected = StudentsState.selectedStudentIds.has(student.id);
        const classInfo = student.classes ? 
            `<span class="badge badge-outline">${student.classes.name}</span>` : 
            '<span class="text-muted">غير محدد</span>';
        
        const codeDisplay = student.login_code ? 
            `<span class="code-display">${student.login_code}</span>` : 
            `<span class="code-display no-code">لا يوجد كود</span>`;
        
        return `
            <tr data-student-id="${student.id}" class="${isSelected ? 'selected-row' : ''}">
                <td>
                    <div class="checkbox-wrapper">
                        <input type="checkbox" 
                               class="student-check" 
                               value="${student.id}"
                               ${isSelected ? 'checked' : ''}
                               onchange="toggleStudentSelection('${student.id}', this.checked)">
                    </div>
                </td>
                <td>
                    <div class="student-info-cell">
                        <div class="student-avatar-small">
                            ${getInitials(student.full_name)}
                        </div>
                        <div>
                            <strong>${student.full_name || 'بدون اسم'}</strong>
                            ${student.phone ? `<div class="text-muted small">${student.phone}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>${classInfo}</td>
                <td>${codeDisplay}</td>
                <td>
                    <div class="date-cell">
                        <span class="date-text">${window.Helpers.formatDate(student.created_at)}</span>
                        <span class="time-text">${window.Helpers.formatTime(student.created_at)}</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-sm btn-info" onclick="viewStudentDetails('${student.id}')" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-sm" onclick="editStudent('${student.id}')" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger" onclick="deleteStudentPrompt('${student.id}')" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// الحصول على الأحرف الأولى من الاسم
function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// تبديل اختيار طالب
function toggleStudentSelection(studentId, isSelected) {
    if (isSelected) {
        StudentsState.selectedStudentIds.add(studentId);
    } else {
        StudentsState.selectedStudentIds.delete(studentId);
    }
    
    // تحديث صفوف الجدول
    const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
    if (row) {
        row.classList.toggle('selected-row', isSelected);
    }
    
    // تحديث زر التحديد الكلي
    updateSelectAllCheckbox();
    updateBulkActions();
}

// تحديد/إلغاء تحديد جميع الطلاب
function toggleAllStudents() {
    const selectAll = document.getElementById('selectAllStudents').checked;
    const checkboxes = document.querySelectorAll('.student-check');
    
    StudentsState.selectedStudentIds.clear();
    
    if (selectAll) {
        StudentsState.filteredStudents.forEach(student => {
            StudentsState.selectedStudentIds.add(student.id);
        });
    }
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
    });
    
    displayStudentsTable();
    updateBulkActions();
}

// تحديث صندوق التحديد الكلي
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllStudents');
    if (!selectAllCheckbox) return;
    
    const total = StudentsState.filteredStudents.length;
    const selected = StudentsState.selectedStudentIds.size;
    
    selectAllCheckbox.checked = total > 0 && selected === total;
    selectAllCheckbox.indeterminate = selected > 0 && selected < total;
}

// تحديث أزرار الإجراءات الجماعية
function updateBulkActions() {
    const selectedCount = StudentsState.selectedStudentIds.size;
    const bulkActions = document.querySelector('.bulk-actions');
    
    if (!bulkActions) return;
    
    if (selectedCount > 0) {
        bulkActions.style.display = 'flex';
        bulkActions.querySelector('.selected-count').textContent = selectedCount;
    } else {
        bulkActions.style.display = 'none';
    }
}

// تصفية قائمة الطلاب
function filterStudentList() {
    const searchTerm = document.getElementById('studentListSearch').value.toLowerCase();
    const classFilter = document.getElementById('studentClassFilter').value;
    
    StudentsState.currentFilter.search = searchTerm;
    StudentsState.currentFilter.classId = classFilter;
    
    StudentsState.filteredStudents = StudentsState.allStudents.filter(student => {
        // تصفية حسب البحث
        const nameMatch = student.full_name?.toLowerCase().includes(searchTerm) || false;
        const phoneMatch = student.phone?.includes(searchTerm) || false;
        const codeMatch = student.login_code?.toLowerCase().includes(searchTerm) || false;
        
        // تصفية حسب الصف
        const classMatch = !classFilter || student.current_class_id === classFilter;
        
        return (nameMatch || phoneMatch || codeMatch) && classMatch;
    });
    
    displayStudentsTable();
    updateStudentsCount();
    updateSelectAllCheckbox();
}

// تحديث قائمة تصفية الصفوف
function updateClassFilter() {
    const classSelect = document.getElementById('studentClassFilter');
    if (!classSelect) return;
    
    // حفظ القيمة الحالية
    const currentValue = classSelect.value;
    
    // مسح الخيارات
    classSelect.innerHTML = '<option value="">جميع الصفوف</option>';
    
    // إضافة الصفوف الفريدة
    const uniqueClasses = new Map();
    StudentsState.allStudents.forEach(student => {
        if (student.classes && student.classes.name) {
            if (!uniqueClasses.has(student.current_class_id)) {
                uniqueClasses.set(student.current_class_id, student.classes.name);
            }
        }
    });
    
    uniqueClasses.forEach((className, classId) => {
        const option = document.createElement('option');
        option.value = classId;
        option.textContent = className;
        classSelect.appendChild(option);
    });
    
    // استعادة القيمة السابقة إذا كانت موجودة
    if (currentValue && uniqueClasses.has(currentValue)) {
        classSelect.value = currentValue;
    }
}

// تصدير بيانات الطلاب
async function exportStudentsData() {
    try {
        let studentsToExport = [];
        
        if (StudentsState.selectedStudentIds.size > 0) {
            // تصدير الطلاب المحددين فقط
            studentsToExport = StudentsState.allStudents.filter(student => 
                StudentsState.selectedStudentIds.has(student.id)
            );
        } else {
            // تصدير جميع الطلاب المرئيين
            studentsToExport = StudentsState.filteredStudents;
        }
        
        if (studentsToExport.length === 0) {
            window.Helpers.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }
        
        // تحويل البيانات إلى تنسيق CSV
        const csvData = studentsToExport.map(student => ({
            'اسم الطالب': student.full_name,
            'الصف': student.classes?.name || 'غير محدد',
            'كود الدخول': student.login_code || 'لا يوجد',
            'رقم الهاتف': student.phone || 'لا يوجد',
            'تاريخ الإضافة': window.Helpers.formatDate(student.created_at),
            'حالة الكود': student.login_code ? 'مفعل' : 'غير مفعل'
        }));
        
        const csv = convertToCSV(csvData);
        downloadCSV(csv, `طلاب_${new Date().toLocaleDateString('ar-EG')}.csv`);
        
        window.Helpers.showToast(`تم تصدير ${studentsToExport.length} طالب`, 'success');
        
    } catch (error) {
        console.error('❌ خطأ في تصدير البيانات:', error);
        window.Helpers.showToast('خطأ في تصدير البيانات', 'error');
    }
}

// توليد أكواد للطلاب المحددين
async function bulkGenerateStudentCodes() {
    const selectedCount = StudentsState.selectedStudentIds.size;
    
    if (selectedCount === 0) {
        window.Helpers.showToast('يرجى اختيار طلاب أولاً', 'warning');
        return;
    }
    
    if (!confirm(`هل تريد توليد أكواد للـ ${selectedCount} طالب المحددين؟`)) {
        return;
    }
    
    try {
        const codesGenerated = [];
        
        for (const studentId of StudentsState.selectedStudentIds) {
            const student = StudentsState.allStudents.find(s => s.id === studentId);
            if (!student) continue;
            
            // توليد كود جديد
            const newCode = 'STD' + window.Helpers.generateLoginCode(5);
            
            // تحديث في قاعدة البيانات
            const { error } = await window.EduPath.supabase
                .from('users')
                .update({ login_code: newCode })
                .eq('id', studentId);
            
            if (error) throw error;
            
            codesGenerated.push({
                name: student.full_name,
                code: newCode,
                oldCode: student.login_code
            });
            
            // تحديث البيانات المحلية
            student.login_code = newCode;
        }
        
        // عرض الأكواد المولدة
        displayGeneratedStudentCodes(codesGenerated);
        
        // تحديث الجدول
        displayStudentsTable();
        updateCodeGenerationStats();
        
        window.Helpers.showToast(`تم توليد ${codesGenerated.length} كود بنجاح`, 'success');
        
    } catch (error) {
        console.error('❌ خطأ في توليد الأكواد:', error);
        window.Helpers.showToast('خطأ في توليد الأكواد', 'error');
    }
}

// عرض الأكواد المولدة
function displayGeneratedStudentCodes(codes) {
    const modalContent = `
        <div class="modal-header">
            <h3><i class="fas fa-key"></i> الأكواد المولدة حديثاً</h3>
        </div>
        <div class="modal-body">
            <div class="codes-list">
                ${codes.map(item => `
                    <div class="code-item">
                        <div class="code-info">
                            <strong>${item.name}</strong>
                            <div class="code-details">
                                ${item.oldCode ? 
                                    `<span class="old-code">${item.oldCode}</span> → ` : 
                                    ''
                                }
                                <span class="new-code">${item.code}</span>
                            </div>
                        </div>
                        <button class="btn btn-icon btn-sm" onclick="copyCode('${item.code}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeCurrentModal()">إغلاق</button>
            <button class="btn btn-primary" onclick="copyAllCodes()">
                <i class="fas fa-copy"></i> نسخ جميع الأكواد
            </button>
        </div>
    `;
    
    window.Helpers.showCustomModal('الأكواد المولدة', modalContent);
}

// عرض تفاصيل الطالب
async function viewStudentDetails(studentId) {
    try {
        const student = StudentsState.allStudents.find(s => s.id === studentId);
        if (!student) {
            window.Helpers.showToast('الطالب غير موجود', 'error');
            return;
        }
        
        // جلب معلومات إضافية (إذا كانت موجودة)
        const { data: parentData, error } = await window.EduPath.supabase
            .from('users')
            .select('full_name, login_code, phone')
            .eq('login_code', student.parent_code)
            .maybeSingle();
        
        const modalContent = `
            <div class="student-details-modal">
                <div class="student-header">
                    <div class="student-avatar-large">
                        ${getInitials(student.full_name)}
                    </div>
                    <div class="student-title">
                        <h3>${student.full_name}</h3>
                        <span class="student-code">${student.login_code || 'لا يوجد كود'}</span>
                    </div>
                </div>
                
                <div class="details-grid">
                    <div class="detail-card">
                        <h4><i class="fas fa-chalkboard"></i> معلومات الصف</h4>
                        <p><strong>الصف:</strong> ${student.classes?.name || 'غير محدد'}</p>
                        ${student.classes?.academic_year_id ? 
                            `<p><strong>العام الدراسي:</strong> ${student.classes.academic_year_id}</p>` : ''}
                    </div>
                    
                    <div class="detail-card">
                        <h4><i class="fas fa-phone"></i> معلومات الاتصال</h4>
                        <p><strong>رقم الهاتف:</strong> ${student.phone || 'غير محدد'}</p>
                        <p><strong>تاريخ الإضافة:</strong> ${window.Helpers.formatDate(student.created_at)}</p>
                    </div>
                    
                    ${parentData ? `
                        <div class="detail-card">
                            <h4><i class="fas fa-user-friends"></i> ولي الأمر</h4>
                            <p><strong>الاسم:</strong> ${parentData.full_name}</p>
                            <p><strong>الكود:</strong> ${parentData.login_code}</p>
                            ${parentData.phone ? `<p><strong>الهاتف:</strong> ${parentData.phone}</p>` : ''}
                        </div>
                    ` : ''}
                </div>
                
                <div class="student-actions">
                    <button class="btn btn-outline" onclick="editStudent('${studentId}')">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-primary" onclick="generateStudentCodeSingle('${studentId}')">
                        <i class="fas fa-key"></i> توليد كود جديد
                    </button>
                </div>
            </div>
        `;
        
        window.Helpers.showCustomModal('تفاصيل الطالب', modalContent);
        
    } catch (error) {
        console.error('❌ خطأ في عرض التفاصيل:', error);
        window.Helpers.showToast('خطأ في تحميل التفاصيل', 'error');
    }
}

// تعديل طالب
async function editStudent(studentId) {
    try {
        const student = StudentsState.allStudents.find(s => s.id === studentId);
        if (!student) {
            window.Helpers.showToast('الطالب غير موجود', 'error');
            return;
        }
        
        // جلب قائمة الصفوف
        const { data: classes, error: classesError } = await window.EduPath.supabase
            .from('classes')
            .select('*')
            .eq('school_id', window.AppState.currentUser.school_id)
            .order('name');
        
        if (classesError) throw classesError;
        
        const modalContent = `
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> تعديل طالب</h3>
            </div>
            <div class="modal-body">
                <form id="editStudentForm" class="form">
                    <input type="hidden" id="editStudentId" value="${studentId}">
                    
                    <div class="input-group">
                        <label for="editStudentName"><i class="fas fa-user"></i> الاسم الكامل *</label>
                        <input type="text" id="editStudentName" class="input-field" 
                               value="${student.full_name || ''}" required>
                    </div>
                    
                    <div class="input-group">
                        <label for="editStudentClass"><i class="fas fa-chalkboard"></i> الصف</label>
                        <select id="editStudentClass" class="select-field">
                            <option value="">غير محدد</option>
                            ${classes.map(c => `
                                <option value="${c.id}" ${student.current_class_id === c.id ? 'selected' : ''}>
                                    ${c.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="input-group">
                        <label for="editStudentPhone"><i class="fas fa-phone"></i> رقم الهاتف</label>
                        <input type="tel" id="editStudentPhone" class="input-field" 
                               value="${student.phone || ''}">
                    </div>
                    
                    <div class="input-group">
                        <label for="editStudentCode"><i class="fas fa-key"></i> كود الدخول</label>
                        <div class="input-with-button">
                            <input type="text" id="editStudentCode" class="input-field" 
                                   value="${student.login_code || ''}">
                            <button type="button" class="btn btn-outline btn-sm" onclick="generateCodeForEdit()">
                                <i class="fas fa-sync-alt"></i> توليد
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeCurrentModal()">إلغاء</button>
                <button class="btn btn-primary" onclick="saveStudentEdit()">حفظ التعديلات</button>
            </div>
        `;
        
        window.Helpers.showCustomModal('تعديل طالب', modalContent);
        
    } catch (error) {
        console.error('❌ خطأ في تحميل نموذج التعديل:', error);
        window.Helpers.showToast('خطأ في تحميل بيانات التعديل', 'error');
    }
}

// حفظ تعديل الطالب
async function saveStudentEdit() {
    try {
        const studentId = document.getElementById('editStudentId').value;
        const fullName = document.getElementById('editStudentName').value.trim();
        const classId = document.getElementById('editStudentClass').value;
        const phone = document.getElementById('editStudentPhone').value.trim();
        const loginCode = document.getElementById('editStudentCode').value.trim();
        
        if (!fullName) {
            window.Helpers.showToast('يرجى إدخال الاسم الكامل', 'error');
            return;
        }
        
        const updateData = {
            full_name: fullName,
            current_class_id: classId || null,
            phone: phone || null,
            login_code: loginCode || null
        };
        
        const { error } = await window.EduPath.supabase
            .from('users')
            .update(updateData)
            .eq('id', studentId);
        
        if (error) throw error;
        
        // تحديث البيانات المحلية
        const studentIndex = StudentsState.allStudents.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            StudentsState.allStudents[studentIndex] = {
                ...StudentsState.allStudents[studentIndex],
                ...updateData
            };
        }
        
        // تحديث الواجهة
        displayStudentsTable();
        window.Helpers.showToast('تم تحديث بيانات الطالب بنجاح', 'success');
        window.Helpers.closeCurrentModal();
        
    } catch (error) {
        console.error('❌ خطأ في حفظ التعديلات:', error);
        window.Helpers.showToast('خطأ في حفظ التعديلات', 'error');
    }
}

// توليد كود للتعديل
function generateCodeForEdit() {
    const code = 'STD' + window.Helpers.generateLoginCode(5);
    document.getElementById('editStudentCode').value = code;
}

// توليد كود لطالب واحد
async function generateStudentCodeSingle(studentId) {
    try {
        const student = StudentsState.allStudents.find(s => s.id === studentId);
        if (!student) return;
        
        const newCode = 'STD' + window.Helpers.generateLoginCode(5);
        
        const { error } = await window.EduPath.supabase
            .from('users')
            .update({ login_code: newCode })
            .eq('id', studentId);
        
        if (error) throw error;
        
        // تحديث البيانات المحلية
        student.login_code = newCode;
        
        // تحديث الواجهة
        displayStudentsTable();
        updateCodeGenerationStats();
        
        window.Helpers.showToast(`تم توليد كود جديد: ${newCode}`, 'success');
        window.Helpers.closeCurrentModal();
        
    } catch (error) {
        console.error('❌ خطأ في توليد الكود:', error);
        window.Helpers.showToast('خطأ في توليد الكود', 'error');
    }
}

// طلب حذف طالب
function deleteStudentPrompt(studentId) {
    const student = StudentsState.allStudents.find(s => s.id === studentId);
    if (!student) return;
    
    const modalContent = `
        <div class="modal-header">
            <h3><i class="fas fa-exclamation-triangle text-danger"></i> تأكيد الحذف</h3>
        </div>
        <div class="modal-body">
            <div class="warning-message">
                <i class="fas fa-exclamation-circle fa-2x"></i>
                <h4>هل أنت متأكد من حذف هذا الطالب؟</h4>
                <p><strong>${student.full_name}</strong></p>
                <p class="text-muted">سيتم حذف جميع البيانات المرتبطة بهذه الحساب ولا يمكن استرجاعها.</p>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeCurrentModal()">إلغاء</button>
            <button class="btn btn-danger" onclick="deleteStudent('${studentId}')">
                <i class="fas fa-trash"></i> تأكيد الحذف
            </button>
        </div>
    `;
    
    window.Helpers.showCustomModal('تأكيد الحذف', modalContent);
}

// حذف طالب
async function deleteStudent(studentId) {
    try {
        const { error } = await window.EduPath.supabase
            .from('users')
            .delete()
            .eq('id', studentId);
        
        if (error) throw error;
        
        // حذف من البيانات المحلية
        StudentsState.allStudents = StudentsState.allStudents.filter(s => s.id !== studentId);
        StudentsState.filteredStudents = StudentsState.filteredStudents.filter(s => s.id !== studentId);
        StudentsState.selectedStudentIds.delete(studentId);
        
        // تحديث الواجهة
        displayStudentsTable();
        updateStudentsCount();
        updateClassFilter();
        updateBulkActions();
        
        window.Helpers.showToast('تم حذف الطالب بنجاح', 'success');
        window.Helpers.closeCurrentModal();
        
    } catch (error) {
        console.error('❌ خطأ في حذف الطالب:', error);
        window.Helpers.showToast('خطأ في حذف الطالب', 'error');
    }
}

// حذف الطلاب المحددين
async function deleteSelectedStudents() {
    const selectedCount = StudentsState.selectedStudentIds.size;
    
    if (selectedCount === 0) {
        window.Helpers.showToast('لم تختر أي طلاب', 'warning');
        return;
    }
    
    if (!confirm(`هل تريد حذف ${selectedCount} طالب؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        return;
    }
    
    try {
        const studentIds = Array.from(StudentsState.selectedStudentIds);
        
        // حذف جميع الطلاب المحددين
        const { error } = await window.EduPath.supabase
            .from('users')
            .delete()
            .in('id', studentIds);
        
        if (error) throw error;
        
        // تحديث البيانات المحلية
        StudentsState.allStudents = StudentsState.allStudents.filter(s => !studentIds.includes(s.id));
        StudentsState.filteredStudents = StudentsState.filteredStudents.filter(s => !studentIds.includes(s.id));
        StudentsState.selectedStudentIds.clear();
        
        // تحديث الواجهة
        displayStudentsTable();
        updateStudentsCount();
        updateClassFilter();
        updateBulkActions();
        
        window.Helpers.showToast(`تم حذف ${selectedCount} طالب`, 'success');
        
    } catch (error) {
        console.error('❌ خطأ في الحذف الجماعي:', error);
        window.Helpers.showToast('خطأ في حذف الطلاب', 'error');
    }
}

// تحديث إحصائيات توليد الأكواد
async function updateCodeGenerationStats() {
    try {
        const studentsWithoutCodes = StudentsState.allStudents.filter(s => !s.login_code).length;
        document.getElementById('studentsWithoutCodes').textContent = studentsWithoutCodes;
        
        // تحديث العدد الإجمالي
        const totalWithoutCodes = parseInt(document.getElementById('teachersWithoutCodes').textContent || '0') + studentsWithoutCodes;
        document.getElementById('totalWithoutCodes').textContent = totalWithoutCodes;
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإحصائيات:', error);
    }
}

// إعداد مستمعي الأحداث
function setupStudentsEventListeners() {
    // البحث المباشر
    const searchInput = document.getElementById('studentListSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterStudentList, 300));
    }
    
    // تصفية الصف
    const classFilter = document.getElementById('studentClassFilter');
    if (classFilter) {
        classFilter.addEventListener('change', filterStudentList);
    }
    
    // زر التحديد الكلي
    const selectAllCheckbox = document.getElementById('selectAllStudents');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', toggleAllStudents);
    }
}

// دالة Debounce للبحث
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// تحويل إلى CSV
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => {
            const value = row[header];
            // معالجة الفاصلات والاقتباسات
            if (value && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
        }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
}

// تنزيل CSV
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

// نسخ الكود
function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        window.Helpers.showToast('تم نسخ الكود', 'success');
    });
}

// نسخ جميع الأكواد
function copyAllCodes() {
    const codes = Array.from(document.querySelectorAll('.new-code')).map(el => el.textContent);
    const text = codes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        window.Helpers.showToast('تم نسخ جميع الأكواد', 'success');
    });
}

// تصدير الوظائف للاستخدام في ملف admin.html
window.StudentsModule = {
    init: initStudentsModule,
    loadAllStudents,
    filterStudentList,
    exportStudentsData,
    bulkGenerateStudentCodes,
    viewStudentDetails,
    editStudent,
    deleteStudentPrompt,
    toggleStudentSelection,
    toggleAllStudents,
    deleteSelectedStudents
};