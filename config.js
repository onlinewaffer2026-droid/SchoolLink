// config.js - المحرك المركزي لنظام EduPath
// ============================================

// 1. تهيئة Supabase Client
// ========================
const SUPABASE_URL = 'https://qloublzrupdzrszbiknj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsb3VibHpydXBkenJzemJpa25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzA5MjMsImV4cCI6MjA4NTAwNjkyM30.EqO5jbY3k2y8DSV66J08qeIpGbmg-di4w_JNc2dvNsU';

// إنشاء العميل Supabase مع تفعيل Realtime
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    },
    auth: {
        persistSession: false
    }
});

// 2. الحالة العالمية للتطبيق (Global State)
// ========================================
window.AppState = {
    // بيانات المستخدم الحالي
    currentUser: null,
    
    // السنة الدراسية النشطة
    activeAcademicYear: null,
    
    // قائمة الإشعارات
    notifications: [],
    
    // رسائل المحادثة
    messages: [],
    
    // بيانات المدرسة الحالية
    schoolData: null,
    
    // قائمة الصفوف
    classes: [],
    
    // المحتوى التعليمي
    contentFeed: [],
    
    // تهيئة الحالة من localStorage
    initialize: function() {
        const storedUser = localStorage.getItem('eduPath_user');
        const storedYear = localStorage.getItem('eduPath_activeYear');
        
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
        }
        
        if (storedYear) {
            this.activeAcademicYear = JSON.parse(storedYear);
        }
        
        console.log('AppState initialized:', this.currentUser);
    },
    
    // تحديث بيانات المستخدم
    setUser: function(userData) {
        this.currentUser = userData;
        localStorage.setItem('eduPath_user', JSON.stringify(userData));
    },
    
    // تحديث السنة الدراسية النشطة
    setActiveYear: function(yearData) {
        this.activeAcademicYear = yearData;
        localStorage.setItem('eduPath_activeYear', JSON.stringify(yearData));
    },
    
    // إضافة إشعار جديد
    addNotification: function(notification) {
        this.notifications.unshift(notification);
        this.updateNotificationBadge();
    },
    
    // تحديث عداد الإشعارات
    updateNotificationBadge: function() {
        const unreadCount = this.notifications.filter(n => !n.is_read).length;
        const badgeElements = document.querySelectorAll('.notification-badge');
        
        badgeElements.forEach(badge => {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        });
    },
    
    // إضافة رسالة جديدة
    addMessage: function(message) {
        this.messages.push(message);
    },
    
    // تحديث قائمة الصفوف
    setClasses: function(classesList) {
        this.classes = classesList;
    },
    
    // تحديث المحتوى التعليمي
    setContentFeed: function(contentList) {
        this.contentFeed = contentList.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
    }
};

// 3. دوال المساعدة (Helper Functions)
// ===================================
window.Helpers = {
    // إظهار تنبيه
    showToast: function(message, type = 'info') {
        const container = document.querySelector('.toast-container') || (() => {
            const div = document.createElement('div');
            div.className = 'toast-container';
            document.body.appendChild(div);
            return div;
        })();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;margin-left:auto;">×</button>
        `;
        
        container.appendChild(toast);
        
        // إزالة التلقائي بعد 5 ثوان
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    },
    
    // تحميل ملف إلى Supabase Storage
    uploadFile: async function(file, bucket = 'eduPathFiles') {
        try {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            
            // ملاحظة: تأكد من أن متغير supabase يشير إلى supabaseClient
            const { data, error } = await supabaseClient.storage
                .from(bucket)
                .upload(fileName, file);
            
            if (error) throw error;
            
            // الحصول على رابط عام
            const { data: { publicUrl } } = supabaseClient.storage
                .from(bucket)
                .getPublicUrl(fileName);
            
            return {
                success: true,
                url: publicUrl,
                fileName: fileName
            };
        } catch (error) {
            this.showToast(`خطأ في رفع الملف: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // توليد كود دخول عشوائي
    generateLoginCode: function(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },
    
    // تنسيق التاريخ
    formatDate: function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // التوجيه بناءً على دور المستخدم
    // في قسم Helpers، دالة redirectBasedOnRole
redirectBasedOnRole: function(user) {
    switch (user.role) {
        case 'super':
            window.location.href = 'super/index.html';
            break;
        case 'admin':
            window.location.href = 'admin/index.html';
            break;
        case 'teacher':
            window.location.href = 'teacher/index.html';
            break;
        case 'student':
            window.location.href = 'parent-student/index.html';
            break;
        default:
            window.location.href = 'index.html';
    }
},
    
    // إرسال إشعار
    sendNotification: async function(userId, message) {
        try {
            const { data, error } = await supabaseClient
                .from('notifications')
                .insert([{
                    user_id: userId,
                    message: message,
                    is_read: false
                }]);
            
            if (error) throw error;
            
            // تحديث Realtime
            supabaseClient.channel('notifications')
                .send({
                    type: 'broadcast',
                    event: 'new_notification',
                    payload: { userId, message }
                });
            
            return { success: true };
        } catch (error) {
            console.error('Error sending notification:', error);
            return { success: false, error };
        }
    },
    
    // الدخول باستخدام الكود
    loginWithCode: async function(code) {
        try {
            const { data, error } = await supabaseClient
                .rpc('login_user', { input_code: code });
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                const userData = data[0];
                window.AppState.setUser(userData);
                
                if (userData.academic_year_id) {
                    window.AppState.setActiveYear({
                        id: userData.academic_year_id,
                        name: userData.academic_year_name,
                        is_active: userData.academic_year_active
                    });
                }
                
                this.showToast(`مرحباً ${userData.full_name}!`, 'success');
                return userData;
            } else {
                this.showToast('كود الدخول غير صحيح', 'error');
                return null;
            }
        } catch (error) {
            this.showToast(`خطأ في الدخول: ${error.message}`, 'error');
            return null;
        }
    },
    
    // جلب الإشعارات
    fetchNotifications: async function() {
        if (!window.AppState.currentUser) return [];
        
        try {
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', window.AppState.currentUser.user_id)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            window.AppState.notifications = data;
            window.AppState.updateNotificationBadge();
            
            return data;
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    },
    
    // تسجيل الخروج
    logout: function() {
        window.AppState.currentUser = null;
        window.AppState.activeAcademicYear = null;
        localStorage.removeItem('eduPath_user');
        localStorage.removeItem('eduPath_activeYear');
        window.location.href = 'index.html';
    }
};

// 4. تهيئة التطبيق
// =================
document.addEventListener('DOMContentLoaded', function() {
    
    // تهيئة حالة التطبيق
    window.AppState.initialize();
    
    // إضافة مؤشر Realtime
    const indicator = document.createElement('div');
    indicator.className = 'realtime-indicator';
    indicator.title = 'متصل بخدمة التحديث الفوري';
    document.body.appendChild(indicator);
    
    // الاشتراك في التحديثات الفورية
    if (window.AppState.currentUser) {
        // الاشتراك في الإشعارات
        const notificationsChannel = supabaseClient.channel('notifications')
            .on('broadcast', { event: 'new_notification' }, payload => {
                if (payload.userId === window.AppState.currentUser.user_id) {
                    window.AppState.addNotification({
                        message: payload.message,
                        is_read: false,
                        created_at: new Date().toISOString()
                    });
                    window.Helpers.showToast('إشعار جديد', 'info');
                }
            })
            .subscribe();
        
        // الاشتراك في الرسائل
        const messagesChannel = supabaseClient.channel('messages')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `receiver_id=eq.${window.AppState.currentUser.user_id}`
                }, 
                payload => {
                    window.AppState.addMessage(payload.new);
                    window.Helpers.showToast('رسالة جديدة', 'info');
                }
            )
            .subscribe();
    }
    
    console.log('EduPath System Initialized');
});

// 5. تصدير الكائنات للاستخدام العام
// ==================================
window.EduPath = {
    supabase: supabaseClient,
    AppState: window.AppState,
    Helpers: window.Helpers
};


// 6. دوال خاصة بالمدير (Admin)
window.AdminHelpers = {
    // جلب عدد المستخدمين بدقة
    getUserCount: async function(role) {
        try {
            const { count, error } = await window.EduPath.supabase
                .from('users')
                .select('*', { count: 'exact' })
                .eq('school_id', window.AppState.currentUser.school_id)
                .eq('role', role);
            
            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error(`Error getting ${role} count:`, error);
            return 0;
        }
    },
    
    // جلب الصفوف مع التعامل مع الأخطاء
    getClasses: async function() {
        try {
            const { data, error } = await window.EduPath.supabase
                .from('classes')
                .select('*')
                .eq('school_id', window.AppState.currentUser.school_id)
                .order('name');
            
            if (error) {
                console.error('Error fetching classes:', error);
                // محاولة بديلة
                const { data: altData, error: altError } = await window.EduPath.supabase
                    .from('classes')
                    .select('*')
                    .order('name');
                
                if (altError) throw altError;
                return altData || [];
            }
            
            return data || [];
        } catch (error) {
            console.error('Final error fetching classes:', error);
            return [];
        }
    }
};
