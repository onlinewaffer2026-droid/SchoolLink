// admin/classes.js
// إدارة الصفوف وإضافتها

// تهيئة أحداث إضافة الصف
document.addEventListener('DOMContentLoaded', function() {
    // معالجة إضافة صف جديد
    const addClassForm = document.getElementById('addClassForm');
    if (addClassForm) {
        addClassForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const className = document.getElementById('newClassName').value.trim();
            const classSection = document.getElementById('newClassSection').value.trim();
            const classLevel = document.getElementById('newClassLevel').value;
            
            if (!className) {
                window.Helpers.showToast('يرجى إدخال اسم الصف', 'error');
                return;
            }
            
            // دمج الاسم: إذا كان هناك شعبة يصبح "الأول - أ"، إذا لم يوجد يبقى "الأول"
            const finalClassName = classSection ? `${className} - ${classSection}` : className;
            
            try {
                const schoolId = window.AppState.currentUser.school_id;
                const academicYearId = AdminState.activeYear?.id;
                
                if (!academicYearId) {
                    window.Helpers.showToast('يرجى تفعيل عام دراسي أولاً قبل إضافة الصفوف', 'warning');
                    return;
                }
                
                const { error } = await window.EduPath.supabase
                    .from('classes')
                    .insert([{
                        school_id: schoolId,
                        academic_year_id: academicYearId,
                        name: finalClassName
                        // يمكنك إضافة حقل level في قاعدة البيانات لاحقاً إذا أردت استخدامه
                    }]);
                
                if (error) throw error;
                
                window.Helpers.showToast(`تم إضافة ${finalClassName} بنجاح`, 'success');
                
                // إعادة تعيين النموذج
                this.reset();
                
                // تحديث البيانات في الواجهة
                await loadClasses(); // تحديث القوائم المنسدلة في النظام
                if (typeof loadClassesList === 'function') await loadClassesList(); // تحديث القائمة في المودال
                if (typeof loadStatistics === 'function') await loadStatistics(); // تحديث الأرقام في الرئيسية
                
            } catch (error) {
                console.error('Error adding class:', error);
                window.Helpers.showToast('خطأ في إضافة الصف: ' + error.message, 'error');
            }
        });
    }

    // إعداد أحداث تعديل وحذف الصفوف
    setupClassEvents();
});

// إعداد أحداث الصفوف
function setupClassEvents() {
    // سيتم استدعاؤها من عناصر HTML مباشرة
}

// تحميل قائمة الصفوف للمودال
async function loadClassesList() {
    try {
        const container = document.getElementById('classesList');
        if (!container) return;
        
        container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الصفوف...</div>';

        // التأكد من وجود بيانات في الـ AdminState
        if (!AdminState.classes || AdminState.classes.length === 0) {
            if (typeof loadClasses === 'function') await loadClasses();
        }

        if (!AdminState.classes || AdminState.classes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chalkboard"></i>
                    <p>لا توجد صفوف مضافة حالياً</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        AdminState.classes.forEach(cls => {
            const item = document.createElement('div');
            item.className = 'class-list-item';
            item.innerHTML = `
                <div class="class-info">
                    <i class="fas fa-chalkboard"></i>
                    <div>
                        <h4>${cls.name}</h4>
                        <span class="class-date">تم الإنشاء: ${window.Helpers.formatDate(cls.created_at)}</span>
                    </div>
                </div>
                <div class="class-actions">
                    <button class="btn btn-icon btn-sm" onclick="editClass('${cls.id}', '${cls.name}')" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-sm btn-danger" onclick="deleteClass('${cls.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading classes list:', error);
        window.Helpers.showToast('خطأ في تحميل قائمة الصفوف', 'error');
    }
}

// تعديل صف
async function editClass(classId, currentName) {
    const newName = prompt('أدخل الاسم الجديد للصف:', currentName);
    
    if (newName === null) return; // إلغاء العملية
    
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === currentName) return;

    try {
        const { error } = await window.EduPath.supabase
            .from('classes')
            .update({ name: trimmedName })
            .eq('id', classId);

        if (error) throw error;

        window.Helpers.showToast('تم تحديث اسم الصف بنجاح', 'success');
        
        // تحديث البيانات في الذاكرة والواجهة
        await loadClasses(); // تحديث المصفوفة العامة
        await loadClassesList(); // تحديث القائمة الحالية
        if (typeof updateClassSelects === 'function') updateClassSelects(); // تحديث الدروب داون
        
    } catch (error) {
        console.error('Error updating class:', error);
        window.Helpers.showToast('فشل التعديل: ' + error.message, 'error');
    }
}

// حذف صف
async function deleteClass(classId) {
    const confirmDelete = confirm('هل أنت متأكد من حذف هذا الصف؟ سيتم إزالة تبعية الطلاب لهذا الصف (لن يتم حذف الطلاب أنفسهم).');
    if (!confirmDelete) return;
    
    try {
        // 1. فك ارتباط الطلاب بالصف
        const { error: updateError } = await window.EduPath.supabase
            .from('users')
            .update({ current_class_id: null })
            .eq('current_class_id', classId);
        
        if (updateError) throw updateError;
        
        // 2. حذف الصف نهائياً
        const { error: deleteError } = await window.EduPath.supabase
            .from('classes')
            .delete()
            .eq('id', classId);
        
        if (deleteError) throw deleteError;
        
        window.Helpers.showToast('تم حذف الصف بنجاح', 'success');
        
        // 3. تحديث فوري لكل القوائم
        await loadClasses();
        await loadClassesList();
        if (typeof updateClassSelects === 'function') updateClassSelects();
        if (typeof loadStatistics === 'function') await loadStatistics();
        
    } catch (error) {
        console.error('Error deleting class:', error);
        window.Helpers.showToast('خطأ في عملية الحذف: ' + error.message, 'error');
    }
}

// تحديث قوائم الصفوف المنسدلة
function updateClassSelects() {
    const selects = [
        'sourceClass', 'targetClass', 'teacherClass', 'studentClass', 
        'studentClassFilter', 'broadcastClass'
    ];
    
    selects.forEach(id => {
        const selectElement = document.getElementById(id);
        if (!selectElement) return;
        
        const currentValue = selectElement.value;
        const isFilter = id.includes('Filter');
        
        // حفظ التنسيق الحالي
        let existingOptions = '';
        if (selectElement.innerHTML.includes('<option')) {
            existingOptions = selectElement.innerHTML;
        }
        
        selectElement.innerHTML = '';
        
        // إضافة الخيار الافتراضي
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = isFilter ? 'جميع الصفوف' : 'اختر الصف...';
        selectElement.appendChild(defaultOption);
        
        // إضافة الصفوف
        AdminState.classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.id;
            option.textContent = cls.name;
            selectElement.appendChild(option);
        });
        
        // استعادة القيمة السابقة إذا كانت موجودة
        if (currentValue && AdminState.classes.some(c => c.id === currentValue)) {
            selectElement.value = currentValue;
        }
    });
}

// تصفية الصفوف حسب السنة الدراسية
async function filterClassesByAcademicYear(academicYearId) {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        const { data: classes, error } = await window.EduPath.supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId)
            .eq('academic_year_id', academicYearId)
            .order('name');
        
        if (error) throw error;
        
        return classes || [];
        
    } catch (error) {
        console.error('Error filtering classes by academic year:', error);
        return [];
    }
}

// توليد هيكل صفوف جديد لعام دراسي
async function generateClassStructureForNewYear(academicYearId) {
    try {
        const schoolId = window.AppState.currentUser.school_id;
        
        // هيكل الصفوف القياسي
        const standardClasses = [
            { name: 'الصف الأول', level: 'ابتدائي' },
            { name: 'الصف الثاني', level: 'ابتدائي' },
            { name: 'الصف الثالث', level: 'ابتدائي' },
            { name: 'الصف الرابع', level: 'ابتدائي' },
            { name: 'الصف الخامس', level: 'ابتدائي' },
            { name: 'الصف السادس', level: 'متوسط' },
            { name: 'الصف السابع', level: 'متوسط' },
            { name: 'الصف الثامن', level: 'متوسط' },
            { name: 'الصف التاسع', level: 'متوسط' },
            { name: 'الصف العاشر', level: 'ثانوي' },
            { name: 'الصف الحادي عشر', level: 'ثانوي' },
            { name: 'الصف الثاني عشر', level: 'ثانوي' }
        ];
        
        const classData = standardClasses.map(cls => ({
            school_id: schoolId,
            academic_year_id: academicYearId,
            name: cls.name
        }));
        
        const { error } = await window.EduPath.supabase
            .from('classes')
            .insert(classData);
        
        if (error) throw error;
        
        window.Helpers.showToast(`تم إنشاء ${classData.length} صف للعام الدراسي الجديد`, 'success');
        
        // تحديث قائمة الصفوف
        await loadClasses();
        
        return classData.length;
        
    } catch (error) {
        console.error('Error generating class structure:', error);
        window.Helpers.showToast('خطأ في إنشاء هيكل الصفوف', 'error');
        return 0;
    }
}

// إحصائيات الصفوف
function getClassStatistics() {
    if (!AdminState.classes || AdminState.classes.length === 0) {
        return {
            total: 0,
            byLevel: {},
            emptyClasses: 0,
            mostPopulated: null
        };
    }
    
    const stats = {
        total: AdminState.classes.length,
        byLevel: {},
        emptyClasses: 0,
        mostPopulated: { name: '', count: 0 }
    };
    
    // تحليل الصفوف حسب المرحلة (إذا كان هناك حقل level)
    AdminState.classes.forEach(cls => {
        // يمكنك إضافة منطق لتحليل المراحل إذا أضفتها لاحقاً
    });
    
    return stats;
}

// استيراد صفوف من ملف
async function importClassesFromCSV(file) {
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const csvContent = e.target.result;
            const rows = csvContent.split('\n').map(row => row.trim()).filter(row => row);
            
            if (rows.length < 2) {
                window.Helpers.showToast('الملف فارغ أو لا يحتوي على بيانات', 'error');
                return;
            }
            
            const headers = rows[0].split(',').map(h => h.trim());
            const nameIndex = headers.findIndex(h => h.includes('اسم') || h.includes('name'));
            
            if (nameIndex === -1) {
                window.Helpers.showToast('الملف يجب أن يحتوي على عمود للأسماء', 'error');
                return;
            }
            
            const schoolId = window.AppState.currentUser.school_id;
            const academicYearId = AdminState.activeYear?.id;
            
            if (!academicYearId) {
                window.Helpers.showToast('يرجى تفعيل عام دراسي أولاً', 'error');
                return;
            }
            
            const classData = [];
            
            for (let i = 1; i < rows.length; i++) {
                const columns = rows[i].split(',').map(col => col.trim());
                const className = columns[nameIndex];
                
                if (className) {
                    classData.push({
                        school_id: schoolId,
                        academic_year_id: academicYearId,
                        name: className
                    });
                }
            }
            
            if (classData.length === 0) {
                window.Helpers.showToast('لم يتم العثور على أسماء صفوف صالحة', 'error');
                return;
            }
            
            const { error } = await window.EduPath.supabase
                .from('classes')
                .insert(classData);
            
            if (error) throw error;
            
            window.Helpers.showToast(`تم استيراد ${classData.length} صف بنجاح`, 'success');
            
            // تحديث البيانات
            await loadClasses();
            if (typeof loadStatistics === 'function') await loadStatistics();
            
        };
        
        reader.readAsText(file, 'UTF-8');
        
    } catch (error) {
        console.error('Error importing classes:', error);
        window.Helpers.showToast('خطأ في استيراد الصفوف: ' + error.message, 'error');
    }
}

// تصدير بيانات الصفوف
function exportClassesData() {
    try {
        const data = AdminState.classes.map(cls => ({
            'اسم الصف': cls.name,
            'تاريخ الإنشاء': window.Helpers.formatDate(cls.created_at),
            'السنة الدراسية': AdminState.activeYear?.name || 'غير محدد'
        }));
        
        if (data.length === 0) {
            window.Helpers.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }
        
        const csv = convertToCSV(data);
        downloadCSV(csv, 'الصفوف.csv');
        window.Helpers.showToast('تم تصدير بيانات الصفوف بنجاح', 'success');
        
    } catch (error) {
        console.error('Error exporting classes data:', error);
        window.Helpers.showToast('خطأ في تصدير البيانات', 'error');
    }
}

// دعم تحويل البيانات إلى CSV (مشتركة مع ملفات أخرى)
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

// دعم تنزيل ملف CSV (مشتركة مع ملفات أخرى)
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

// تحميل تفاصيل الصف
async function loadClassDetails(classId) {
    try {
        const { data: classData, error } = await window.EduPath.supabase
            .from('classes')
            .select('*')
            .eq('id', classId)
            .single();
        
        if (error) throw error;
        
        return classData;
        
    } catch (error) {
        console.error('Error loading class details:', error);
        return null;
    }
}

// تحديث معلومات الصف
async function updateClass(classId, updateData) {
    try {
        const { error } = await window.EduPath.supabase
            .from('classes')
            .update(updateData)
            .eq('id', classId);
        
        if (error) throw error;
        
        window.Helpers.showToast('تم تحديث معلومات الصف بنجاح', 'success');
        
        // تحديث البيانات
        await loadClasses();
        if (typeof loadClassesList === 'function') await loadClassesList();
        
        return true;
        
    } catch (error) {
        console.error('Error updating class:', error);
        window.Helpers.showToast('خطأ في تحديث الصف: ' + error.message, 'error');
        return false;
    }
}

// البحث عن صفوف
function searchClasses(searchTerm) {
    if (!searchTerm) {
        return AdminState.classes;
    }
    
    const term = searchTerm.toLowerCase();
    return AdminState.classes.filter(cls => 
        cls.name.toLowerCase().includes(term)
    );
}

// تصدير قالب لاستيراد الصفوف
function exportClassTemplate() {
    const template = `اسم_الصف,الشعبة,المستوى,المرحلة
الصف الأول,أ,ابتدائي,المرحلة الابتدائية
الصف الأول,ب,ابتدائي,المرحلة الابتدائية
الصف الثاني,أ,ابتدائي,المرحلة الابتدائية
الصف الثاني,ب,ابتدائي,المرحلة الابتدائية
الصف الثالث,أ,ابتدائي,المرحلة الابتدائية`;
    
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'قالب_الصفوف.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.Helpers.showToast('تم تحميل القالب بنجاح', 'success');
}




// استبدل الدالة الموجودة أو أضفها إذا لم تكن موجودة
function manageClasses() {
    console.log("تم الضغط على زر الإدارة"); // للتأكد في وحدة التحكم
    
    const modal = document.getElementById('classesModal');
    if (!modal) {
        console.error("لم يتم العثور على عنصر باسم classesModal");
        return;
    }

    // إظهار النافذة يدوياً لضمان العمل
    modal.style.display = 'block';
    modal.classList.add('show'); 

    // التأكد من تشغيل التبويب الأول
    switchClassTab('list');
}



function switchClassTab(tabName) {
    const listTab = document.getElementById('classListTab');
    const addTab = document.getElementById('addClassTab');
    const tabs = document.querySelectorAll('.modal-tab');

    // إزالة الحالة النشطة من الجميع
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tabName === 'list') {
        listTab.style.display = 'block';
        addTab.style.display = 'none';
        tabs[0].classList.add('active');
        loadClassesList(); // تحميل البيانات عند العودة للقائمة
    } else {
        addTab.style.display = 'block';
        listTab.style.display = 'none';
        tabs[1].classList.add('active');
    }
}