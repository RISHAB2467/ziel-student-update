import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    initializeFirestore,
    connectFirestoreEmulator,
    collection, 
    addDoc, 
    getDocs, 
    doc,
    getDoc,
    setDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    onSnapshot,
    orderBy,
    Timestamp,
    serverTimestamp,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyALyA_Yod2TKWonP_oSFehR6-tKq9xDC3I",
    authDomain: "ziel-d0064.firebaseapp.com",
    projectId: "ziel-d0064",
    storageBucket: "ziel-d0064.firebasestorage.app",
    messagingSenderId: "249203765928",
    appId: "1:249203765928:web:391650d800d197d902c89d"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
});

const auth = getAuth(app);
const functions = getFunctions(app);

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

async function ensureAuthReady() {
    // This app intentionally uses localStorage-based role login, not Firebase Auth login.
    return;
}

const VAPID_KEY = 'BNztvlb9Gjr0qGVEP21EwmBPEv3e4BP0HsfMMGqeOORTaoPIotw7RzySfd6WQ6qdL-loZga8zKFdGRf6sDPTL7o';
const APP_FIRESTORE_VERSION = '164';
window.__APP_FIRESTORE_VERSION = APP_FIRESTORE_VERSION;

let messaging = null;
let messagingRegistration = null;
try {
    messaging = getMessaging(app);
} catch (error) {
    console.warn('Firebase Messaging unavailable in this browser context.', error);
}

async function showAppNotification(title, options = {}) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
        return false;
    }

    const payload = {
        icon: '/icon-192.png',
        ...options
    };

    try {
        const registration = messagingRegistration || await navigator.serviceWorker.ready;
        await registration.showNotification(title, payload);
        return true;
    } catch (error) {
        console.error('Service worker notification failed:', error);
        return false;
    }
}

// ========== PWA & NOTIFICATION INITIALIZATION ==========

async function initializeAppFeatures() {
    if (!('serviceWorker' in navigator)) return;

    try {
        // In a PWA, only one worker controls a scope. Remove legacy sw.js workers
        // so messaging background notifications are handled by firebase-messaging-sw.js.
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
            const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
            if (scriptUrl.includes('/sw.js') && !scriptUrl.includes('/firebase-messaging-sw.js')) {
                await reg.unregister();
            }
        }

        messagingRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await messagingRegistration.update();
        console.log('Messaging Service Worker registered with scope:', messagingRegistration.scope);
    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }
}

window.setupNotifications = async function() {
    if (!('Notification' in window)) {
        alert('This browser does not support notifications. Please use Chrome or Edge.');
        return;
    }

    if (!window.isSecureContext) {
        alert('Notifications require HTTPS. Please open the live HTTPS site to enable alerts.');
        return;
    }

    if (!('serviceWorker' in navigator)) {
        alert('Service Worker is not supported in this browser, so notifications cannot be enabled.');
        return;
    }

    if (!messaging) {
        alert('Notification service failed to initialize. Please refresh the page and try again.');
        return;
    }

    try {
        if (Notification.permission === 'denied') {
            alert('Notification permission is blocked in browser settings. Allow notifications for this site, then try again.');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('Notifications are blocked. Please allow them in browser settings.');
            return;
        }

        // Always use the active service worker registration for mobile browser compatibility.
        const registration = await navigator.serviceWorker.ready;
        messagingRegistration = registration;

        const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY
        });

        if (!token) {
            alert('Could not get notification token. Please try again after refreshing.');
            return;
        }

        const teacherId = localStorage.getItem('teacherId');
        const role = localStorage.getItem('role');

        if (role === 'teacher' && teacherId) {
            await updateDoc(doc(db, 'teachers', teacherId), {
                deviceToken: token,
                notificationsEnabled: true,
                lastTokenUpdate: serverTimestamp()
            });
            console.log('Device Token saved to Firestore');
            alert('Notifications enabled for ZIEL Classes!');
            return;
        }

        alert('Notifications enabled, but no teacher session found. Please login as teacher and enable again.');
    } catch (error) {
        console.error('Notification Setup Failed:', error);
        alert(`Notification setup failed (v${APP_FIRESTORE_VERSION}): ${error?.message || 'Unknown error'}`);
    }
};

async function syncNotificationTokenSilently() {
    if (typeof window === 'undefined' || !window.isSecureContext) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    if (!messaging) return;

    const role = localStorage.getItem('role');
    const teacherId = localStorage.getItem('teacherId');
    if (role !== 'teacher' || !teacherId) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        messagingRegistration = registration;

        const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY,
        });

        if (!token) return;

        await updateDoc(doc(db, 'teachers', teacherId), {
            deviceToken: token,
            notificationsEnabled: true,
            lastTokenUpdate: serverTimestamp(),
        });
    } catch (error) {
        console.warn('Silent notification token sync failed:', error);
    }
}

if (messaging) {
    onMessage(messaging, async (payload) => {
        console.log('Message received in foreground:', payload);
        const title = payload?.notification?.title || 'ZIEL Classes Alert';
        const body = payload?.notification?.body || 'Please check your dashboard.';

        await showAppNotification(title, { body });

        alert(`${title}\n${body}`);
    });
}

// Helper function to format date as DD/MM/YYYY
function formatDateDDMMYYYY(date) {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Helper function to format date and time as DD/MM/YYYY HH:MM:SS
function formatDateTimeDDMMYYYY(date) {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    return `${dateStr} ${timeStr}`;
}

// Initialize EmailJS for OTP
if (typeof emailjs !== 'undefined') {
    emailjs.init('oqWO-o2NpfVa4GXt9');
}

// OTP Storage
let adminOTP = null;
let otpTimestamp = null;
let isOTPSending = false; // Prevent duplicate sends
const OTP_VALIDITY = 5 * 60 * 1000; // 5 minutes
let reminderUnsubscribe = null;
let accountabilityTrackerUnsubscribe = null;
let bulkUnlockInProgress = false;

// Get Kolkata date in YYYY-MM-DD format regardless of device timezone
function getKolkataDateISO() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function getKolkataDateWithOffsetISO(dayOffset = 0) {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kolkataMs = utcMs + (5.5 * 60 * 60 * 1000) + (dayOffset * 24 * 60 * 60 * 1000);
    const kolkataDate = new Date(kolkataMs);
    return `${kolkataDate.getFullYear()}-${String(kolkataDate.getMonth() + 1).padStart(2, '0')}-${String(kolkataDate.getDate()).padStart(2, '0')}`;
}

function getKolkataTimeParts() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());

    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return { hour, minute };
}

function formatKolkataReadableDate() {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date());
}

async function getSubmittedTeacherKeysForDate(targetDate) {
    const snapshot = await getDocs(query(collection(db, 'entries'), where('date', '==', targetDate)));
    const submittedKeys = new Set();

    snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.teacherId) {
            submittedKeys.add(`id:${String(data.teacherId)}`);
        }
        if (data.teacherName) {
            submittedKeys.add(`name:${String(data.teacherName).trim().toLowerCase()}`);
        }
    });

    return submittedKeys;
}

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via EmailJS
async function sendOTPEmail(otp, adminEmail) {
    if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS not loaded');
    }
    
    // Prevent duplicate sends
    if (isOTPSending) {
        return true;
    }
    
    isOTPSending = true;
    
    const templateParams = {
        to_email: adminEmail,
        otp_code: otp,
        timestamp: formatDateTimeDDMMYYYY(new Date())
    };
    
    try {
        await emailjs.send(
            'service_ki00r4y',
            'template_96gaehq',
            templateParams
        );
        isOTPSending = false;
        return true;
    } catch (error) {
        console.error('Failed to send OTP:', error);
        isOTPSending = false;
        throw error;
    }
}

// Verify OTP
function verifyOTP(enteredOTP) {
    if (!adminOTP || !otpTimestamp) {
        return { valid: false, message: 'No OTP generated. Please try again.' };
    }
    
    const currentTime = Date.now();
    const elapsed = currentTime - otpTimestamp;
    
    if (elapsed > OTP_VALIDITY) {
        adminOTP = null;
        otpTimestamp = null;
        return { valid: false, message: 'OTP expired. Please request a new one.' };
    }
    
    if (enteredOTP === adminOTP) {
        adminOTP = null;
        otpTimestamp = null;
        return { valid: true, message: 'OTP verified successfully!' };
    }
    
    return { valid: false, message: 'Incorrect OTP. Please try again.' };
}

// ========== ACCOUNTABILITY FUNCTIONS ==========

// 1) Teacher reminders for pending daily submissions.
window.runReminderEngine = function() {
    const teacherId = localStorage.getItem('teacherId');
    const reminderOverlay = document.getElementById('statusOverlay');
    if (!teacherId || !reminderOverlay) return;

    const attachReminderListener = async () => {
        await ensureAuthReady();
        reminderUnsubscribe = onSnapshot(doc(db, 'teachers', teacherId), async (docSnap) => {
            const data = docSnap.data() || {};
            const { hour } = getKolkataTimeParts();
            const todayKolkata = getKolkataDateISO();
            const dueDate = hour === 0 ? getKolkataDateWithOffsetISO(-1) : todayKolkata;
            const submittedDueDateKeys = await getSubmittedTeacherKeysForDate(dueDate);
            const teacherKey = `id:${teacherId}`;
            const teacherNameKey = data.name ? `name:${String(data.name).trim().toLowerCase()}` : null;
            const submittedDueDate = submittedDueDateKeys.has(teacherKey) || (teacherNameKey ? submittedDueDateKeys.has(teacherNameKey) : false);
            const isReminderWindow = hour >= 22 && hour <= 23;
            const isPostMidnight = hour === 0;
            const pendingAtDeadline = !submittedDueDate && !data.isOnLeave;

            if (data.isLocked) {
                reminderOverlay.style.display = 'none';

                if (!window.__teacherForcedLockoutInProgress) {
                    window.__teacherForcedLockoutInProgress = true;

                    alert('🚫 ACCESS DENIED\n\nYour account is locked. Please contact admin.');

                    try {
                        if (typeof reminderUnsubscribe === 'function') {
                            reminderUnsubscribe();
                            reminderUnsubscribe = null;
                        }
                    } catch (unsubscribeError) {
                        console.error('Failed to detach reminder listener during forced lockout:', unsubscribeError);
                    }

                    localStorage.removeItem('role');
                    localStorage.removeItem('teacherName');
                    localStorage.removeItem('currentTeacherName');
                    localStorage.removeItem('teacherId');
                    localStorage.removeItem('teacherEmploymentType');
                    localStorage.removeItem('teacherLoginTime');
                    localStorage.removeItem('teacherLastActivity');

                    window.location.href = 'index.html';
                }

                return;
            }

            window.__teacherForcedLockoutInProgress = false;

            // Send a reminder notification every 20 minutes for pending teachers.
            if (pendingAtDeadline) {
                const nowMs = Date.now();
                const reminderIntervalMs = 20 * 60 * 1000;
                const shouldNotify = !window.__lastReminderNotifyAt || (nowMs - window.__lastReminderNotifyAt >= reminderIntervalMs);
                if (shouldNotify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    showAppNotification('Reminder: Fill Today\'s Class Data', {
                        body: 'Your daily class data is pending. Please submit it to avoid lockout.'
                    });
                    window.__lastReminderNotifyAt = nowMs;
                }
            } else {
                window.__lastReminderNotifyAt = null;
            }

            if (isReminderWindow && pendingAtDeadline) {
                reminderOverlay.style.display = 'flex';
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                return;
            }

            reminderOverlay.style.display = 'none';

            if (isPostMidnight && pendingAtDeadline && !window.__midnightLockProcessing) {
                window.__midnightLockProcessing = true;
                try {
                    await updateDoc(doc(db, 'teachers', teacherId), {
                        isLocked: true,
                        lockDate: dueDate
                    });
                } catch (error) {
                    console.error('Midnight lock failed:', error);
                } finally {
                    window.__midnightLockProcessing = false;
                }
            }
        }, (error) => {
            console.error('Reminder listener error:', error);
            reminderOverlay.style.display = 'none';
        });
    };

    if (!reminderUnsubscribe) {
        attachReminderListener().catch((error) => {
            console.error('Failed to initialize reminder listener:', error);
        });
    }
};

// 2) Teacher marks leave for the day.
window.markTeacherOnLeave = async function() {
    const teacherId = localStorage.getItem('teacherId');
    if (!teacherId) return;

    if (!confirm('Are you on leave today? This will prevent account lockout at midnight.')) return;

    try {
        await updateDoc(doc(db, 'teachers', teacherId), {
            isOnLeave: true,
            hasSubmittedToday: false
        });
        const reminderOverlay = document.getElementById('statusOverlay');
        if (reminderOverlay) reminderOverlay.style.display = 'none';
        alert('Status: On Leave. Overlay hidden.');
    } catch (error) {
        console.error('Error marking leave:', error);
        alert('Error updating leave status. Please try again.');
    }
};

window.markOnLeave = function() {
    return window.markTeacherOnLeave();
};

// 3) Midnight lockout cycle (trigger from admin page).
window.syncAccountabilityCycle = async function() {
    const { hour } = getKolkataTimeParts();
    if (hour !== 0) {
        console.log('Accountability cycle skipped: lockout is allowed only after 12:00 AM IST.');
        return;
    }

    const today = getKolkataDateISO();
    const yesterday = getKolkataDateWithOffsetISO(-1);
    const settingsRef = doc(db, 'settings', 'cycle_config');
    const settingsDoc = await getDoc(settingsRef);

    if (!settingsDoc.exists() || settingsDoc.data().lastResetDate !== today) {
        const batch = writeBatch(db);
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        const submittedSnapshot = await getDocs(query(collection(db, 'entries'), where('date', '==', yesterday)));
        const submittedTeacherKeys = new Set();

        submittedSnapshot.forEach((entryDoc) => {
            const entryData = entryDoc.data() || {};
            if (entryData.teacherId) {
                submittedTeacherKeys.add(`id:${String(entryData.teacherId)}`);
            }
            if (entryData.teacherName) {
                submittedTeacherKeys.add(`name:${String(entryData.teacherName).trim().toLowerCase()}`);
            }
        });

        teachersSnap.forEach((tDoc) => {
            const data = tDoc.data() || {};
            const teacherKey = `id:${tDoc.id}`;
            const teacherNameKey = data.name ? `name:${String(data.name).trim().toLowerCase()}` : null;
            const submittedYesterday = submittedTeacherKeys.has(teacherKey) || (teacherNameKey ? submittedTeacherKeys.has(teacherNameKey) : false);
            const shouldLock = !submittedYesterday && !data.isOnLeave;

            batch.update(tDoc.ref, {
                isLocked: shouldLock,
                lockDate: shouldLock ? today : null,
                hasSubmittedToday: false,
                isOnLeave: false
            });
        });

        batch.set(settingsRef, { lastResetDate: today }, { merge: true });
        await batch.commit();
        console.log('Midnight Accountability Cycle Processed.');
    }
};

// 4) Admin unlock a teacher.
window.unlockTeacher = async function(id) {
    await updateDoc(doc(db, 'teachers', id), {
        isLocked: false,
        lockDate: null,
        hasSubmittedToday: false,
        isOnLeave: false
    });
    alert('Teacher unlocked. They can now log in.');
};

window.loadAccountabilityTracker = async function() {
    const absentListDiv = document.getElementById('absent-list');
    if (!absentListDiv) return;

    const dateLabel = document.getElementById('accountabilityDateLabel');
    if (dateLabel) {
        dateLabel.textContent = formatKolkataReadableDate();
    }

    if (accountabilityTrackerUnsubscribe) {
        accountabilityTrackerUnsubscribe();
        accountabilityTrackerUnsubscribe = null;
    }

    await ensureAuthReady();

    const q = query(
        collection(db, 'teachers'),
        where('status', '==', 'active')
    );

    absentListDiv.innerHTML = '<div class="loading-spinner">Checking database...</div>';

    accountabilityTrackerUnsubscribe = onSnapshot(q, (snapshot) => {
        (async () => {
            absentListDiv.innerHTML = '';

            const { hour } = getKolkataTimeParts();
            const isPreMidnight = hour >= 1 && hour <= 23;
            const yesterday = getKolkataDateWithOffsetISO(-1);
            const submittedSnapshot = await getDocs(query(collection(db, 'entries'), where('date', '==', yesterday)));
            const submittedTeacherKeys = new Set();

            submittedSnapshot.forEach((entryDoc) => {
                const entryData = entryDoc.data() || {};
                if (entryData.teacherId) {
                    submittedTeacherKeys.add(`id:${String(entryData.teacherId)}`);
                }
                if (entryData.teacherName) {
                    submittedTeacherKeys.add(`name:${String(entryData.teacherName).trim().toLowerCase()}`);
                }
            });

            if (snapshot.empty) {
                absentListDiv.innerHTML = "<p class='status-success'>No active teachers found.</p>";
                return;
            }

            snapshot.forEach((docSnap) => {
            const teacher = docSnap.data() || {};
            const teacherId = docSnap.id;
            const teacherKey = `id:${teacherId}`;
            const teacherNameKey = teacher.name ? `name:${String(teacher.name).trim().toLowerCase()}` : null;
            const submittedYesterday = submittedTeacherKeys.has(teacherKey) || (teacherNameKey ? submittedTeacherKeys.has(teacherNameKey) : false);
            const isLocked = teacher.isLocked || false;

            if (isPreMidnight && isLocked && !bulkUnlockInProgress) {
                bulkUnlockInProgress = true;
                updateDoc(doc(db, 'teachers', teacherId), {
                    isLocked: false,
                    lockDate: null
                }).finally(() => {
                    bulkUnlockInProgress = false;
                });
            }

            const row = document.createElement('div');
            row.className = 'teacher-status-row';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'teacher-info';

            const nameEl = document.createElement('strong');
            nameEl.textContent = teacher.name || 'Unnamed Teacher';
            infoDiv.appendChild(nameEl);

            const badge = document.createElement('span');
            const effectiveLocked = isLocked && !isPreMidnight;
            badge.className = effectiveLocked ? 'badge-locked' : 'badge-pending';
            badge.textContent = effectiveLocked ? 'LOCKED' : 'PENDING';
            infoDiv.appendChild(badge);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'teacher-actions';

            const btn = document.createElement('button');
            btn.className = 'btn-restore';
            btn.type = 'button';
            btn.textContent = effectiveLocked ? 'Unlock and Continue' : (submittedYesterday ? 'Submitted' : 'Mark as Excused');
            btn.onclick = () => window.restoreTeacherAccess(teacherId);
            actionsDiv.appendChild(btn);

            row.appendChild(infoDiv);
            row.appendChild(actionsDiv);
            absentListDiv.appendChild(row);
            });
        })().catch((error) => {
            console.error('Accountability tracker render error:', error);
            absentListDiv.innerHTML = "<p style='color:#c62828;'>Unable to load accountability monitor right now.</p>";
        });
    }, (error) => {
        console.error('Accountability tracker error:', error);
        absentListDiv.innerHTML = "<p style='color:#c62828;'>Unable to load accountability monitor right now.</p>";
    });
};

window.restoreTeacherAccess = async function(tId) {
    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) {
            alert(message);
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'premium-toast';
        toast.innerHTML = `
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    try {
        const teacherRef = doc(db, 'teachers', tId);
        await updateDoc(teacherRef, {
            isLocked: false,
            lockDate: null,
            hasSubmittedToday: true,
            unlockedByAdmin: true,
            lastUnlockedAt: serverTimestamp(),
            isOnLeave: false,
            lastAdminUnlockAt: serverTimestamp()
        });
        showToast('Access restored for teacher successfully.');
    } catch (e) {
        console.error('Error unlocking:', e);
        showToast('Error: Could not restore access.');
    }
};

// 5) One-time safe initialization for all teachers.
window.initializeTeacherAccountability = async function() {
    try {
        const teachersRef = collection(db, 'teachers');
        const snapshot = await getDocs(teachersRef);

        if (snapshot.empty) {
            alert('No teachers found to initialize.');
            return;
        }

        const batch = writeBatch(db);
        let count = 0;

        snapshot.forEach((teacherDoc) => {
            batch.update(doc(db, 'teachers', teacherDoc.id), {
                hasSubmittedToday: true,
                isLocked: false,
                isOnLeave: false
            });
            count += 1;
        });

        await batch.commit();
        alert(`Successfully initialized ${count} teachers for the Accountability System.`);
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Error initializing teachers. Check console.');
    }
};

// ...existing code...

// ========== LOGIN FUNCTIONS ==========

// Load active teachers for login dropdown
window.loadTeachersForLogin = async function() {
    const teacherDropdown = document.getElementById("teacherDropdown");
    if (!teacherDropdown) return;

    try {
        const q = query(collection(db, "teachers"), where("status", "==", "active"));
        const snapshot = await getDocs(q);
        
        teacherDropdown.innerHTML = '<option value="">-- Select Your Name --</option>';
        
        // Sort teachers by name in JavaScript instead of Firestore
        const teachers = [];
        snapshot.forEach(doc => {
            teachers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        teachers.sort((a, b) => a.name.localeCompare(b.name));
        
        teachers.forEach(teacher => {
            teacherDropdown.innerHTML += `<option value="${teacher.name}">${teacher.name}</option>`;
        });
        
        if (teachers.length === 0) {
            teacherDropdown.innerHTML = '<option value="">No active teachers found</option>';
            alert("No active teachers found. Please contact admin.");
        }
    } catch (error) {
        console.error("Error loading teachers:", error);
        teacherDropdown.innerHTML = '<option value="">Error loading teachers</option>';
        alert("Error loading teachers: " + error.message);
    }
}

// Login function with teacher selection
// Handle role selection change
window.handleRoleChange = function() {
    const roleSelector = document.getElementById("roleSelector");
    const teacherSection = document.getElementById("teacherSection");
    const adminSection = document.getElementById("adminSection");
    const loginBtn = document.getElementById("loginBtn");
    
    const selectedRole = roleSelector.value;
    
    // Hide all sections first
    teacherSection.style.display = "none";
    adminSection.style.display = "none";
    loginBtn.style.display = "none";
    
    if (selectedRole === "teacher") {
        teacherSection.style.display = "block";
        loginBtn.style.display = "block";
        loginBtn.textContent = "Login as Teacher";
    } else if (selectedRole === "admin") {
        adminSection.style.display = "block";
        loginBtn.style.display = "block";
        loginBtn.textContent = "Login as Admin";
    }
}

// Show forgot password message for teachers
window.showForgotPasswordMessage = function(event) {
    event.preventDefault();
    alert('Contact Ziel admin to get it resolved.');
};

window.login = async function() {
    const roleSelector = document.getElementById("roleSelector");
    const selectedRole = roleSelector?.value;
    
    if (!selectedRole) {
        alert("Please select your role first");
        return;
    }
    
    // Prevent multiple clicks
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn && loginBtn.disabled) {
        return; // Already processing
    }
    
    if (selectedRole === "teacher") {
        // Teacher Login - Name and Password Based Authentication
        const teacherNameInput = document.getElementById("teacherNameLogin");
        const teacherPasswordInput = document.getElementById("teacherPasswordLogin");
        const enteredName = teacherNameInput?.value.trim();
        const enteredPassword = teacherPasswordInput?.value.trim();
        
        if (!enteredName) {
            alert("Please enter your registered teacher name");
            return;
        }
        
        if (!enteredPassword) {
            alert("Please enter your password");
            return;
        }
        
        try {
            // Query Firebase for teacher with this name (case-sensitive)
            const q = query(
                collection(db, "teachers"), 
                where("name", "==", enteredName),
                where("status", "==", "active")
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert("Teacher name not found or account inactive.\nName is case-sensitive. Please contact your admin.");
                return;
            }

            const teacherDoc = snapshot.docs[0];
            const teacherData = teacherDoc.data();
            const { hour } = getKolkataTimeParts();
            const isPreMidnight = hour >= 1 && hour <= 23;

            if (teacherData.isLocked) {
                const todayKolkata = getKolkataDateISO();
                const lockDate = teacherData.lockDate || null;

                if (isPreMidnight) {
                    await updateDoc(doc(db, "teachers", teacherDoc.id), {
                        isLocked: false,
                        lockDate: null
                    });
                } else if (lockDate && lockDate === todayKolkata) {
                    alert("🚫 ACCESS DENIED\n\nYou did not fill your class data before 12:00 AM. Please contact admin to unlock your account.");
                    return;
                } else {
                    await updateDoc(doc(db, "teachers", teacherDoc.id), {
                        isLocked: false,
                        lockDate: null
                    });
                }

                const freshTeacherDoc = await getDoc(doc(db, "teachers", teacherDoc.id));
                if (freshTeacherDoc.exists()) {
                    Object.assign(teacherData, freshTeacherDoc.data());
                }
            }
            
            console.log("Teacher found:", teacherData);
            console.log("Teacher ID:", teacherDoc.id);
            
            // Verify password (case-sensitive)
            if (teacherData.password !== enteredPassword) {
                alert("Invalid password. Please try again.");
                return;
            }

            console.log("Password verified, setting localStorage...");
            
            // Success - Store teacher identity
            localStorage.setItem("role", "teacher");
            localStorage.setItem("teacherName", teacherData.name);
            localStorage.setItem("currentTeacherName", teacherData.name);
            localStorage.setItem("teacherId", teacherDoc.id);
            localStorage.setItem("teacherEmploymentType", teacherData.employmentType || 'fulltime');
            localStorage.setItem("teacherLoginTime", Date.now().toString());
            localStorage.setItem("teacherLastActivity", Date.now().toString());
            
            console.log("LocalStorage set:", {
                role: localStorage.getItem("role"),
                teacherName: localStorage.getItem("teacherName"),
                teacherId: localStorage.getItem("teacherId"),
                employmentType: localStorage.getItem("teacherEmploymentType")
            });
            
            // Ensure localStorage is written before redirect
            console.log("Redirecting to teacher.html in 100ms...");
            setTimeout(() => {
                window.location.href = "teacher.html";
            }, 100);
        } catch (error) {
            console.error("Error verifying teacher:", error);
            alert("Error verifying credentials. Please try again.");
            return;
        }
    } 
    else if (selectedRole === "admin") {
        // Registered admin emails
        const REGISTERED_ADMIN_EMAILS = [
            "rishabhsunny25@gmail.com",
            "info@zielclasses.com"
        ];
        
        // Check if OTP section is visible (user is verifying OTP)
        const otpSection = document.getElementById("otpSection");
        const loginBtn = document.getElementById("loginBtn");
        
        if (otpSection && otpSection.style.display !== "none") {
            // Verify OTP
            const otpInput = document.getElementById("adminOTP");
            const enteredOTP = otpInput?.value.trim();
            
            if (!enteredOTP) {
                alert("Please enter the OTP sent to your email");
                return;
            }
            
            // Disable button during verification
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = "Verifying...";
            }
            
            const result = verifyOTP(enteredOTP);
            
            if (result.valid) {
                // OTP verified - grant access
                localStorage.setItem("role", "admin");
                localStorage.setItem("adminLoginTime", Date.now().toString());
                localStorage.setItem("adminLastActivity", Date.now().toString());
                localStorage.removeItem("teacherName");
                localStorage.removeItem("teacherEmail");
                localStorage.removeItem("currentTeacherName");
                localStorage.removeItem("teacherId");
                
                // Ensure localStorage is written before redirect
                setTimeout(() => {
                    window.location.href = "admin.html";
                }, 100);
            } else {
                alert(result.message);
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = "Verify OTP";
                }
            }
        } else {
            // First step - verify email and password, then send OTP
            const adminEmailInput = document.getElementById("adminEmail");
            const adminPasswordInput = document.getElementById("adminPassword");
            const enteredEmail = adminEmailInput?.value.trim().toLowerCase();
            const pwd = adminPasswordInput?.value;
            
            if (!enteredEmail) {
                alert("Please enter admin email");
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(enteredEmail)) {
                alert("Please enter a valid email address");
                return;
            }
            
            // Check if email is registered
            if (!REGISTERED_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(enteredEmail)) {
                alert("Email not registered as admin. Please contact support.");
                return;
            }
            
            if (!pwd) {
                alert("Please enter admin password");
                return;
            }
            
            if (pwd === "admin123") {
                // Password correct - send OTP to entered email
                const loginBtn = document.getElementById("loginBtn");
                
                // Prevent double-click or duplicate submission
                if (loginBtn.disabled || isOTPSending) {
                    return;
                }
                
                loginBtn.disabled = true;
                loginBtn.textContent = "Sending OTP...";
                
                try {
                    adminOTP = generateOTP();
                    otpTimestamp = Date.now();
                    
                    await sendOTPEmail(adminOTP, enteredEmail);
                    
                    // Show OTP input section
                    if (otpSection) {
                        otpSection.style.display = "block";
                        document.getElementById("adminEmail").disabled = true;
                        document.getElementById("adminPassword").disabled = true;
                        loginBtn.textContent = "Verify OTP";
                        loginBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error in OTP send process:', error);
                    alert("Failed to send OTP. Please try again.");
                    loginBtn.textContent = "Login as Admin";
                    loginBtn.disabled = false;
                    isOTPSending = false; // Reset flag on error
                }
            } else {
                alert("Incorrect admin password!");
            }
        }
    }
}

// ========== TEACHER PORTAL FUNCTIONS ==========

// Load teacher and student lists for dropdowns
window.loadLists = async function() {
    try {
        // Get active teachers
        const teachersQuery = query(collection(db, "teachers"), where("status", "==", "active"));
        const teachersSnapshot = await getDocs(teachersQuery);
        const teachers = teachersSnapshot.docs.map(doc => ({
            name: doc.data().name,
            email: doc.data().email
        })).sort((a, b) => a.name.localeCompare(b.name));

        // Get active students with mode information
        const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(doc => ({
            name: doc.data().name,
            mode: doc.data().mode || 'online',
            offlineCentreName: doc.data().offlineCentreName || ''
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        console.log("Students loaded with mode:", students);

        // Populate teacher dropdown with logged-in teacher's name
        const teacherSelect = document.getElementById("teacherName");
        const loggedInTeacher = localStorage.getItem("teacherName");
        const role = localStorage.getItem("role");
        
        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="">-- Select Teacher --</option>';
            
            if (role === "admin") {
                // Admin can see all active teachers with emails
                teachers.forEach(t => {
                    teacherSelect.innerHTML += `<option value="${t.name}">${t.name} (${t.email})</option>`;
                });
            } else {
                // Teacher sees only their own name
                if (loggedInTeacher) {
                    teacherSelect.innerHTML += `<option value="${loggedInTeacher}" selected>${loggedInTeacher}</option>`;
                    teacherSelect.disabled = true; // Prevent changing
                }
            }
        }

        // Update page header to show logged-in teacher's identity
        const teacherIdentityDiv = document.getElementById("teacherIdentity");
        if (teacherIdentityDiv && role === "teacher") {
            const teacherName = localStorage.getItem("teacherName") || "Teacher";
            teacherIdentityDiv.innerHTML = `<strong>${teacherName}</strong>`;
        }

        // Update page header to show logged-in teacher's identity
        const teacherInfoDiv = document.getElementById("teacherInfo");
        if (teacherInfoDiv && role === "teacher") {
            const teacherName = localStorage.getItem("teacherName") || "Teacher";
            teacherInfoDiv.innerHTML = `Logged in as <strong>${teacherName}</strong>`;
        }

        // Populate student dropdown
        const studentSelect = document.getElementById("studentName");
        if (studentSelect) {
            studentSelect.innerHTML = '<option value="">-- Select Student --</option>';
            students.forEach(s => {
                studentSelect.innerHTML += `<option value="${s.name}">${s.name}</option>`;
            });
        }

        // Initialize searchable student dropdown
        initStudentSearch(students);
        
        // Initialize subject autocomplete
        loadCustomSubjects().then(() => {
            initSubjectSearch();
        });
    } catch (error) {
        console.error("Error loading lists:", error);
        alert("Error loading data. Check console.");
    }
}

// Subject list
let SUBJECT_LIST = [
    "Eng",
    "Eng lang",
    "Eng lit",
    "English",
    "Hindi",
    "Bengali",
    "Sanskrit",
    "French",
    "Spanish",
    "German",
    "Mandarin",
    "Other Foreign Language",
    "Mathematics",
    "Applied Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Environmental Science",
    "Environmental Systems and Societies",
    "Computer Science",
    "Computer Applications",
    "Informatics Practices",
    "Information Technology",
    "IT",
    "Artificial Intelligence",
    "History",
    "Geography",
    "Political Science",
    "Civics",
    "Economics",
    "Business Studies",
    "Business Management",
    "Commerce",
    "Accountancy",
    "Psychology",
    "Sociology",
    "Philosophy",
    "Global Politics",
    "Physical Education",
    "Sports Science",
    "Fine Arts",
    "Visual Arts",
    "Painting",
    "Music",
    "Dance",
    "Theatre",
    "Film Studies",
    "Legal Studies",
    "Entrepreneurship",
    "Commercial Studies",
    "Economic Applications",
    "Commercial Applications",
    "Home Science",
    "Fashion Studies",
    "Fashion Designing",
    "Hospitality Management",
    "Tourism Studies",
    "Technical Drawing",
    "Design Technology",
    "Logical reasoning",
    "Mathematical reasoning",
    "Coding",
    "Language and literature (IB)",
    "Literature (IB)",
    "I and S (IB)",
    "Global Perspectives (IGCSE)",
    "UI (IB)",
    "General Knowledge",
    "Hindi vyakaran",
    "TOK",
    "Statistics",
    "Punjabi",
    "Eng language"
];

// Load custom subjects from Firestore
async function loadCustomSubjects() {
    try {
        const subjectsDoc = await getDoc(doc(db, "settings", "customSubjects"));
        if (subjectsDoc.exists()) {
            const customSubjects = subjectsDoc.data().subjects || [];
            // Merge custom subjects with default list and remove duplicates
            SUBJECT_LIST = [...new Set([...SUBJECT_LIST, ...customSubjects])].sort();
        }
    } catch (error) {
        console.error("Error loading custom subjects:", error);
    }
}

// Save a new custom subject to Firestore
async function saveCustomSubject(newSubject) {
    try {
        const subjectsRef = doc(db, "settings", "customSubjects");
        const subjectsDoc = await getDoc(subjectsRef);
        
        let subjects = [];
        if (subjectsDoc.exists()) {
            subjects = subjectsDoc.data().subjects || [];
        }
        
        // Add new subject if it doesn't exist
        if (!subjects.includes(newSubject)) {
            subjects.push(newSubject);
            subjects.sort();
            
            await updateDoc(subjectsRef, { subjects });
            
            // Also add to local list
            if (!SUBJECT_LIST.includes(newSubject)) {
                SUBJECT_LIST.push(newSubject);
                SUBJECT_LIST.sort();
            }
            
            return true;
        }
        return false;
    } catch (error) {
        // If document doesn't exist, create it
        if (error.code === 'not-found') {
            try {
                await setDoc(doc(db, "settings", "customSubjects"), {
                    subjects: [newSubject]
                });
                
                if (!SUBJECT_LIST.includes(newSubject)) {
                    SUBJECT_LIST.push(newSubject);
                    SUBJECT_LIST.sort();
                }
                
                return true;
            } catch (err) {
                console.error("Error creating custom subjects document:", err);
                return false;
            }
        }
        console.error("Error saving custom subject:", error);
        return false;
    }
}

function initStudentSearch(students) {
    const searchInput = document.getElementById("studentSearch");
    const dropdown = document.getElementById("studentDropdown");
    const hiddenInput = document.getElementById("studentName");

    if (!searchInput || !dropdown) {
        console.error("Error: Student search elements not found!");
        return;
    }

    let selectedIndex = -1;

    searchInput.addEventListener("input", function() {
        const search = this.value.trim();
        selectedIndex = -1;
        
        if (!search) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('show');
            hiddenInput.value = '';
            return;
        }
        
        // Filter students that start with the typed text
        const matches = students.filter(s => 
            s.name.toLowerCase().startsWith(search.toLowerCase())
        );
        
        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-item" style="color: #999; cursor: default;">No students found</div>';
            dropdown.classList.add('show');
            hiddenInput.value = '';
            return;
        }
        
        // Build dropdown
        dropdown.innerHTML = '';
        matches.forEach((student) => {
            console.log("Displaying student:", student);
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            
            // Highlight matching text
            const regex = new RegExp(`(${search})`, 'gi');
            const highlightedName = student.name.replace(regex, '<span class="autocomplete-highlight">$1</span>');
            
            // Display student name with mode
            let modeText = student.mode ? student.mode.charAt(0).toUpperCase() + student.mode.slice(1) : 'Online';
            const modeColor = student.mode === 'online' ? '#4CAF50' : '#999';
            
            // Add centre name for offline students
            if (student.mode === 'offline' && student.offlineCentreName) {
                modeText = `${modeText} (${student.offlineCentreName})`;
            }
            
            item.innerHTML = `${highlightedName} <span style="font-size: 12px; color: ${modeColor}; font-weight: 400; margin-left: 8px;">— ${modeText}</span>`;
            
            item.addEventListener('click', () => {
                searchInput.value = student.name;
                hiddenInput.value = student.name;
                dropdown.innerHTML = '';
                dropdown.classList.remove('show');
            });
            
            dropdown.appendChild(item);
        });
        
        dropdown.classList.add('show');
        hiddenInput.value = '';
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex]?.click();
        }
    });

    function updateSelection(items) {
        items.forEach((item, i) => {
            if (i === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('show');
        }
    });
}

// Initialize subject autocomplete
function initSubjectSearch() {
    const searchInput = document.getElementById("subject");
    const dropdown = document.getElementById("subjectDropdown");

    if (!searchInput || !dropdown) {
        console.error("Error: Subject search elements not found!");
        return;
    }

    let selectedIndex = -1;

    searchInput.addEventListener("input", function() {
        const search = this.value.trim();
        selectedIndex = -1;
        
        if (!search) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('show');
            return;
        }
        
        // Filter subjects that start with the typed text
        const matches = SUBJECT_LIST.filter(subject => 
            subject.toLowerCase().startsWith(search.toLowerCase())
        );
        
        // Build dropdown
        dropdown.innerHTML = '';
        
        if (matches.length === 0) {
            // Show option to add new subject
            const addItem = document.createElement('div');
            addItem.className = 'autocomplete-item';
            addItem.style.color = '#4285f4';
            addItem.style.fontWeight = '500';
            addItem.innerHTML = `➕ Add "${search}" as new subject`;
            
            addItem.addEventListener('click', async () => {
                const confirmed = confirm(`Add "${search}" to the subject list?`);
                if (confirmed) {
                    const saved = await saveCustomSubject(search);
                    if (saved) {
                        searchInput.value = search;
                        dropdown.innerHTML = '';
                        dropdown.classList.remove('show');
                        alert(`✅ "${search}" has been added to the subject list!`);
                    } else {
                        searchInput.value = search;
                        dropdown.innerHTML = '';
                        dropdown.classList.remove('show');
                    }
                }
            });
            
            dropdown.appendChild(addItem);
            dropdown.classList.add('show');
            return;
        }
        
        matches.forEach((subject) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            
            // Highlight matching text
            const regex = new RegExp(`(${search})`, 'gi');
            const highlightedName = subject.replace(regex, '<span class="autocomplete-highlight">$1</span>');
            
            item.innerHTML = highlightedName;
            
            item.addEventListener('click', () => {
                searchInput.value = subject;
                dropdown.innerHTML = '';
                dropdown.classList.remove('show');
            });
            
            dropdown.appendChild(item);
        });
        
        dropdown.classList.add('show');
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex]?.click();
        }
    });

    function updateSelection(items) {
        items.forEach((item, i) => {
            if (i === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('show');
        }
    });
}

// Load students for teacher page
window.loadStudentsForTeacher = async function() {
    try {
        // Load custom subjects first
        await loadCustomSubjects();
        
        const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(doc => ({
            name: doc.data().name,
            mode: doc.data().mode || 'online'
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        console.log("Students loaded with mode:", students);
        
        if (students.length === 0) {
            console.warn("No students found. Please add students in admin panel first.");
            return;
        }

        // Setup autocomplete
        initStudentSearch(students);
        initSubjectSearch();
    } catch (error) {
        console.error("Error loading students:", error);
    }
}

// Prevent double submission flag
let isSavingEntry = false;

// Save entry to Firestore with complete fields
window.saveEntry = async function(event) {
    if (event) event.preventDefault();

    // Prevent double submission
    if (isSavingEntry) {
        console.log("Already saving, please wait...");
        return;
    }
    
    isSavingEntry = true;

    const student = document.getElementById("studentName").value.trim();
    const date = document.getElementById("date").value.trim();
    let timeFrom = document.getElementById("timeFrom").value.trim();
    let timeTo = document.getElementById("timeTo").value.trim();
    const classCount = document.getElementById("classCount").value.trim();
    const sheetMade = document.querySelector('input[name="sheetMade"]:checked')?.value;
    const homeworkGiven = document.querySelector('input[name="homeworkGiven"]:checked')?.value;
    const subject = document.getElementById("subject").value.trim();
    const topic = document.getElementById("topic").value.trim();
    const paymentInput = document.getElementById("payment");
    const payment = paymentInput && paymentInput.offsetParent !== null ? (paymentInput.value.trim() || "") : "";
    
    // Check if we're editing an existing entry
    const editingId = document.getElementById("entryForm").dataset.editingId;

    // Debug logging
    console.log("Form values:", { student, date, timeFrom, timeTo, classCount, sheetMade, homeworkGiven, subject, topic });

    // Validate student name is required
    if (!student) {
        alert("Please select a student name");
        isSavingEntry = false;
        return;
    }
    
    // Validate time range only if both times are provided
    if (timeFrom && timeTo && timeFrom >= timeTo) {
        // Skip this entry silently or just swap times
        const temp = timeFrom;
        timeFrom = timeTo;
        timeTo = temp;
    }

    // Get logged-in teacher info
    const teacherName = localStorage.getItem("teacherName") || localStorage.getItem("currentTeacherName");
    const role = localStorage.getItem("role");

    console.log("Saving entry - Teacher info:", { teacherName, role });

    // Validate teacher info exists
    if (role === "teacher" && !teacherName) {
        alert("Teacher information missing! Please log in again.");
        isSavingEntry = false;
        window.location.href = "../login.html";
        return;
    }

    try {
        console.log("Creating entry data...");
        // Calculate day of week
        const dateObj = new Date(date + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[dateObj.getDay()];

        // Get student ID from Firestore
        const studentQuery = query(collection(db, "students"), where("name", "==", student));
        const studentSnapshot = await getDocs(studentQuery);
        let studentId = null;
        if (!studentSnapshot.empty) {
            studentId = studentSnapshot.docs[0].id;
        }

        // For admin: get selected teacher's email and ID from Firestore
        let teacherNameToStore = teacherName;
        let teacherId = localStorage.getItem("teacherId");
        
        if (role === "admin") {
            const selectedTeacher = document.getElementById("teacherName")?.value;
            if (selectedTeacher) {
                teacherNameToStore = selectedTeacher;
                const q = query(collection(db, "teachers"), where("name", "==", selectedTeacher));
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    absentListDiv.innerHTML = "<p class='status-success'>All active teachers have either submitted logs or are marked on leave.</p>";
                }
            }
        }

        const entryData = {
            teacherId: teacherId,
            teacherName: teacherNameToStore,
            studentId: studentId,
            studentName: student,
            date: date,
            dayOfWeek: dayOfWeek,
            timeFrom: timeFrom || "",
            timeTo: timeTo || "",
            classCount: classCount ? parseFloat(classCount) : 0,
            sheetMade: sheetMade || "",
            homeworkGiven: document.querySelector('input[name="homeworkGiven"]:checked')?.value || "",
            subject: subject || "",
            topic: topic || ""
        };
        
        console.log("Entry data prepared:", entryData);
        
        // Add payment for part-time teachers
        if (payment) {
            entryData.payment = payment;
            console.log("Payment added:", payment);
        }

        if (editingId) {
            // Update existing entry
            console.log("Updating entry:", editingId);
            const docRef = doc(db, "entries", editingId);
            await updateDoc(docRef, entryData);

            const currentKolkataDate = getKolkataDateISO();
            await updateDoc(doc(db, "teachers", teacherId), {
                hasSubmittedToday: date === currentKolkataDate,
                isOnLeave: false,
                isLocked: false,
                lockDate: null,
                lastSubmissionDate: date
            });

            alert("✅ Entry updated successfully!");
            delete document.getElementById("entryForm").dataset.editingId;
        } else {
            // Create new entry
            console.log("Creating new entry...");
            entryData.createdAt = Timestamp.now();
            await addDoc(collection(db, "entries"), entryData);

            if (teacherId) {
                await updateDoc(doc(db, "teachers", teacherId), {
                    hasSubmittedToday: true,
                    isOnLeave: false,
                    isLocked: false,
                    lockDate: null,
                    lastSubmissionDate: date || getKolkataDateISO()
                });
            }

            console.log("Entry saved to Firestore!");
            alert("✅ Entry saved successfully!");
        }
        
        // Clear only student-specific fields, keep date, time, and subject for next entry
        document.getElementById("studentSearch").value = "";
        document.getElementById("studentName").value = "";
        document.getElementById("studentDropdown").innerHTML = "";
        document.getElementById("studentDropdown").classList.remove("show");
        // Keep timeFrom, timeTo, and subject for next student
        // document.getElementById("timeFrom").value = "";
        // document.getElementById("timeTo").value = "";
        document.getElementById("classCount").value = "";
        const checkedSheet = document.querySelector('input[name="sheetMade"]:checked');
        if (checkedSheet) checkedSheet.checked = false;
        const checkedHomework = document.querySelector('input[name="homeworkGiven"]:checked');
        if (checkedHomework) checkedHomework.checked = false;
        // document.getElementById("subject").value = "";
        document.getElementById("topic").value = "";

        loadRecentEntries();
        
        // Reset the flag after successful save
        isSavingEntry = false;
    } catch (error) {
        console.error("Error saving entry:", error);
        alert("❌ Error saving entry. Check console for details.");
        
        // Reset the flag on error
        isSavingEntry = false;
    }
}

// Load recent entries - filtered by teacher ID or all for admin
window.loadRecentEntries = async function() {
    const teacherId = localStorage.getItem("teacherId");
    const role = localStorage.getItem("role");
    const div = document.getElementById("recentEntries");
    
    if (!div) return;

    // Check if teacher has valid ID
    if (role === "teacher" && !teacherId) {
        div.innerHTML = "<p class='error'>Teacher ID not found. Please <a href='index.html'>login again</a>.</p>";
        return;
    }

    div.innerHTML = "<p>Loading...</p>";

    try {
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
        
        let entriesQuery;
        if (role === "admin") {
            // Admin sees all entries - fetch all and filter by date in JS
            entriesQuery = query(collection(db, "entries"));
        } else {
            // Teachers see only their entries
            entriesQuery = query(
                collection(db, "entries"),
                where("teacherId", "==", teacherId)
            );
        }

        const snapshot = await getDocs(entriesQuery);

        // Filter by date in JavaScript
        const entries = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date(0);
            
            // Only include entries from last 15 days
            if (createdAt >= fifteenDaysAgo) {
                entries.push({
                    id: docSnap.id,
                    ...data
                });
            }
        });

        if (entries.length === 0) {
            div.innerHTML = "<p>No entries in the last 15 days.</p>";
            return;
        }

        // Sort entries by createdAt in JavaScript (newest first)
        entries.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // Descending order (newest first)
        });

        div.innerHTML = "";
        entries.forEach(e => {
            const paymentText = e.payment ? `${e.payment}` : 'No payment';
            const sheetText = e.sheetMade === 'yes' ? 'Yes' : 'No';
            const homeworkText = e.homeworkGiven === 'yes' ? 'Yes' : e.homeworkGiven === 'no' ? 'No' : 'N/A';
            const studentName = e.studentName || e.student || 'N/A';
            const canEdit = true; // Teachers can edit anytime without restrictions
            
            div.innerHTML += `
                <div class="entry-item">
                    <div class="entry-header">
                        <div>
                            <span class="entry-date">${e.date || 'N/A'}</span>
                            <span class="entry-day">${e.dayOfWeek || ''}</span>
                        </div>
                    </div>
                    <div class="entry-details">
                        <div class="entry-detail"><strong>Student:</strong> ${studentName}</div>
                        <div class="entry-detail"><strong>Time:</strong> ${e.timeFrom || e.startTime || 'N/A'} - ${e.timeTo || e.endTime || 'N/A'}</div>
                        <div class="entry-detail"><strong>Classes:</strong> ${e.classCount || 'N/A'}</div>
                        <div class="entry-detail"><strong>Sheet:</strong> ${sheetText}</div>
                        <div class="entry-detail"><strong>Homework:</strong> ${homeworkText}</div>
                        <div class="entry-detail"><strong>Subject:</strong> ${e.subject || '-'}</div>
                    </div>
                    <div class="entry-detail" style="margin-top: 8px;">
                        <strong>Topic:</strong> ${e.topic || '-'}
                    </div>
                    <div class="entry-actions">
                        ${canEdit ? `<button class="btn-edit" onclick="editEntry('${e.id}')">Edit</button>` : '<button class="btn-edit" disabled>Edit</button>'}
                        ${canEdit ? `<button class="btn-delete" onclick="deleteEntry('${e.id}')">Delete</button>` : '<button class="btn-delete" disabled>Delete</button>'}
                    </div>
                </div>
            `;
        });
        
        // Check for auto-download after loading entries
        const role = localStorage.getItem('role');
        if (role === 'teacher' && typeof window.checkAutoDownloadTeacher === 'function') {
            checkAutoDownloadTeacher();
        }
    } catch (error) {
        console.error("Error loading entries:", error);
        div.innerHTML = "<p style='color: red;'>❌ Error loading entries. Check console.</p>";
    }
}

// Edit entry - populate form with existing data
window.editEntry = async function(docId) {
    try {
        const docRef = doc(db, "entries", docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("❌ Entry not found!");
            return;
        }

        const entry = docSnap.data();
        const role = localStorage.getItem("role");
        const teacherId = localStorage.getItem("teacherId");

        // Admin can edit anything
        if (role !== "admin") {
            // Check if teacher owns this entry
            if (entry.teacherId !== teacherId) {
                alert("❌ You can only edit your own entries!");
                return;
            }

            // Time restriction removed - teachers can edit anytime
        }

        // Populate form fields
        document.getElementById("studentSearch").value = entry.studentName || entry.student || "";
        document.getElementById("studentName").value = entry.studentName || entry.student || "";
        document.getElementById("date").value = entry.date || "";
        document.getElementById("timeFrom").value = entry.timeFrom || "";
        document.getElementById("timeTo").value = entry.timeTo || "";
        document.getElementById("classCount").value = entry.classCount || "";
        
        // Set radio button
        if (entry.sheetMade) {
            const radio = document.querySelector(`input[name="sheetMade"][value="${entry.sheetMade}"]`);
            if (radio) radio.checked = true;
        }
        
        // Set homework radio button
        if (entry.homeworkGiven) {
            const homeworkRadio = document.querySelector(`input[name="homeworkGiven"][value="${entry.homeworkGiven}"]`);
            if (homeworkRadio) homeworkRadio.checked = true;
        }
        
        document.getElementById("subject").value = entry.subject || "";
        document.getElementById("topic").value = entry.topic || "";

        // Store the entry ID for update
        document.getElementById("entryForm").dataset.editingId = docId;
        
        // Scroll to form
        document.getElementById("entryForm").scrollIntoView({ behavior: 'smooth' });
        
        alert("✏️ Entry loaded! Make your changes and save.");
    } catch (error) {
        console.error("Error loading entry for edit:", error);
        alert("❌ Error loading entry. Check console.");
    }
}

// Delete entry
window.deleteEntry = async function(docId) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
        const docRef = doc(db, "entries", docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Entry not found!");
            return;
        }

        const entry = docSnap.data();
        const role = localStorage.getItem("role");
        const teacherId = localStorage.getItem("teacherId");

        // Admin can delete anything
        if (role === "admin") {
            await deleteDoc(docRef);
            alert("✅ Entry deleted!");
            loadRecentEntries();
            return;
        }

        // Check if teacher owns this entry
        if (entry.teacherId !== teacherId) {
            alert("❌ You can only delete your own entries!");
            return;
        }

        // Time restriction removed - teachers can delete anytime

        await deleteDoc(docRef);
        alert("✅ Entry deleted successfully!");
        loadRecentEntries();
    } catch (error) {
        console.error("Error deleting entry:", error);
        alert("❌ Error deleting entry. Check console.");
    }
}

// ========== ADMIN FUNCTIONS ==========

// Global arrays to store full lists
let allTeachers = [];
let allStudents = [];

// Update statistics
function updateStats() {
    const activeTeachers = allTeachers.filter(t => t.status === "active").length;
    const inactiveTeachers = allTeachers.filter(t => t.status === "inactive").length;
    const activeStudents = allStudents.filter(s => s.status === "active").length;
    const inactiveStudents = allStudents.filter(s => s.status === "inactive").length;

    const activeTeachersEl = document.getElementById("activeTeachersCount");
    const inactiveTeachersEl = document.getElementById("inactiveTeachersCount");
    const activeStudentsEl = document.getElementById("activeStudentsCount");
    const inactiveStudentsEl = document.getElementById("inactiveStudentsCount");

    if (activeTeachersEl) activeTeachersEl.textContent = activeTeachers;
    if (inactiveTeachersEl) inactiveTeachersEl.textContent = inactiveTeachers;
    if (activeStudentsEl) activeStudentsEl.textContent = activeStudents;
    if (inactiveStudentsEl) inactiveStudentsEl.textContent = inactiveStudents;
}

// Initialize data and set up real-time listeners
window.initializeData = async function() {
    await ensureAuthReady();

    // Set up real-time listener for teachers
    onSnapshot(collection(db, "teachers"), (snapshot) => {
        allTeachers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        filterTeachers();
        updateStats();

        // Update teacher datalist for advanced search (admin.html)
        const datalist = document.getElementById('teachersDatalist');
        if (datalist) {
            datalist.innerHTML = '';
            // Only show active teachers
            allTeachers.filter(t => t.status === 'active').forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.name;
                datalist.appendChild(opt);
            });
        }
    }, (error) => {
        console.error('Teachers listener error:', error);
    });

    // Set up real-time listener for students
    onSnapshot(collection(db, "students"), (snapshot) => {
        allStudents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        filterStudents();
        updateStats();
    }, (error) => {
        console.error('Students listener error:', error);
    });
}

// Add teacher
window.addTeacher = async function() {
    let name = document.getElementById("newTeacher").value.trim();
    let password = document.getElementById("newTeacherPassword").value.trim();
    let employmentType = document.getElementById("newTeacherType").value;
    
    if (!name) return alert("Enter teacher name (case-sensitive)");
    if (!password) return alert("Enter password for teacher");
    
    if (password.length < 6) {
        return alert("Password must be at least 6 characters long");
    }

    try {
        // Check if teacher name already exists (case-sensitive)
        const nameQuery = query(collection(db, "teachers"), where("name", "==", name));
        const nameSnapshot = await getDocs(nameQuery);

        if (!nameSnapshot.empty) {
            alert("This teacher name already exists! Please use a different name.");
            return;
        }

        await addDoc(collection(db, "teachers"), {
            name: name,
            password: password,
            employmentType: employmentType,
            status: "active",
            createdAt: Timestamp.now()
        });

        document.getElementById("newTeacher").value = "";
        document.getElementById("newTeacherPassword").value = "";
        document.getElementById("newTeacherType").value = "fulltime";
        const typeText = employmentType === "fulltime" ? "Full Time" : "Part Time";
        alert(`Teacher added successfully!\n\nName: ${name}\nPassword: ${password}\nType: ${typeText}\n\nPlease share these credentials with the teacher.`);
    } catch (error) {
        console.error("Error adding teacher:", error);
        alert("Error adding teacher. Check console.");
    }
}

// Toggle centre name field visibility
window.toggleCentreName = function() {
    const modeRadio = document.querySelector('input[name="studentMode"]:checked');
    const centreName = document.getElementById("offlineCentreName");
    
    if (centreName) {
        if (modeRadio && modeRadio.value === "offline") {
            centreName.style.display = "block";
        } else {
            centreName.style.display = "none";
            centreName.value = "";
        }
    }
}

// Add student
window.addStudent = async function() {
    let name = document.getElementById("newStudent").value.trim();
    const modeRadio = document.querySelector('input[name="studentMode"]:checked');
    const mode = modeRadio ? modeRadio.value : "online";
    const offlineCentreNameInput = document.getElementById("offlineCentreName");
    const offlineCentreName = offlineCentreNameInput ? offlineCentreNameInput.value.trim() : "";
    const payType = document.getElementById("newStudentPayType") ? document.getElementById("newStudentPayType").value : "";
    const sub = document.getElementById("newStudentSub") ? document.getElementById("newStudentSub").value.trim() : "";
    
    console.log("Adding student:", { name, mode, offlineCentreName, payType, sub });
    
    if (!name) return alert("Enter student name");

    try {
        // Check if student already exists
        const q = query(collection(db, "students"), where("name", "==", name));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            alert("Student already exists!");
            return;
        }

        const studentData = {
            name: name,
            mode: mode,
            status: "active",
            payType: payType,
            sub: sub,
            createdAt: Timestamp.now()
        };

        // Add centre name only if offline and provided
        if (mode === "offline" && offlineCentreName) {
            studentData.offlineCentreName = offlineCentreName;
        }

        console.log("Student data to save:", studentData);

        await addDoc(collection(db, "students"), studentData);

        document.getElementById("newStudent").value = "";
        if (document.getElementById("newStudentPayType")) document.getElementById("newStudentPayType").value = "";
        if (document.getElementById("newStudentSub")) document.getElementById("newStudentSub").value = "";
        if (offlineCentreNameInput) {
            offlineCentreNameInput.value = "";
            offlineCentreNameInput.style.display = "none";
        }
        // Reset radio to online
        const onlineRadio = document.querySelector('input[name="studentMode"][value="online"]');
        if (onlineRadio) onlineRadio.checked = true;
        
        alert("Student added successfully!");
    } catch (error) {
        console.error("Error adding student:", error);
        alert("Error adding student. Check console.");
    }
}

// Toggle teacher status
window.toggleTeacherStatus = async function(id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;

    const action = teacher.status === "active" ? "deactivate" : "activate";

    try {
        const docRef = doc(db, "teachers", id);
        await updateDoc(docRef, {
            status: teacher.status === "active" ? "inactive" : "active"
        });
    } catch (error) {
        console.error("Error toggling teacher status:", error);
        alert("Error updating teacher. Check console.");
    }
}

// Enable student edit mode
window.enableStudentEdit = function(id, currentPayType, currentSub) {
    // Hide display, show edit fields
    const payTypeDisplay = document.getElementById(`payType-display-${id}`);
    const payTypeEdit = document.getElementById(`payType-edit-${id}`);
    const subDisplay = document.getElementById(`sub-display-${id}`);
    const subEdit = document.getElementById(`sub-edit-${id}`);
    const editBtn = document.getElementById(`edit-btn-${id}`);
    const saveBtn = document.getElementById(`save-btn-${id}`);
    
    if (payTypeDisplay) payTypeDisplay.style.display = 'none';
    if (payTypeEdit) {
        payTypeEdit.style.display = 'block';
        payTypeEdit.value = currentPayType;
    }
    if (subDisplay) subDisplay.style.display = 'none';
    if (subEdit) {
        subEdit.style.display = 'block';
        subEdit.value = currentSub;
    }
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-block';
}

// Save student edits
window.saveStudentEdit = async function(id) {
    const payTypeEdit = document.getElementById(`payType-edit-${id}`);
    const subEdit = document.getElementById(`sub-edit-${id}`);
    
    const newPayType = payTypeEdit ? payTypeEdit.value : '';
    const newSub = subEdit ? subEdit.value.trim() : '';
    
    try {
        const docRef = doc(db, "students", id);
        await updateDoc(docRef, {
            payType: newPayType,
            sub: newSub
        });
        
        // Update local data
        const student = allStudents.find(s => s.id === id);
        if (student) {
            student.payType = newPayType;
            student.sub = newSub;
        }
        
        // Update display
        const payTypeDisplay = document.getElementById(`payType-display-${id}`);
        const subDisplay = document.getElementById(`sub-display-${id}`);
        const editBtn = document.getElementById(`edit-btn-${id}`);
        const saveBtn = document.getElementById(`save-btn-${id}`);
        
        if (payTypeDisplay) {
            payTypeDisplay.textContent = newPayType || '-';
            payTypeDisplay.style.display = 'inline';
        }
        if (subDisplay) {
            subDisplay.textContent = newSub || '-';
            subDisplay.style.display = 'inline';
        }
        if (payTypeEdit) payTypeEdit.style.display = 'none';
        if (subEdit) subEdit.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
        if (saveBtn) saveBtn.style.display = 'none';
        
    } catch (error) {
        console.error('Error updating student:', error);
        alert('Error updating student. Check console.');
    }
}

// Update student field (for inline editing)
window.updateStudentField = async function(id, field, value) {
    try {
        const docRef = doc(db, "students", id);
        await updateDoc(docRef, {
            [field]: value
        });
        
        // Update local data
        const student = allStudents.find(s => s.id === id);
        if (student) {
            student[field] = value;
        }
    } catch (error) {
        console.error(`Error updating student ${field}:`, error);
        alert(`Error updating ${field}. Check console.`);
    }
}

// Toggle student status
window.toggleStudentStatus = async function(id) {
    const student = allStudents.find(s => s.id === id);
    if (!student) return;

    const action = student.status === "active" ? "deactivate" : "activate";

    try {
        const docRef = doc(db, "students", id);
        await updateDoc(docRef, {
            status: student.status === "active" ? "inactive" : "active"
        });
    } catch (error) {
        console.error("Error toggling student status:", error);
        alert("Error updating student. Check console.");
    }
}

// Delete teacher
window.deleteTeacher = async function(id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;

    if (!confirm(`Are you sure you want to permanently delete ${teacher.name}?`)) return;

    try {
        await deleteDoc(doc(db, "teachers", id));
        alert("Teacher deleted successfully!");
    } catch (error) {
        console.error("Error deleting teacher:", error);
        alert("Error deleting teacher. Check console.");
    }
}

// Delete student
window.deleteStudent = async function(id) {
    const student = allStudents.find(s => s.id === id);
    if (!student) return;

    if (!confirm(`Are you sure you want to permanently delete ${student.name}?`)) return;

    try {
        await deleteDoc(doc(db, "students", id));
        alert("Student deleted successfully!");
    } catch (error) {
        console.error("Error deleting student:", error);
        alert("Error deleting student. Check console.");
    }
}

// Bulk update student modes (run from browser console)
window.bulkUpdateStudentModes = async function() {
    // Provided list (name + desired mode). Modes must be 'online' or 'offline'.
    const studentsToUpdate = [
        { name: "Sanway", mode: "offline" },
        { name: "Aditya Shaw", mode: "offline" },
        { name: "Abhirup Mondal", mode: "offline" },
        { name: "Mayukh Paul", mode: "offline" },
        { name: "Rajeshwari Roy", mode: "offline" },
        { name: "Bipaasha Paul", mode: "offline" },
        { name: "Krittika Ghoshal", mode: "offline" },
        { name: "Sounak Mishra", mode: "offline" },
        { name: "Shivangi Pathak", mode: "offline" },
        { name: "Shivaji Pathak", mode: "offline" },
        { name: "Srijani", mode: "offline" },
        { name: "Ainesh Palit", mode: "offline" },
        { name: "Arkaprabha Basu", mode: "offline" },
        { name: "Rinita Das", mode: "offline" },
        { name: "Basundhara Das", mode: "offline" },
        { name: "Nandika Chaudhuri", mode: "offline" },
        { name: "Sristi Sah", mode: "offline" },
        { name: "Disha Das", mode: "offline" },
        { name: "Arushi", mode: "offline" },
        { name: "Ashwina Biswas", mode: "offline" },
        { name: "Samyukta Adhya", mode: "offline" },
        { name: "Srijit Adhya", mode: "offline" },
        { name: "Ranvir Singh", mode: "offline" },
        { name: "Unmesha Bhadra", mode: "offline" },
        { name: "Anushank Majhi", mode: "offline" },
        { name: "Shirsha Bose", mode: "offline" },
        { name: "Aariz Hussien", mode: "offline" },
        { name: "Krittika", mode: "offline" },
        { name: "Raja Paul", mode: "offline" },
        { name: "Siddharth Das", mode: "offline" },
        { name: "Asmita Biswas", mode: "offline" },
        { name: "Anik Saxena", mode: "offline" },
        { name: "Ayaan Verma", mode: "offline" },
        { name: "Aarush Mukherjee", mode: "offline" },
        { name: "Srijit Chhel", mode: "offline" },
        { name: "Utsav Sah", mode: "offline" },
        { name: "Harsh Sah", mode: "offline" },
        { name: "Srinjan Dutta", mode: "offline" },
        { name: "Atharv Singh", mode: "offline" },
        { name: "Ujain", mode: "offline" },
        { name: "Kanish Paul", mode: "offline" },
        { name: "Aditri Banerjee", mode: "offline" },
        { name: "Archisa", mode: "offline" },
        { name: "Shidhant Das", mode: "offline" },
        { name: "Wrickbidhan", mode: "offline" },
        { name: "Aryavansh Aggarwal", mode: "offline" },
        { name: "Debangshi Mukherjee", mode: "offline" },
        { name: "Debashruta Dev", mode: "offline" },
        { name: "Mayurakkhi Maity", mode: "offline" },
        { name: "Bedangk Choudhury", mode: "offline" },
        { name: "Dibyayan Mondal", mode: "offline" },
        { name: "Spandita", mode: "offline" },
        { name: "Shouryajeet", mode: "offline" },
        { name: "Anish Roy", mode: "offline" },
        { name: "Sreehit Manna", mode: "offline" },
        { name: "Siddhant Sethia", mode: "offline" },
        { name: "Akshara Banerjee", mode: "offline" },
        { name: "Aditya Pradhan", mode: "offline" },
        { name: "Shaurya Chatterjee", mode: "offline" },
        { name: "Rudra Chhetri", mode: "offline" },
        { name: "Bilash Bera", mode: "offline" },
        { name: "Hrijoy", mode: "offline" },
        { name: "Rikhiya Paul", mode: "offline" },
        { name: "Mihir Kumar", mode: "offline" },
        { name: "Shishir Kumar", mode: "offline" },
        { name: "Pratham Adhikari", mode: "offline" },
        { name: "Sriya Dutta", mode: "offline" },
        { name: "Manvi Singh", mode: "offline" },
        { name: "Aditya Pandey", mode: "offline" },
        { name: "Sanvi Das", mode: "offline" },
        { name: "Rajveer Singh", mode: "offline" },
        { name: "Viveshika", mode: "offline" },
        { name: "Aryan", mode: "offline" },
        { name: "Kaustav Mondal", mode: "offline" },
        { name: "Shourish Manna", mode: "offline" },
        { name: "Biswajeet Poul", mode: "offline" },
        { name: "Aarohi", mode: "offline" },
        { name: "Shivanya Gupta", mode: "online" },
        { name: "Lakshi Naveen", mode: "online" },
        { name: "Myra Bhandari", mode: "online" },
        { name: "Zaydan Soz", mode: "online" },
        { name: "Asmara Soz", mode: "online" },
        { name: "Adhiraj Singh", mode: "online" },
        { name: "Veer Chopra", mode: "online" },
        { name: "Myraa Khanna", mode: "online" },
        { name: "Paritosh Chacko", mode: "online" },
        { name: "Om Singh", mode: "online" },
        { name: "Aryan Sood", mode: "online" },
        { name: "Ishaq", mode: "online" },
        { name: "Vivaan Kabir Thakur", mode: "online" },
        { name: "Sanya Romley", mode: "online" },
        { name: "Sanjana Singh", mode: "online" },
        { name: "Amartya Pavuluri", mode: "online" },
        { name: "Anantya Pavuluri", mode: "online" },
        { name: "Riya", mode: "online" },
        { name: "Aiyana", mode: "online" },
        { name: "Pranit", mode: "online" },
        { name: "Rishabh", mode: "online" },
        { name: "Simran Sikand", mode: "online" },
        { name: "Sai Kumar", mode: "online" },
        { name: "Ananya Chitumala", mode: "online" },
        { name: "Jiana", mode: "online" },
        { name: "Krishna Samant", mode: "online" },
        { name: "Dhruv Chakraborty", mode: "online" },
        { name: "Prithviraj Mehta", mode: "online" },
        { name: "Aarav Gautam", mode: "online" },
        { name: "Sonika Barua", mode: "online" },
        { name: "Suprit", mode: "online" },
        { name: "Aaryav Sinha", mode: "online" },
        { name: "Parzaan Zaveri", mode: "online" },
        { name: "Adrika Das", mode: "online" },
        { name: "Ayaati Chaturvedi", mode: "online" },
        { name: "Sambudhha Ghatak", mode: "online" },
        { name: "Samadrita Sengupta", mode: "online" },
        { name: "Madhuparna Dutta", mode: "online" },
        { name: "Ayesha Vermani", mode: "online" },
        { name: "Zayaan", mode: "online" },
        { name: "Shruti Chatterjee", mode: "online" },
        { name: "Amal Adil", mode: "online" },
        { name: "Sanvi Narula", mode: "online" },
        { name: "Sathvik", mode: "online" },
        { name: "Ishika Mehta", mode: "online" },
        { name: "Karthik Padiga", mode: "online" },
        { name: "Kanav Narula", mode: "online" },
        { name: "Hridhya Yadav", mode: "online" },
        { name: "Richita Sharma", mode: "online" },
        { name: "Shriyansh", mode: "online" },
        { name: "Siddharth Ghosh", mode: "online" },
        { name: "Raina B", mode: "online" },
        { name: "Anishka", mode: "online" },
        { name: "Nivrrithi Arvind", mode: "online" },
        { name: "Aarna", mode: "online" },
        { name: "Jyotiradtiya", mode: "online" },
        { name: "Nishka Lahoti", mode: "online" },
        { name: "Aarna Lahoti", mode: "online" },
        { name: "Harman Bajwa", mode: "online" },
        { name: "Jasmeen Bajwa", mode: "online" },
        { name: "Pritha", mode: "online" },
        { name: "Sharanya Sood", mode: "online" },
        { name: "Sharanya Sengupta", mode: "online" },
        { name: "Meghna", mode: "online" },
        { name: "Sitara", mode: "online" },
        { name: "Panya", mode: "online" },
        { name: "Kapeesh", mode: "online" },
        { name: "Aanya Rekhi", mode: "online" },
        { name: "Harshita Tibrewal", mode: "online" },
        { name: "Hruday Neerukonda", mode: "online" },
        { name: "Angela Tripathi", mode: "online" },
        { name: "Zoya Shah", mode: "online" },
        { name: "Viren Bhattra Bhaika", mode: "online" },
        { name: "Akhil Reddy", mode: "online" },
        { name: "Prathik Reddy", mode: "online" },
        { name: "Priyanka Kumari", mode: "online" },
        { name: "Arika Aggarwal", mode: "online" },
        { name: "Theia Ghista", mode: "online" },
        { name: "Sana Srivastava", mode: "online" },
        { name: "Erina Sarah Preetham", mode: "online" },
        { name: "Layla Sophia Preetham", mode: "online" },
        { name: "Aarush", mode: "online" },
        { name: "Tara Pai", mode: "online" },
        { name: "Naina Pai", mode: "online" },
        { name: "Shiv Trivedi", mode: "online" },
        { name: "Aryan B", mode: "online" },
        { name: "Adhrit Gautam", mode: "online" },
        { name: "Dithya", mode: "online" },
        { name: "Zoya Chhabra", mode: "online" },
        { name: "Om Chhabra", mode: "online" },
        { name: "Fateh Singh Bachher", mode: "online" },
        { name: "Myra Dhanda", mode: "online" },
        { name: "Kuhu Arora", mode: "online" },
        { name: "Prithvi Sanyal", mode: "online" },
        { name: "Dayita", mode: "online" },
        { name: "Siritha Reddy", mode: "online" },
        { name: "Dia Pandya", mode: "online" },
        { name: "Mustafa Ghori", mode: "online" },
        { name: "Ashmi", mode: "online" },
        { name: "Moonis", mode: "online" },
        { name: "Chahak Showkatramani", mode: "online" },
        { name: "Vidya Sagar", mode: "online" },
        { name: "Noel Dhar", mode: "online" },
        { name: "Sana Verma", mode: "online" },
        { name: "Preksha", mode: "online" },
        { name: "Vignesh", mode: "online" },
        { name: "Aanya Srivastava", mode: "online" },
        { name: "Samar Chopra", mode: "online" },
        { name: "Rishit", mode: "online" },
        { name: "Sreeja Mitra", mode: "online" },
        { name: "Kabiir Kathuria", mode: "online" },
        { name: "Komaira C", mode: "online" },
        { name: "Jas", mode: "online" },
        { name: "Anvi", mode: "online" },
        { name: "Aashita", mode: "online" },
        { name: "Aanshika", mode: "online" },
        { name: "Hridaan Hiremath", mode: "online" },
        { name: "Rayhaan Mahajan", mode: "online" },
        { name: "Adwika Biswas", mode: "online" },
        { name: "Arya Chatterjee", mode: "online" },
        { name: "Anay", mode: "online" },
        { name: "Samaira Gupta", mode: "online" },
        { name: "Aishi", mode: "online" },
        { name: "Audrayan", mode: "online" },
        { name: "Ifra Khan", mode: "online" },
        { name: "Shrish Chandra", mode: "online" },
        { name: "Abhay Mahajan", mode: "online" },
        { name: "Veer Rana", mode: "online" },
        { name: "Vanshika Rana", mode: "online" },
        { name: "Krishna Sriram", mode: "online" },
        { name: "Sana George", mode: "online" },
        { name: "Kian George", mode: "online" },
        { name: "Vyom", mode: "online" },
        { name: "Indrakshi", mode: "online" },
        { name: "Dvij", mode: "online" },
        { name: "Aaditya Tiwari", mode: "online" },
        { name: "Shreya Mukherjee", mode: "online" },
        { name: "Nav", mode: "online" },
        { name: "Tia Singh", mode: "online" },
        { name: "Aavir Mahajan", mode: "online" },
        { name: "Anaya Mahajan", mode: "online" },
        { name: "Shreeya Suresh", mode: "online" },
        { name: "Aashira", mode: "online" },
        { name: "Ilina Roy", mode: "online" },
        { name: "Aishleen Abrol", mode: "online" },
        { name: "Kabir", mode: "online" },
        { name: "Kiaan", mode: "online" },
        { name: "Arjun Sarraf", mode: "online" },
        { name: "Rini Ghosh", mode: "online" },
        { name: "Anvika Kabra", mode: "online" },
        { name: "Tanishka Desai", mode: "online" },
        { name: "Vivaan Daruka", mode: "online" },
        { name: "Ahmed", mode: "online" },
        { name: "Aastha Dua", mode: "online" },
        { name: "Simone Vasvani", mode: "online" },
        { name: "Arjan Singh", mode: "online" },
        { name: "Smyaan Gupta", mode: "online" },
        { name: "Myra Mahajan", mode: "online" },
        { name: "Manish", mode: "online" },
        { name: "Nihitha Chakravarthy", mode: "online" },
        { name: "Mysha Kothari", mode: "online" },
        { name: "Archish", mode: "online" },
        { name: "Vatsa Vishal", mode: "online" },
        { name: "Nihaal Rao", mode: "online" },
        { name: "Vihaan Nautiyal", mode: "online" },
        { name: "Varnika", mode: "online" },
        { name: "Rajika Biswas", mode: "online" },
        { name: "Saina Goenka", mode: "online" },
        { name: "Anvi Goenka", mode: "online" },
        { name: "Snigdha Parepalli", mode: "online" },
        { name: "Pearl", mode: "online" },
        { name: "Ayera", mode: "online" },
        { name: "Sivan Reddy", mode: "online" },
        { name: "Advik Kothari", mode: "online" },
        { name: "Izaan", mode: "online" },
        { name: "Mahee", mode: "online" },
        { name: "Delisha", mode: "online" },
        { name: "Garv Agrawala", mode: "online" },
        { name: "Divij Kapoor", mode: "online" },
        { name: "Yogam Vinayak", mode: "online" },
        { name: "Shanaya", mode: "online" },
        { name: "Armaan Mahajan", mode: "online" },
        { name: "Aira Sethi", mode: "online" },
        { name: "Dhwani Modi", mode: "online" },
        { name: "Ehan Sen", mode: "online" },
        { name: "Ashwal", mode: "online" },
        { name: "Yash Singh", mode: "online" },
        { name: "Kulsum Yasir", mode: "online" },
        { name: "Shaurya Jhunjhunwala", mode: "online" },
        { name: "Aadya Gupta", mode: "online" },
        { name: "Aaditya Raval", mode: "online" },
        { name: "Advait Mana", mode: "online" },
        { name: "Ivanya", mode: "online" },
        { name: "Dhriti Agarwal", mode: "online" },
        { name: "Viraaj Agrawal", mode: "online" },
        { name: "Abhranil Pahari", mode: "online" },
        { name: "Chloe Rouch", mode: "online" },
        { name: "Rafael Rouch", mode: "online" },
        { name: "Suprateek Banerjee", mode: "online" },
        { name: "Aanya Agarwal", mode: "online" },
        { name: "Dhruv Gupta", mode: "online" },
        { name: "Gayatri Bhalla", mode: "online" }
    ];

    // Normalize helper
    const normalize = (t) => (t || '').trim().replace(/\s+/g, ' ').toLowerCase();

    try {
        // Load all students once
        const snapshot = await getDocs(collection(db, "students"));
        const map = new Map(); // normalizedName -> [docSnap, ...]

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const n = normalize(data.name);
            if (!map.has(n)) map.set(n, []);
            map.get(n).push({ id: docSnap.id, data });
        });

        let updated = 0;
        let missing = 0;

        for (const s of studentsToUpdate) {
            const desiredMode = (s.mode || '').toLowerCase().includes('online') ? 'online' : 'offline';
            const key = normalize(s.name);
            const matches = map.get(key) || [];

            if (matches.length === 0) {
                console.warn(`Student not found: ${s.name}`);
                missing++;
                continue;
            }

            for (const m of matches) {
                const docRef = doc(db, "students", m.id);
                await updateDoc(docRef, { mode: desiredMode });
                console.log(`Updated ${m.data.name} (id=${m.id}) -> ${desiredMode}`);
                updated++;
            }
        }

        alert(`Bulk update completed. Updated: ${updated}. Not found: ${missing}. See console for details.`);
    } catch (err) {
        console.error('Bulk update failed:', err);
        alert('Bulk update failed. See console for details.');
    }
};

// Filter teachers
window.filterTeachers = function() {
    const searchTerm = document.getElementById("searchTeacher")?.value.toLowerCase() || "";
    const showInactive = document.getElementById("showInactiveTeachers")?.checked || false;

    let filtered = allTeachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm);
        const matchesStatus = showInactive || t.status === "active";
        return matchesSearch && matchesStatus;
    });

    displayTeachers(filtered);
}

// Filter students
window.filterStudents = function() {
    const searchTerm = document.getElementById("searchStudent")?.value.toLowerCase() || "";
    const showInactive = document.getElementById("showInactiveStudents")?.checked || false;

    let filtered = allStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm);
        const matchesStatus = showInactive || s.status === "active";
        return matchesSearch && matchesStatus;
    });

    displayStudents(filtered);
}

// Display teachers
function displayTeachers(filtered) {
    let tl = document.getElementById("teacherList");
    if (!tl) return;

    if (filtered.length === 0) {
        tl.innerHTML = '<tr><td colspan="6" class="empty-state">No teachers found</td></tr>';
        return;
    }

    // Build HTML string first (much faster than innerHTML +=)
    let html = '';

    filtered.forEach((t, index) => {
        const statusClass = t.status === "active" ? "status-active" : "status-inactive";
        const statusText = t.status === "active" ? "Active" : "Inactive";
        const toggleBtnClass = t.status === "active" ? "deactivate" : "activate";
        const toggleBtnText = t.status === "active" ? "Deactivate" : "Activate";
        
        // Default to fulltime if not set
        const empType = t.employmentType || "fulltime";
        const employmentType = empType === "parttime" ? "Part Time" : "Full Time";
        const typeColor = empType === "parttime" ? "#667eea" : "#48bb78";

        html += `
            <tr>
                <td style="text-align: center; font-weight: 500;">${index + 1}</td>
                <td>${t.name}</td>
                <td style="font-family: monospace; color: #666;">${t.password || '<em style="color: #999;">No password</em>'}</td>
                <td><span style="background: ${typeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${employmentType}</span></td>
                <td style="text-align: center;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-btn ${toggleBtnClass}" onclick="toggleTeacherStatus('${t.id}')">${toggleBtnText}</button>
                    <button class="delete-btn" onclick="deleteTeacher('${t.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
    
    // Set innerHTML once (fast)
    tl.innerHTML = html;
}

// Display students
function displayStudents(filtered) {
    let sl = document.getElementById("studentList");
    if (!sl) return;

    if (filtered.length === 0) {
        sl.innerHTML = '<tr><td colspan="7" class="empty-state">No students found</td></tr>';
        return;
    }

    // Build HTML string first (much faster than innerHTML +=)
    let html = '';
    
    filtered.forEach((s, index) => {
        const statusClass = s.status === "active" ? "status-active" : "status-inactive";
        const statusText = s.status === "active" ? "Active" : "Inactive";
        const toggleBtnClass = s.status === "active" ? "deactivate" : "activate";
        const toggleBtnText = s.status === "active" ? "Deactivate" : "Activate";
        const mode = s.mode || "online";
        let modeText = mode.charAt(0).toUpperCase() + mode.slice(1);
        
        // Add centre name for offline students
        if (mode === "offline" && s.offlineCentreName) {
            modeText = `${modeText} (${s.offlineCentreName})`;
        }

        const payType = s.payType || "-";
        const sub = s.sub || "-";

        html += `
            <tr id="row-${s.id}">
                <td style="text-align: center; font-weight: 500;">${index + 1}</td>
                <td>${s.name}</td>
                <td style="text-align: center;">${modeText}</td>
                <td style="text-align: center; padding: 8px;">
                    <span id="payType-display-${s.id}">${payType}</span>
                    <select id="payType-edit-${s.id}" style="display: none; width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Roboto', sans-serif; background: white;">
                        <option value="">-</option>
                        <option value="monthly">Monthly</option>
                        <option value="per class">Per Class</option>
                        <option value="lump sum">Lump Sum</option>
                        <option value="custom">Custom</option>
                    </select>
                </td>
                <td style="text-align: center; padding: 8px;">
                    <span id="sub-display-${s.id}">${sub}</span>
                    <input type="text" id="sub-edit-${s.id}" style="display: none; width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Roboto', sans-serif;" placeholder="-">
                </td>
                <td style="text-align: center;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <button id="edit-btn-${s.id}" class="toggle-btn activate" onclick="enableStudentEdit('${s.id}', '${s.payType || ''}', '${s.sub || ''}')" style="margin-right: 4px;">Edit</button>
                    <button id="save-btn-${s.id}" class="toggle-btn" onclick="saveStudentEdit('${s.id}')" style="display: none; margin-right: 4px; background: #48bb78;">OK</button>
                    <button class="toggle-btn ${toggleBtnClass}" onclick="toggleStudentStatus('${s.id}')">${toggleBtnText}</button>
                    <button class="delete-btn" onclick="deleteStudent('${s.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
    
    // Set innerHTML once (fast)
    sl.innerHTML = html;
}

// Load student report
window.loadStudentReport = async function() {
    const selectedStudent = document.getElementById("searchStudentReport")?.value;
    const selectedStudentId = document.getElementById("selectedStudentId")?.value;
    const timePeriod = document.getElementById("timePeriodFilter")?.value || "30";
    const sortOrder = document.getElementById("sortOrderFilter")?.value || "desc";
    const div = document.getElementById("report");
    
    if (!div) return;

    if (!selectedStudent) {
        div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.3);">
            <p>Please select a student to view their report.</p>
        </div>`;
        return;
    }

    div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px;">
        <p>Loading report...</p>
    </div>`;

    try {
        // Calculate date filter
        let dateFilter = null;
        let dateFilterEnd = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('timePeriodCustomFrom')?.value;
            const to = document.getElementById('timePeriodCustomTo')?.value;
            // Parse dates using local Date(year, monthIndex, day) to avoid timezone parsing issues
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };

            if (from) dateFilter = parseLocalDateStart(from);
            if (to) dateFilterEnd = parseLocalDateEnd(to);
            // If no valid from/to provided, fall back to default null (show all)
            if (!dateFilter && !dateFilterEnd) dateFilter = null;
        } else if (timePeriod !== "all") {
            const daysAgo = parseInt(timePeriod);
            dateFilter = new Date();
            dateFilter.setDate(dateFilter.getDate() - daysAgo);
        }

        // Query entries for the selected student
        const entriesQuery = query(
            collection(db, "entries"),
            where("studentName", "==", selectedStudent)
        );

        const snapshot = await getDocs(entriesQuery);
        
        // Fetch payment history for the student
        let paymentHistory = [];
        if (selectedStudentId) {
            try {
                const paymentsRef = collection(db, 'students', selectedStudentId, 'payments');
                const paymentsQuery = query(paymentsRef, orderBy('createdAt', 'desc'));
                const paymentsSnapshot = await getDocs(paymentsQuery);
                
                paymentsSnapshot.forEach(doc => {
                    paymentHistory.push({
                        id: doc.id,
                        ...doc.data(),
                        __type: 'payment'
                    });
                });
            } catch (error) {
                console.error('Error fetching payment history:', error);
            }
        }

        // Process class entries
        let results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            __type: 'class'
        }));

        // Apply time period filter to class entries (prefer class date `e.date`, fall back to createdAt)
        if (dateFilter || dateFilterEnd) {
            results = results.filter(e => {
                let entryDate = null;
                if (e.date) {
                    // Parse e.date as local date (avoid timezone shifts)
                    const parts = ('' + e.date).split('-').map(Number);
                    if (parts.length >= 3) {
                        const p = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                        if (!isNaN(p.getTime())) entryDate = p;
                    } else {
                        const parsed = new Date(e.date + 'T00:00:00');
                        if (!isNaN(parsed.getTime())) entryDate = parsed;
                    }
                }
                if (!entryDate && e.createdAt) {
                    entryDate = e.createdAt.toDate();
                }
                if (!entryDate) return false;

                if (dateFilter && dateFilterEnd) {
                    return entryDate >= dateFilter && entryDate <= dateFilterEnd;
                } else if (dateFilter) {
                    return entryDate >= dateFilter;
                } else if (dateFilterEnd) {
                    return entryDate <= dateFilterEnd;
                }
                return true;
            });
        }

        // Apply time period filter to payment history (use payment period start date, not creation date)
        if (dateFilter || dateFilterEnd) {
            paymentHistory = paymentHistory.filter(p => {
                let paymentDate = null;
                
                // Priority: Use payment period start date
                if (p.paymentType === 'monthly' && p.dateFrom) {
                    // Parse dateFrom (YYYY-MM-DD format)
                    const parts = ('' + p.dateFrom).split('-').map(Number);
                    if (parts.length >= 3) {
                        paymentDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                    }
                } else if (p.validFrom) {
                    // For lumpSum/custom with validFrom
                    const parts = ('' + p.validFrom).split('-').map(Number);
                    if (parts.length >= 3) {
                        paymentDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                    }
                }
                
                // Fallback to creation date if no payment period date available
                if (!paymentDate && p.createdAt && typeof p.createdAt.toDate === 'function') {
                    paymentDate = p.createdAt.toDate();
                }
                
                if (!paymentDate) return false;

                if (dateFilter && dateFilterEnd) {
                    return paymentDate >= dateFilter && paymentDate <= dateFilterEnd;
                } else if (dateFilter) {
                    return paymentDate >= dateFilter;
                } else if (dateFilterEnd) {
                    return paymentDate <= dateFilterEnd;
                }
                return true;
            });
        }

        // Combine entries and payments, then sort by date
        const combinedHistory = [...results, ...paymentHistory];
        
        combinedHistory.sort((a, b) => {
            const getDate = (x) => {
                if (x.__type === 'payment') {
                    // Use payment period start date for sorting
                    if (x.paymentType === 'monthly' && x.dateFrom) {
                        const parts = ('' + x.dateFrom).split('-').map(Number);
                        if (parts.length >= 3) {
                            const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                            if (!isNaN(d.getTime())) return d;
                        }
                    } else if (x.validFrom) {
                        const parts = ('' + x.validFrom).split('-').map(Number);
                        if (parts.length >= 3) {
                            const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                            if (!isNaN(d.getTime())) return d;
                        }
                    }
                    // Fallback to creation date
                    return x.createdAt && typeof x.createdAt.toDate === 'function' ? x.createdAt.toDate() : new Date(0);
                } else {
                    // Class entry
                    if (x.date) {
                        const parts = ('' + x.date).split('-').map(Number);
                        if (parts.length >= 3) {
                            const p = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                            if (!isNaN(p.getTime())) return p;
                        }
                        const p = new Date(x.date + 'T00:00:00');
                        if (!isNaN(p.getTime())) return p;
                    }
                    if (x.createdAt) return x.createdAt.toDate();
                    return new Date(0);
                }
            };
            const dateA = getDate(a);
            const dateB = getDate(b);
            // Apply sort order: desc = newest first, asc = oldest first
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        if (combinedHistory.length === 0) {
            div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.3);">
                <p>No classes or payments found for "${selectedStudent}" in the selected time period.</p>
            </div>`;
            return;
        }

        // Calculate statistics
        const totalClasses = results.reduce((sum, e) => sum + parseFloat(e.classCount || 1), 0);
        const teachers = [...new Set(results.map(e => e.teacherName || e.teacher).filter(Boolean))];
        const classPaymentTotal = results.reduce((sum, e) => {
            const payment = e.payment || "0";
            const amount = parseInt(payment.replace(/[^0-9]/g, '') || 0);
            return sum + amount;
        }, 0);
        
        // Calculate payment structure total
        const paymentStructureTotal = paymentHistory.reduce((sum, p) => {
            let amount = 0;
            if (p.paymentType === 'monthly') {
                amount = parseFloat(p.amount || p.monthlyFee || 0);
            } else if (p.paymentType === 'perClass') {
                amount = parseFloat(p.totalAmount || 0);
            } else if (p.paymentType === 'lumpSum') {
                amount = parseFloat(p.totalAmount || 0);
            } else if (p.paymentType === 'custom') {
                amount = parseFloat(p.amount || 0);
            }
            return sum + amount;
        }, 0);

        const totalPayment = classPaymentTotal + paymentStructureTotal;

        // Build report HTML
        let html = `
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: #2c2c2c; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(44, 44, 44, 0.2);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${results.length}</div>
                    <div style="font-size: 13px; opacity: 0.9; font-family: 'Roboto', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Total Sessions</div>
                </div>
                <div style="background: #90ee90; color: #2c2c2c; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(144, 238, 144, 0.3);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${totalClasses.toFixed(1)}</div>
                    <div style="font-size: 13px; opacity: 0.85; font-family: 'Roboto', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Total Classes</div>
                </div>
                <div style="background: #1a73e8; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${teachers.length}</div>
                    <div style="font-size: 13px; opacity: 0.9; font-family: 'Roboto', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Teachers</div>
                </div>
                <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${paymentHistory.length}</div>
                    <div style="font-size: 13px; opacity: 0.9; font-family: 'Roboto', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Records</div>
                </div>
            </div>

            <!-- Teachers List -->
            ${teachers.length > 0 ? `<div style="background: rgba(255, 255, 255, 0.95); padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(44, 44, 44, 0.1); border: 1px solid rgba(212, 175, 55, 0.3);">
                <strong style="font-family: 'Roboto', sans-serif; font-size: 14px; color: #2c2c2c;">Teachers:</strong> 
                <span style="font-family: 'Roboto', sans-serif; font-size: 14px; color: #666666;">${teachers.join(", ")}</span>
            </div>` : ''}

            <!-- Combined History (Classes + Payments) -->
            <div style="background: rgba(255, 255, 255, 0.95); border-radius: 8px; padding: 20px; box-shadow: 0 1px 4px rgba(44, 44, 44, 0.1); border: 1px solid rgba(212, 175, 55, 0.3);">
                <h3 style="margin: 0 0 20px 0; color: #2c2c2c; font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 18px; border-bottom: 1px solid #e8eaed; padding-bottom: 12px;">Combined History (Classes & Payments)</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        combinedHistory.forEach(item => {
            if (item.__type === 'payment') {
                // Render payment record
                // Use payment period start date for display (priority: dateFrom, validFrom, then createdAt)
                let displayDate = 'N/A';
                if (item.paymentType === 'monthly' && item.dateFrom) {
                    displayDate = formatDateDDMMYYYY(new Date(item.dateFrom + 'T00:00:00'));
                } else if (item.validFrom) {
                    displayDate = formatDateDDMMYYYY(new Date(item.validFrom + 'T00:00:00'));
                } else if (item.createdAt?.toDate) {
                    displayDate = formatDateDDMMYYYY(item.createdAt.toDate());
                }
                
                const createdDate = item.createdAt?.toDate ? formatDateDDMMYYYY(item.createdAt.toDate()) : 'N/A';
                let typeIcon = '📅';
                let typeName = 'Monthly';
                let details = '';
                
                if (item.paymentType === 'monthly') {
                    typeIcon = '📅';
                    typeName = 'Monthly Recurring';
                    details = `Amount: ₹${item.amount || item.monthlyFee || 0}${item.dateFrom ? ` | Period: ${item.dateFrom} to ${item.dateTo || 'Ongoing'}` : ''}${item.advanced > 0 ? ` | Advanced: ₹${item.advanced}` : ''}`;
                } else if (item.paymentType === 'perClass') {
                    typeIcon = '📚';
                    typeName = 'Per Class';
                    const subjectCount = item.subjects?.length || item.numberOfSubjects || 0;
                    details = `Amount: ₹${item.totalAmount || 0} | Subjects: ${subjectCount}`;
                } else if (item.paymentType === 'lumpSum') {
                    typeIcon = '💰';
                    typeName = 'Lump Sum';
                    details = `Amount: ₹${item.totalAmount || 0}${item.timePeriod ? ` | Period: ${item.timePeriod}` : ''}${item.validFrom ? ` | Valid From: ${item.validFrom}` : ''}`;
                } else if (item.paymentType === 'custom') {
                    typeIcon = '⚙️';
                    typeName = 'Custom';
                    details = `Amount: ₹${item.amount || 0}${item.timePeriod ? ` | Period: ${item.timePeriod}` : ''}${item.validFrom ? ` | Valid From: ${item.validFrom}` : ''}`;
                }
                
                html += `
                <div style="background: linear-gradient(135deg, #667eea15, #764ba215); border-left: 4px solid #667eea; padding: 16px; border-radius: 4px; box-shadow: 0 1px 3px rgba(44, 44, 44, 0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 600; color: #667eea; font-size: 15px; font-family: 'Roboto', sans-serif;">${typeIcon} ${typeName}</div>
                            <div style="color: #666; font-size: 13px; margin-top: 4px; font-family: 'Roboto', sans-serif;">Payment Date: ${displayDate}</div>
                            ${displayDate !== createdDate ? `<div style="color: #999; font-size: 12px; margin-top: 2px; font-family: 'Roboto', sans-serif;">Created: ${createdDate}</div>` : ''}
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #444; font-family: 'Roboto', sans-serif; margin-bottom: 8px;">${details}</div>
                    ${item.remarks ? `<div style="padding: 8px 12px; background: #f8f9fa; border-radius: 4px; font-size: 13px; color: #666; font-family: 'Roboto', sans-serif;"><strong>Remarks:</strong> ${item.remarks}</div>` : ''}
                </div>
                `;
            } else {
                // Render class entry
                const teacherName = item.teacherName || item.teacher || "N/A";
                const topic = item.topic || "No topic specified";
                const sheetMade = item.sheetMade === "yes" ? "Yes" : "No";
                const classDate = item.date ? formatDateDDMMYYYY(new Date(item.date + 'T00:00:00')) : "N/A";
                
                html += `
                <div style="background: rgba(248, 249, 250, 0.8); border-left: 4px solid #90ee90; padding: 16px; border-radius: 4px; box-shadow: 0 1px 3px rgba(44, 44, 44, 0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 500; color: #2c2c2c; font-size: 15px; font-family: 'Roboto', sans-serif;">${classDate} <span style="color: #666666; font-size: 13px; font-weight: 400; margin-left: 8px;">${item.dayOfWeek || ""}</span></div>
                            <div style="color: #1a73e8; font-size: 13px; font-weight: 500; margin-top: 4px; font-family: 'Roboto', sans-serif;">Teacher: ${teacherName}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 13px; color: #666666; font-family: 'Roboto', sans-serif;">${item.timeFrom || item.startTime || "N/A"} - ${item.timeTo || item.endTime || "N/A"}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 13px; color: #666666; font-family: 'Roboto', sans-serif;">
                        <div><strong style="color: #2c2c2c;">Classes:</strong> ${item.classCount || "N/A"}</div>
                        <div><strong style="color: #2c2c2c;">Sheet Made:</strong> ${sheetMade}</div>
                    </div>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed;">
                        <strong style="color: #2c2c2c; font-size: 13px; font-family: 'Roboto', sans-serif;">Topic:</strong>
                        <div style="color: #666666; font-size: 13px; margin-top: 4px; font-family: 'Roboto', sans-serif; line-height: 1.5;">${topic}</div>
                    </div>
                </div>
                `;
            }
        });

        html += `
                </div>
            </div>
        `;

        div.innerHTML = html;
    } catch (error) {
        console.error("Error loading student report:", error);
        div.innerHTML = `<div style="text-align: center; padding: 48px; color: #d93025; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid #d93025;">
            <p>Error loading report. Please try again.</p>
            <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
        </div>`;
    }
}

// Show tab
window.showTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + '-tab').style.display = 'block';

    // Add active class to clicked button
    event.target.classList.add('active');

    // Load data based on tab
    if (tabName === 'teachers') {
        filterTeachers();
        if (typeof window.loadAccountabilityTracker === 'function') {
            window.loadAccountabilityTracker();
        }
    } else if (tabName === 'students') {
        filterStudents();
    } else if (tabName === 'entries') {
        loadAdminEntries();
    } else if (tabName === 'reports') {
        loadStudentsForReport();
    } else if (tabName === 'classesdata') {
        loadClassesData();
    } else if (tabName === 'doubtsessions') {
        loadSessionReports();
    }
}

// Load students into report dropdown
let allStudentsForReport = [];

async function loadStudentsForReport() {
    try {
        const studentsQuery = query(
            collection(db, "students"),
            where("status", "==", "active")
        );
        
        const snapshot = await getDocs(studentsQuery);
        
        allStudentsForReport = [];
        snapshot.docs.forEach(doc => {
            const student = doc.data();
            allStudentsForReport.push({
                id: doc.id,
                name: student.name
            });
        });
        
        // Sort alphabetically
        allStudentsForReport.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    } catch (error) {
        console.error("Error loading students for report:", error);
    }
}

// Filter student list based on search input
window.filterStudentList = function() {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    
    if (!searchInput || !dropdown) return;
    
    const searchValue = searchInput.value.toLowerCase().trim();
    
    if (searchValue.length === 0) {
        dropdown.style.display = "none";
        return;
    }
    
    // Filter students that match the search
    const filtered = allStudentsForReport.filter(student => 
        student.name.toLowerCase().includes(searchValue)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #666666; font-family: \'Roboto\', sans-serif; font-size: 14px;">No students found</div>';
        dropdown.style.display = "block";
        return;
    }
    
    // Build dropdown HTML
    let html = '';
    filtered.forEach(student => {
        const highlightedName = highlightMatch(student.name, searchValue);
        html += `<div onclick="selectStudent('${student.name.replace(/'/g, "\\'")}', '${student.id}')" style="padding: 10px 12px; cursor: pointer; font-family: 'Roboto', sans-serif; font-size: 14px; color: #2c2c2c; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">${highlightedName}</div>`;
    });
    
    dropdown.innerHTML = html;
    dropdown.style.display = "block";
}

// Highlight matching text
function highlightMatch(text, search) {
    const regex = new RegExp(`(${search})`, 'gi');
    return text.replace(regex, '<strong style="color: #d4af37; font-weight: 600;">$1</strong>');
}

// Show student dropdown
window.showStudentDropdown = function() {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    
    if (!searchInput || !dropdown) return;
    
    if (searchInput.value.trim().length > 0) {
        filterStudentList();
    } else if (allStudentsForReport.length > 0) {
        // Show all students if no search text
        let html = '';
        allStudentsForReport.forEach(student => {
            html += `<div onclick="selectStudent('${student.name.replace(/'/g, "\\'")}', '${student.id}')" style="padding: 10px 12px; cursor: pointer; font-family: 'Roboto', sans-serif; font-size: 14px; color: #2c2c2c; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">${student.name}</div>`;
        });
        dropdown.innerHTML = html;
        dropdown.style.display = "block";
    }
}

// Handle time period change - show/hide custom inputs
window.onTimePeriodChange = function() {
    const sel = document.getElementById('timePeriodFilter');
    const custom = document.getElementById('customTimeRange');
    if (!sel || !custom) return;
    if (sel.value === 'custom') {
        custom.style.display = 'block';
    } else {
        custom.style.display = 'none';
    }
};

// Select student from dropdown
window.selectStudent = function(studentName, studentId) {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    const hiddenInput = document.getElementById("selectedStudentId");
    
    if (searchInput) searchInput.value = studentName;
    if (hiddenInput) hiddenInput.value = studentId;
    if (dropdown) dropdown.style.display = "none";
    
    // Load report for selected student
    loadStudentReport();
}

// Hide dropdown when clicking outside
document.addEventListener('click', function(event) {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    
    if (searchInput && dropdown && !searchInput.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.style.display = "none";
    }
});

// Admin page initialization
if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        const loginSection = document.getElementById("login-section");
        const dashboardSection = document.getElementById("dashboard");
        const logoutBtn = document.getElementById("logout-btn");

        // Check if admin is logged in
        if (localStorage.getItem("role") === "admin") {
            if (loginSection) loginSection.style.display = "none";
            if (dashboardSection) dashboardSection.style.display = "block";
            syncAccountabilityCycle().catch(err => console.error('Accountability sync failed:', err));
            initializeData();
            filterTeachers();
            if (typeof window.loadAccountabilityTracker === 'function') {
                window.loadAccountabilityTracker();
            }
        } else {
            if (loginSection) loginSection.style.display = "flex";
            if (dashboardSection) dashboardSection.style.display = "none";
        }

        const REGISTERED_ADMIN_EMAILS = ["rishabhsunny25@gmail.com", "info@zielclasses.com"];

        // Send OTP button
        const sendOtpBtn = document.getElementById("send-otp-btn");
        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', async function() {
                const enteredEmail = (document.getElementById("admin-email")?.value || "").trim().toLowerCase();
                const errorMsg = document.getElementById("error-msg");

                if (!enteredEmail) {
                    if (errorMsg) errorMsg.textContent = "Please enter your email.";
                    return;
                }

                if (!REGISTERED_ADMIN_EMAILS.includes(enteredEmail)) {
                    if (errorMsg) errorMsg.textContent = "Email not registered as admin.";
                    return;
                }

                sendOtpBtn.disabled = true;
                sendOtpBtn.textContent = "Sending...";
                if (errorMsg) errorMsg.textContent = "";

                try {
                    adminOTP = generateOTP();
                    otpTimestamp = Date.now();

                    await sendOTPEmail(adminOTP, enteredEmail);

                    document.getElementById("email-step").style.display = "none";
                    document.getElementById("otp-step").style.display = "block";

                    const maskedEmail = document.getElementById("masked-email");
                    if (maskedEmail) {
                        maskedEmail.textContent = enteredEmail.replace(/(.{2}).*@/, "$1***@");
                    }
                } catch (error) {
                    if (errorMsg) errorMsg.textContent = "Failed to send OTP. Please try again.";
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = "Send OTP to Email";
                }
            });
        }

        // Verify OTP button
        const verifyOtpBtn = document.getElementById("verify-otp-btn");
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', function() {
                const enteredOTP = (document.getElementById("otp-input")?.value || "").trim();
                const errorMsg = document.getElementById("error-msg");

                if (!enteredOTP) {
                    if (errorMsg) errorMsg.textContent = "Please enter the OTP.";
                    return;
                }

                verifyOtpBtn.disabled = true;
                verifyOtpBtn.textContent = "Verifying...";

                const result = verifyOTP(enteredOTP);
                if (result.valid) {
                    localStorage.setItem("role", "admin");
                    localStorage.setItem("adminLoginTime", Date.now().toString());
                    localStorage.removeItem("teacherName");
                    localStorage.removeItem("teacherId");
                    localStorage.removeItem("currentTeacherName");

                    if (loginSection) loginSection.style.display = "none";
                    if (dashboardSection) dashboardSection.style.display = "block";
                    syncAccountabilityCycle().catch(err => console.error('Accountability sync failed:', err));
                    initializeData();
                    filterTeachers();
                    if (typeof window.loadAccountabilityTracker === 'function') {
                        window.loadAccountabilityTracker();
                    }
                } else {
                    if (errorMsg) errorMsg.textContent = result.message;
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.textContent = "Verify OTP";
                }
            });
        }

        // Resend OTP & Change Email buttons
        ["resend-otp-btn", "change-email-btn"].forEach(id => {
            document.getElementById(id)?.addEventListener('click', function() {
                document.getElementById("email-step").style.display = "block";
                document.getElementById("otp-step").style.display = "none";

                const errorMsg = document.getElementById("error-msg");
                if (errorMsg) errorMsg.textContent = "";

                if (sendOtpBtn) {
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = "Send OTP to Email";
                }
            });
        });

        // Logout button
        logoutBtn?.addEventListener('click', function() {
            localStorage.removeItem("role");
            localStorage.removeItem("adminLoginTime");
            if (loginSection) loginSection.style.display = "flex";
            if (dashboardSection) dashboardSection.style.display = "none";
            if (accountabilityTrackerUnsubscribe) {
                accountabilityTrackerUnsubscribe();
                accountabilityTrackerUnsubscribe = null;
            }
        });
        
        // Sort field and order change listeners
        const sortField = document.getElementById("sortField");
        const sortOrder = document.getElementById("sortOrder");
        
        if (sortField) {
            sortField.addEventListener('change', function() {
                if (filteredAdminEntries && filteredAdminEntries.length > 0) {
                    applyAdminFilters();
                }
            });
        }
        
        if (sortOrder) {
            sortOrder.addEventListener('change', function() {
                if (filteredAdminEntries && filteredAdminEntries.length > 0) {
                    applyAdminFilters();
                }
            });
        }
    });
}

// ========== HELPER FUNCTIONS FOR LOADING ENTRIES ==========

// Load entries for specific teacher (Step 3)
window.loadTeacherEntries = async function() {
    const teacherId = localStorage.getItem("teacherId");

    if (!teacherId) {
        throw new Error("Teacher ID missing! Please log in again.");
    }

    const q = query(
        collection(db, "entries"),
        where("teacherId", "==", teacherId),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const results = [];

    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    return results; // array of entries belonging to that teacher (by ID)
};

// Load all entries for admin (Step 4)
window.loadAllEntries = async function() {
    const snapshot = await getDocs(collection(db, "entries"));
    const results = [];

    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    return results; // array of all entries
};

// Refresh a collection list and cache locally for offline fallback.
window.updateLocalDataList = async function(collectionName) {
    try {
        await ensureAuthReady();
        const querySnapshot = await getDocs(collection(db, collectionName));
        const dataList = [];

        querySnapshot.forEach((docSnap) => {
            dataList.push({ id: docSnap.id, ...docSnap.data() });
        });

        localStorage.setItem(`list_${collectionName}`, JSON.stringify(dataList));
        console.log(`${collectionName} List Updated!`);
        return dataList;
    } catch (error) {
        console.error('Update failed:', error);
        const cached = localStorage.getItem(`list_${collectionName}`);
        return cached ? JSON.parse(cached) : [];
    }
};

window.enableAlerts = async function() {
    return window.setupNotifications();
};

window.startUpdateLoop = function(collectionNames = [], intervalMs = 30 * 60 * 1000, loopKey = 'default') {
    if (!Array.isArray(collectionNames) || collectionNames.length === 0) return;

    if (!window.__updateLoops) {
        window.__updateLoops = {};
    }

    const loop = {
        key: loopKey,
        collectionNames: [...collectionNames],
        intervalMs,
        intervalId: null,
        run: null,
    };

    const runUpdate = async () => {
        if (document.visibilityState !== 'visible') {
            return;
        }

        if (!navigator.onLine) {
            return;
        }

        for (const collectionName of collectionNames) {
            await window.updateLocalDataList(collectionName);
        }
    };

    loop.run = runUpdate;
    window.__updateLoops[loopKey] = loop;

    runUpdate();

    if (loop.intervalId) {
        clearInterval(loop.intervalId);
    }

    loop.intervalId = setInterval(runUpdate, intervalMs);

    if (!window.__updateLoopOnlineHandler) {
        window.__updateLoopOnlineHandler = () => {
            const loops = Object.values(window.__updateLoops || {});
            loops.forEach((activeLoop) => {
                if (typeof activeLoop.run === 'function') {
                    activeLoop.run();
                }
            });
        };
        window.addEventListener('online', window.__updateLoopOnlineHandler);
    }

    if (!window.__updateLoopVisibilityHandler) {
        window.__updateLoopVisibilityHandler = () => {
            const loops = Object.values(window.__updateLoops || {});

            if (document.visibilityState === 'visible') {
                loops.forEach((activeLoop) => {
                    if (activeLoop.intervalId) {
                        clearInterval(activeLoop.intervalId);
                    }

                    if (typeof activeLoop.run === 'function') {
                        activeLoop.run();
                        activeLoop.intervalId = setInterval(activeLoop.run, activeLoop.intervalMs || (30 * 60 * 1000));
                    }
                });
                return;
            }

            loops.forEach((activeLoop) => {
                if (activeLoop.intervalId) {
                    clearInterval(activeLoop.intervalId);
                    activeLoop.intervalId = null;
                }
            });
        };
        document.addEventListener('visibilitychange', window.__updateLoopVisibilityHandler);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (!window.__appFeaturesInitialized) {
        window.__appFeaturesInitialized = true;
        initializeAppFeatures();
    }
});

// ========== PAGE INITIALIZATION ==========

// Teacher page initialization
if (window.location.pathname.includes('teacher.html')) {
    document.addEventListener('DOMContentLoaded', async function() {
        // Check if teacher is logged in
        const role = localStorage.getItem("role");
        let teacherName = localStorage.getItem("teacherName") || localStorage.getItem("currentTeacherName");
        const teacherId = localStorage.getItem("teacherId");

        console.log("Teacher page check:", { role, teacherName, teacherId });

        if (role !== "teacher" && role !== "admin") {
            console.error("Role check failed:", role);
            alert("Please login first! Role: " + role);
            window.location.href = "index.html";
            return;
        }

        if (role === "teacher") {
            if (!teacherId) {
                console.error("Teacher ID missing for teacher role");
                alert("Session data missing. Please login again.");
                window.location.href = "index.html";
                return;
            }

            if (!teacherName) {
                try {
                    const teacherDoc = await getDoc(doc(db, "teachers", teacherId));
                    if (teacherDoc.exists()) {
                        const recoveredName = teacherDoc.data()?.name;
                        if (recoveredName) {
                            teacherName = recoveredName;
                            localStorage.setItem("teacherName", recoveredName);
                            localStorage.setItem("currentTeacherName", recoveredName);
                            const teacherInfoEl = document.getElementById("teacherInfo");
                            if (teacherInfoEl) {
                                teacherInfoEl.textContent = `Logged in as: ${recoveredName}`;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to recover teacher name from Firestore:", error);
                }

                if (!teacherName) {
                    console.error("Teacher name missing and could not be recovered");
                    alert("Teacher session expired. Please login again.");
                    window.location.href = "index.html";
                    return;
                }
            }
        }

        console.log("Authentication passed, loading data...");
        loadLists();
        loadRecentEntries();

        if (role === 'teacher') {
            await syncNotificationTokenSilently();
            runReminderEngine();
            if (!window.__reminderIntervalId) {
                window.__reminderIntervalId = setInterval(runReminderEngine, 60000);
            }

            window.startUpdateLoop(['students', 'entries', 'teachers'], 30 * 60 * 1000);
        }
        
        // Setup form submission
        const form = document.getElementById("entryForm");
        if (form) {
            form.addEventListener("submit", saveEntry);
            console.log("Form submit listener attached");
        } else {
            console.error("Entry form not found!");
        }
    });
}

if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/public/')) {
    document.addEventListener('DOMContentLoaded', function() {
        window.startUpdateLoop(['teachers'], 30 * 60 * 1000, 'index-teachers');
    });
}

if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Admin needs faster visibility for fresh logs.
        window.startUpdateLoop(['entries', 'doubt_sessions'], 5 * 60 * 1000, 'admin-fast');
        // Less volatile data can stay on slower sync.
        window.startUpdateLoop(['teachers', 'students'], 30 * 60 * 1000, 'admin-slow');
    });
}

// ========== ADMIN PANEL FUNCTIONS ==========

// Load admin panel data
window.loadAdminLists = function() {
    initializeData();
    loadAdminEntries(); // Load all entries for admin
};

// Load all entries for admin panel
// ========== ADMIN ENTRIES DASHBOARD ==========

let allAdminEntries = [];
let filteredAdminEntries = [];
let currentPage = 1;
let entriesPerPage = 25;

// Load all admin entries with stats
window.loadAdminEntries = async function() {
    const entriesList = document.getElementById("admin-entries-list");
    if (!entriesList) return;

    try {
        await ensureAuthReady();
        // Get all entries (no limit)
        const entriesSnapshot = await getDocs(collection(db, "entries"));
        
        // Get all doubt/demo sessions
        const sessionsSnapshot = await getDocs(collection(db, "doubt_sessions"));
        
        // Store all entries
        allAdminEntries = [];
        
        // Add regular entries
        entriesSnapshot.forEach(doc => {
            allAdminEntries.push({
                id: doc.id,
                type: 'entry',
                ...doc.data()
            });
        });
        
        // Add doubt/demo sessions
        sessionsSnapshot.forEach(doc => {
            allAdminEntries.push({
                id: doc.id,
                type: 'doubt_session',
                ...doc.data()
            });
        });

        if (allAdminEntries.length === 0) {
            entriesList.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding: 40px; text-align: center; color: #7f8c8d;">No entries found. Teachers can create entries from their dashboard.</td></tr>';
            updateEntryStats([], []);
            return;
        }

        // Sort by createdAt descending (newest first)
        allAdminEntries.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        // Populate filter dropdowns
        populateFilterDropdowns();

        // Initially show all entries
        filteredAdminEntries = [...allAdminEntries];
        
        // Apply default sorting (date descending)
        applySorting();
        
        currentPage = 1;
        
        // Update display
        displayAdminEntries();
        updateEntryStats(allAdminEntries, filteredAdminEntries);
        
    } catch (error) {
        console.error("Error loading admin entries:", error);
        entriesList.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding: 40px; text-align: center; color: red;">Error loading entries. Check console.</td></tr>';
    }
};

// Populate filter dropdowns from existing data
function populateFilterDropdowns() {
    const teacherMap = new Map(); // Map teacher names to emails
    const students = new Set();
    
    allAdminEntries.forEach(entry => {
        if (entry.teacherName) {
            teacherMap.set(entry.teacherName, entry.teacherEmail || '');
        }
        // Handle both regular entries and doubt sessions
        const studentName = entry.studentName || entry.student;
        if (studentName) students.add(studentName);
    });
    
    // Populate teacher dropdown with emails
    const teacherFilter = document.getElementById("filterTeacher");
    if (teacherFilter) {
        const currentValue = teacherFilter.value;
        teacherFilter.innerHTML = '<option value="">All Teachers</option>';
        
        Array.from(teacherMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([name, email]) => {
                const displayText = email ? `${name} (${email})` : name;
                const selected = name === currentValue ? 'selected' : '';
                teacherFilter.innerHTML += `<option value="${name}" ${selected}>${displayText}</option>`;
            });
    }
    
    // Populate student dropdown
    const studentFilter = document.getElementById("filterStudent");
    if (studentFilter) {
        const currentValue = studentFilter.value;
        studentFilter.innerHTML = '<option value="">All Students</option>';
        Array.from(students).sort().forEach(student => {
            studentFilter.innerHTML += `<option value="${student}" ${student === currentValue ? 'selected' : ''}>${student}</option>`;
        });
    }
}

// Apply filters
window.applyAdminFilters = function() {
    const dateFrom = document.getElementById("filterDateFrom")?.value;
    const dateTo = document.getElementById("filterDateTo")?.value;
    const teacher = document.getElementById("filterTeacher")?.value;
    const student = document.getElementById("filterStudent")?.value;
    const sheetMade = document.getElementById("filterSheetMade")?.value;
    const search = document.getElementById("filterSearch")?.value.toLowerCase();
    
    filteredAdminEntries = allAdminEntries.filter(entry => {
        // Date range filter
        if (dateFrom && entry.date < dateFrom) return false;
        if (dateTo && entry.date > dateTo) return false;
        
        // Teacher filter
        if (teacher && entry.teacherName !== teacher) return false;
        
        // Student filter
        const entryStudent = entry.studentName || entry.student;
        if (student && entryStudent !== student) return false;
        
        // Sheet made filter
        if (sheetMade && entry.sheetMade !== sheetMade) return false;
        
        // Search filter (topic)
        if (search && !entry.topic?.toLowerCase().includes(search)) return false;
        
        return true;
    });
    
    // Apply sorting
    applySorting();
    
    currentPage = 1;
    displayAdminEntries();
    updateEntryStats(allAdminEntries, filteredAdminEntries);
};

// Function to apply sorting to filtered entries
function applySorting() {
    const sortField = document.getElementById("sortField")?.value || "date";
    const sortOrder = document.getElementById("sortOrder")?.value || "desc";
    
    filteredAdminEntries.sort((a, b) => {
        let valueA, valueB;
        
        switch(sortField) {
            case 'date':
                valueA = a.date || '';
                valueB = b.date || '';
                break;
            case 'teacher':
                valueA = (a.teacherName || '').toLowerCase();
                valueB = (b.teacherName || '').toLowerCase();
                break;
            case 'student':
                valueA = (a.studentName || a.student || '').toLowerCase();
                valueB = (b.studentName || b.student || '').toLowerCase();
                break;
            case 'time':
                valueA = a.timeFrom || a.startTime || '';
                valueB = b.timeFrom || b.startTime || '';
                break;
            case 'classes':
                valueA = parseInt(a.classCount) || 0;
                valueB = parseInt(b.classCount) || 0;
                break;
            case 'sheet':
                valueA = a.sheetMade === 'yes' ? 1 : 0;
                valueB = b.sheetMade === 'yes' ? 1 : 0;
                break;
            case 'payment':
                valueA = (a.payment || '').toLowerCase();
                valueB = (b.payment || '').toLowerCase();
                break;
            case 'subject':
                valueA = (a.subject || '').toLowerCase();
                valueB = (b.subject || '').toLowerCase();
                break;
            case 'topic':
                valueA = (a.topic || '').toLowerCase();
                valueB = (b.topic || '').toLowerCase();
                break;
            default:
                valueA = a.date || '';
                valueB = b.date || '';
        }
        
        // Compare values
        let comparison = 0;
        if (valueA > valueB) comparison = 1;
        if (valueA < valueB) comparison = -1;
        
        // Apply sort order
        return sortOrder === 'asc' ? comparison : -comparison;
    });
}

// Reset filters
window.resetAdminFilters = function() {
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    document.getElementById("filterTeacher").value = "";
    document.getElementById("filterStudent").value = "";
    document.getElementById("filterSheetMade").value = "";
    document.getElementById("filterSearch").value = "";
    document.getElementById("sortField").value = "date";
    document.getElementById("sortOrder").value = "desc";
    
    filteredAdminEntries = [...allAdminEntries];
    applySorting();
    currentPage = 1;
    displayAdminEntries();
    updateEntryStats(allAdminEntries, filteredAdminEntries);
};

// Refresh entries
window.refreshAdminEntries = function() {
    loadAdminEntries();
};

// Display entries with pagination
function displayAdminEntries() {
    const entriesList = document.getElementById("admin-entries-list");
    if (!entriesList) return;
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredAdminEntries.length / entriesPerPage);
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    const pageEntries = filteredAdminEntries.slice(startIndex, endIndex);
    
    // Update pagination controls
    updatePaginationControls(currentPage, totalPages);
    
    // Display entries
    if (pageEntries.length === 0) {
        entriesList.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding: 40px; text-align: center; color: #7f8c8d;">📭 No entries match your filters</td></tr>';
        return;
    }
    
    entriesList.innerHTML = pageEntries.map((entry, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        
        // Check if this is a doubt/demo session
        if (entry.type === 'doubt_session') {
            const sessionTypeLabel = entry.sessionType === 'doubt' ? 'Doubt Clearing Session' : 'Demo Session';
            const sessionTypeColor = entry.sessionType === 'doubt' ? '#1a73e8' : '#90ee90';
            
            // Format session date
            let formattedDate = entry.sessionDate || 'N/A';
            if (entry.sessionDate && entry.sessionDate !== 'N/A') {
                const dateObj = new Date(entry.sessionDate + 'T00:00:00');
                formattedDate = formatDateDDMMYYYY(dateObj);
            }
            
            return `
            <tr style="background: ${rowBg}; border-bottom: 1px solid #dee2e6; border-left: 4px solid ${sessionTypeColor};">
                <td style="padding: 12px 8px;">
                    <strong style="color: #2c3e50;">${formattedDate}</strong><br>
                    <small style="background: ${sessionTypeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">${sessionTypeLabel}</small>
                </td>
                <td style="padding: 12px 8px;">
                    <strong style="color: #3498db;">${entry.teacherName || 'N/A'}</strong><br>
                    <small style="color: #7f8c8d;">${entry.teacherEmail || ''}</small>
                </td>
                <td style="padding: 12px 8px;">
                    <strong style="color: #2c3e50;">${entry.studentName || 'N/A'}</strong>
                </td>
                <td style="padding: 12px 8px;" colspan="2">
                    <span style="color: #7f8c8d;">Class: <strong>${entry.studentClass || 'N/A'}</strong></span>
                </td>
                <td style="padding: 12px 8px;" colspan="2">
                    <span style="color: #7f8c8d;">-</span>
                </td>
                <td style="padding: 12px 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.subject || '-'}">
                    ${entry.subject || '-'}
                </td>
                <td style="padding: 12px 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.remarks || '-'}">
                    ${entry.remarks || '-'}
                </td>
                <td style="padding: 12px 8px; text-align: center; white-space: nowrap;">
                    <button onclick="adminDeleteDoubtSession('${entry.id}')" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 2px; font-size: 12px;" title="Delete Session">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `;
        }
        
        // Regular entry
        const paymentText = entry.payment || '-';
        const sheetBadge = entry.sheetMade === 'yes' ? 
            '<span style="background: #d4edda; color: #155724; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">✓ Yes</span>' : 
            '<span style="background: #f8d7da; color: #721c24; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">✗ No</span>';
        const studentName = entry.studentName || entry.student || 'N/A';
        
        // Format date as DD/MM/YYYY
        let formattedDate = entry.date || 'N/A';
        if (entry.date && entry.date !== 'N/A') {
            const dateParts = ('' + entry.date).split('-').map(Number);
            if (dateParts.length >= 3) {
                formattedDate = `${String(dateParts[2]).padStart(2, '0')}/${String(dateParts[1]).padStart(2, '0')}/${dateParts[0]}`;
            }
        }
        
        return `
        <tr style="background: ${rowBg}; border-bottom: 1px solid #dee2e6;">
            <td style="padding: 12px 8px;">
                <strong style="color: #2c3e50;">${formattedDate}</strong><br>
                <small style="color: #7f8c8d;">${entry.dayOfWeek || ''}</small>
            </td>
            <td style="padding: 12px 8px;">
                <strong style="color: #3498db;">${entry.teacherName || 'N/A'}</strong><br>
                <small style="color: #7f8c8d;">${entry.teacherEmail || ''}</small>
            </td>
            <td style="padding: 12px 8px;">
                <strong style="color: #2c3e50;">${studentName}</strong>
            </td>
            <td style="padding: 12px 8px; white-space: nowrap;">
                ${entry.timeFrom || entry.startTime || 'N/A'} - ${entry.timeTo || entry.endTime || 'N/A'}
            </td>
            <td style="padding: 12px 8px; text-align: center;">
                <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${entry.classCount || 'N/A'}</span>
            </td>
            <td style="padding: 12px 8px; text-align: center;">
                ${sheetBadge}
            </td>
            <td style="padding: 12px 8px;">
                ${paymentText !== '-' ? '<span style="color: #27ae60; font-weight: bold;">💰 ' + paymentText + '</span>' : '<span style="color: #95a5a6;">-</span>'}
            </td>
            <td style="padding: 12px 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.subject || '-'}">
                ${entry.subject || '-'}
            </td>
            <td style="padding: 12px 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.topic || '-'}">
                ${entry.topic || '-'}
            </td>
            <td style="padding: 12px 8px; text-align: center; white-space: nowrap;">
                <button onclick="adminEditEntry('${entry.id}')" style="padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 2px; font-size: 12px;" title="Edit Entry">
                    ✏️ Edit
                </button>
                <button onclick="adminDeleteEntry('${entry.id}')" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 2px; font-size: 12px;" title="Delete Entry">
                    🗑️ Delete
                </button>
            </td>
        </tr>
    `}).join('');
}

// Update stats
function updateEntryStats(allEntries, filteredEntries) {
    const totalEntriesEl = document.getElementById("totalEntriesCount");
    const filteredEntriesEl = document.getElementById("filteredEntriesCount");
    const teachersCountEl = document.getElementById("teachersCount");
    const studentsCountEl = document.getElementById("studentsCount");
    
    if (totalEntriesEl) totalEntriesEl.textContent = allEntries.length;
    if (filteredEntriesEl) filteredEntriesEl.textContent = filteredEntries.length;
    
    if (teachersCountEl) {
        const uniqueTeachers = new Set(filteredEntries.map(e => e.teacherName).filter(Boolean));
        teachersCountEl.textContent = uniqueTeachers.size;
    }
    
    if (studentsCountEl) {
        const uniqueStudents = new Set(filteredEntries.map(e => e.studentName || e.student).filter(Boolean));
        studentsCountEl.textContent = uniqueStudents.size;
    }
}

// Update pagination controls
function updatePaginationControls(currentPage, totalPages) {
    const pageInfo = document.getElementById("pageInfo");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

// Pagination functions
window.goToPreviousPage = function() {
    if (currentPage > 1) {
        currentPage--;
        displayAdminEntries();
    }
};

window.goToNextPage = function() {
    const totalPages = Math.ceil(filteredAdminEntries.length / entriesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayAdminEntries();
    }
};

window.changeEntriesPerPage = function() {
    const select = document.getElementById("entriesPerPage");
    entriesPerPage = parseInt(select.value);
    currentPage = 1;
    displayAdminEntries();
};

// Filter entries table by search (legacy function, kept for compatibility)
window.filterEntriesTable = function() {
    // Now redirects to advanced filter
    const searchInput = document.getElementById("searchEntries");
    if (searchInput) {
        document.getElementById("filterSearch").value = searchInput.value;
        applyAdminFilters();
    }
};

function ensureDynamicAdminEditModal() {
    let modal = document.getElementById("editEntryModal");
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'editEntryModal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:2500; align-items:center; justify-content:center; padding:16px;';
    modal.innerHTML = `
        <div style="width:min(860px, 100%); max-height:90vh; overflow:auto; background:#ffffff; border-radius:12px; box-shadow:0 16px 50px rgba(0,0,0,0.25); padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:22px; color:#1f2937;">Edit Entry</h3>
                <button type="button" id="editEntryCloseButton" style="border:none; background:#eef2ff; color:#1f2937; border-radius:8px; padding:8px 12px; cursor:pointer;">Close</button>
            </div>
            <form id="editEntryForm" style="display:grid; gap:12px;">
                <input type="hidden" id="editEntryId" />
                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
                    <label style="display:grid; gap:5px;"><span>Teacher Name</span><input type="text" id="editEntryTeacher" list="editTeacherList" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Student Name</span><input type="text" id="editEntryStudent" list="editStudentList" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                </div>
                <datalist id="editTeacherList"></datalist>
                <datalist id="editStudentList"></datalist>
                <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px;">
                    <label style="display:grid; gap:5px;"><span>Date</span><input type="date" id="editEntryDate" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Time From</span><input type="time" id="editEntryTimeFrom" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Time To</span><input type="time" id="editEntryTimeTo" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                </div>
                <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px;">
                    <label style="display:grid; gap:5px;"><span>Class Count</span><input type="number" step="0.5" min="0.5" id="editEntryClasses" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Subject</span><input type="text" id="editEntrySubject" style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Topic</span><input type="text" id="editEntryTopic" style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                </div>
                <label style="display:grid; gap:5px;"><span>Payment</span><input type="text" id="editEntryPayment" style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
                    <fieldset style="border:1px solid #d1d5db; border-radius:8px; padding:10px;"><legend>Sheet Made</legend><label><input type="radio" name="editEntrySheetMade" value="yes" /> Yes</label><label style="margin-left:12px;"><input type="radio" name="editEntrySheetMade" value="no" /> No</label></fieldset>
                    <fieldset style="border:1px solid #d1d5db; border-radius:8px; padding:10px;"><legend>Homework</legend><label><input type="radio" name="editEntryHomework" value="yes" /> Yes</label><label style="margin-left:12px;"><input type="radio" name="editEntryHomework" value="no" /> No</label></fieldset>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:4px;">
                    <button type="button" onclick="closeEditEntryModal()" style="padding:10px 14px; border:1px solid #d1d5db; background:#fff; border-radius:8px; cursor:pointer;">Cancel</button>
                    <button type="submit" style="padding:10px 14px; border:none; background:#1a73e8; color:#fff; border-radius:8px; cursor:pointer;">Save Entry</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('editEntryCloseButton');
    if (closeBtn) closeBtn.addEventListener('click', window.closeEditEntryModal);

    const form = document.getElementById('editEntryForm');
    if (form) form.addEventListener('submit', window.updateAdminEntry);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) window.closeEditEntryModal();
    });

    return modal;
}

async function populateAdminEditNameLists() {
    const teacherList = document.getElementById('editTeacherList');
    const studentList = document.getElementById('editStudentList');
    if (!teacherList || !studentList) return;

    const [teacherSnap, studentSnap] = await Promise.all([
        getDocs(query(collection(db, "teachers"), where("status", "==", "active"))),
        getDocs(query(collection(db, "students"), where("status", "==", "active")))
    ]);

    teacherList.innerHTML = teacherSnap.docs
        .map((docSnap) => `<option value="${(docSnap.data().name || '').replace(/"/g, '&quot;')}"></option>`)
        .join('');

    studentList.innerHTML = studentSnap.docs
        .map((docSnap) => `<option value="${(docSnap.data().name || '').replace(/"/g, '&quot;')}"></option>`)
        .join('');
}

// Admin edit entry - opens in modal or navigates to form
// Admin edit entry - inline modal
window.adminEditEntry = async function(docId) {
    try {
        await ensureAuthReady();
        const entryDoc = await getDoc(doc(db, "entries", docId));
        if (!entryDoc.exists()) {
            alert("Entry not found!");
            return;
        }

        const entry = entryDoc.data() || {};
        ensureAdminEntryModal();

        try {
            await window.openAddEntryModal();
        } catch (openError) {
            console.warn("openAddEntryModal failed during edit flow, retrying with dynamic modal:", openError);
            ensureAdminEntryModal();
        }

        let adminForm = document.getElementById("adminEntryForm");
        let teacherSelect = document.getElementById("adminEntryTeacher");
        let studentSelect = document.getElementById("adminEntryStudent");

        if (!adminForm || !teacherSelect || !studentSelect) {
            // One retry after yielding to DOM in case of render timing issues.
            await Promise.resolve();
            adminForm = document.getElementById("adminEntryForm");
            teacherSelect = document.getElementById("adminEntryTeacher");
            studentSelect = document.getElementById("adminEntryStudent");
        }

        if (!adminForm || !teacherSelect || !studentSelect) {
            alert("Edit form could not be initialized. Please refresh once and try again.");
            return;
        }

        adminForm.dataset.editingId = docId;

        const addModal = document.getElementById("addEntryModal");
        const modalHeading = addModal ? addModal.querySelector('h2, h3') : null;
        if (modalHeading) {
            modalHeading.textContent = 'Edit Teacher Entry';
        }

        const submitBtn = adminForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Save Changes';
        }

        document.getElementById("adminEntryDate").value = entry.date || "";
        document.getElementById("adminEntryTimeFrom").value = entry.timeFrom || "";
        document.getElementById("adminEntryTimeTo").value = entry.timeTo || "";
        document.getElementById("adminEntryClasses").value = entry.classCount || "";
        document.getElementById("adminEntrySubject").value = entry.subject || "";
        document.getElementById("adminEntryTopic").value = entry.topic || "";

        let teacherId = entry.teacherId || "";
        if (!teacherId && entry.teacherName) {
            const teacherSnap = await getDocs(query(collection(db, "teachers"), where("name", "==", entry.teacherName)));
            if (!teacherSnap.empty) {
                teacherId = teacherSnap.docs[0].id;
            }
        }
        if (teacherId) {
            teacherSelect.value = teacherId;
        }

        let studentId = entry.studentId || "";
        const existingStudentName = entry.studentName || entry.student || "";
        if (!studentId && existingStudentName) {
            const studentSnap = await getDocs(query(collection(db, "students"), where("name", "==", existingStudentName)));
            if (!studentSnap.empty) {
                studentId = studentSnap.docs[0].id;
            }
        }
        if (studentId) {
            studentSelect.value = studentId;
        }

        const sheetVal = entry.sheetMade || "no";
        const sheetRadios = document.getElementsByName("adminEntrySheetMade");
        sheetRadios.forEach((radio) => {
            radio.checked = radio.value === sheetVal;
        });

        const homeworkVal = entry.homeworkGiven || entry.homework || "no";
        const hwRadios = document.getElementsByName("adminEntryHomework");
        hwRadios.forEach((radio) => {
            radio.checked = radio.value === homeworkVal;
        });
    } catch (error) {
        console.error("Error loading entry for edit:", error);
        alert("Error loading entry. Check console.");
    }
};

// Close edit modal
window.closeEditEntryModal = function() {
    const modal = document.getElementById("editEntryModal");
    if (modal) {
        modal.style.display = "none";
        const form = document.getElementById("editEntryForm");
        if (form) form.reset();
    }
};

// Update entry
window.updateAdminEntry = async function(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    
    try {
        await ensureAuthReady();
        const docId = document.getElementById("editEntryId").value;
        const existingDoc = await getDoc(doc(db, "entries", docId));
        if (!existingDoc.exists()) {
            alert("Entry not found!");
            return;
        }
        const existing = existingDoc.data() || {};

        const date = document.getElementById("editEntryDate").value;
        const classCount = parseFloat(document.getElementById("editEntryClasses").value);
        const timeFrom = document.getElementById("editEntryTimeFrom").value;
        const timeTo = document.getElementById("editEntryTimeTo").value;
        const subject = document.getElementById("editEntrySubject")?.value || "";
        const topic = document.getElementById("editEntryTopic")?.value || "";
        const payment = document.getElementById("editEntryPayment")?.value?.trim() || "";
        const teacherNameInput = document.getElementById("editEntryTeacher")?.value?.trim();
        const studentNameInput = document.getElementById("editEntryStudent")?.value?.trim();
        const sheetMade = document.querySelector('input[name="editEntrySheetMade"]:checked')?.value || "no";
        const homework = document.querySelector('input[name="editEntryHomework"]:checked')?.value || "no";

        if (!date || Number.isNaN(classCount) || classCount <= 0 || !timeFrom || !timeTo) {
            alert("Please fill valid date, class count, and time range.");
            return;
        }

        let teacherName = teacherNameInput || existing.teacherName || "";
        let teacherId = existing.teacherId || null;
        if (teacherName && teacherName !== (existing.teacherName || "")) {
            const teacherSnap = await getDocs(query(collection(db, "teachers"), where("name", "==", teacherName)));
            if (!teacherSnap.empty) {
                teacherId = teacherSnap.docs[0].id;
            }
        }

        const existingStudentName = existing.studentName || existing.student || "";
        let studentName = studentNameInput || existingStudentName;
        let studentId = existing.studentId || null;
        if (studentName && studentName !== existingStudentName) {
            const studentSnap = await getDocs(query(collection(db, "students"), where("name", "==", studentName)));
            if (!studentSnap.empty) {
                studentId = studentSnap.docs[0].id;
            }
        }
        
        // Calculate day of week
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Prepare update data
        const updateData = {
            teacherId,
            teacherName,
            studentId,
            studentName,
            date,
            dayOfWeek,
            classCount,
            timeFrom,
            subject,
            timeTo,
            topic,
            sheetMade,
            homeworkGiven: homework,
            homework,
            payment: payment || "",
            updatedAt: Timestamp.now()
        };
        
        // Update in Firestore
        await updateDoc(doc(db, "entries", docId), updateData);
        
        alert("✅ Entry updated successfully!");
        closeEditEntryModal();
        
        // Reload entries to show updated data
        await loadAdminEntries();
    } catch (error) {
        console.error("Error updating entry:", error);
        alert("❌ Error updating entry. Check console.");
    }
};

// Admin delete entry - no restrictions
window.adminDeleteEntry = async function(docId) {
    if (!confirm("Are you sure you want to permanently delete this entry?\\nThis cannot be undone!")) return;

    try {
        await deleteDoc(doc(db, "entries", docId));
        alert("✅ Entry deleted successfully!");
        loadAdminEntries();
    } catch (error) {
        console.error("Error deleting entry:", error);
        alert("❌ Error deleting entry. Check console.");
    }
};

// Delete doubt/demo session from admin
window.adminDeleteDoubtSession = async function(docId) {
    if (!confirm("Are you sure you want to permanently delete this doubt/demo session?\\nThis cannot be undone!")) return;

    try {
        await deleteDoc(doc(db, "doubt_sessions", docId));
        alert("✅ Session deleted successfully!");
        loadAdminEntries();
        // Also refresh the doubt sessions tab if it's loaded
        if (typeof loadAdminDoubtSessions === 'function') {
            loadAdminDoubtSessions();
        }
    } catch (error) {
        console.error("Error deleting doubt session:", error);
        alert("❌ Error deleting session. Check console.");
    }
};

function ensureAdminEntryModal() {
    let modal = document.getElementById("addEntryModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "addEntryModal";
    modal.style.cssText = "display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:2400; align-items:center; justify-content:center; padding:16px;";
    modal.innerHTML = `
        <div style="width:min(860px, 100%); max-height:90vh; overflow:auto; background:#fff; border-radius:12px; box-shadow:0 16px 50px rgba(0,0,0,0.25); padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; color:#1f2937; font-size:22px;">Add New Entry</h3>
                <button type="button" id="closeAdminEntryModalBtn" style="border:none; background:#eef2ff; color:#1f2937; border-radius:8px; padding:8px 12px; cursor:pointer;">Close</button>
            </div>

            <form id="adminEntryForm" style="display:grid; gap:12px;">
                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
                    <label style="display:grid; gap:5px;"><span>Teacher</span><select id="adminEntryTeacher" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;"></select></label>
                    <label style="display:grid; gap:5px;"><span>Student</span><select id="adminEntryStudent" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;"></select></label>
                </div>

                <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px;">
                    <label style="display:grid; gap:5px;"><span>Date</span><input type="date" id="adminEntryDate" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Time From</span><input type="time" id="adminEntryTimeFrom" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Time To</span><input type="time" id="adminEntryTimeTo" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                </div>

                <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px;">
                    <label style="display:grid; gap:5px;"><span>Class Count</span><input type="number" id="adminEntryClasses" step="0.5" min="0.5" required style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Subject</span><input type="text" id="adminEntrySubject" style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                    <label style="display:grid; gap:5px;"><span>Topic</span><input type="text" id="adminEntryTopic" style="padding:10px; border:1px solid #d1d5db; border-radius:8px;" /></label>
                </div>

                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
                    <fieldset style="border:1px solid #d1d5db; border-radius:8px; padding:10px;"><legend>Sheet Made</legend><label><input type="radio" name="adminEntrySheetMade" value="yes" /> Yes</label><label style="margin-left:12px;"><input type="radio" name="adminEntrySheetMade" value="no" checked /> No</label></fieldset>
                    <fieldset style="border:1px solid #d1d5db; border-radius:8px; padding:10px;"><legend>Homework</legend><label><input type="radio" name="adminEntryHomework" value="yes" /> Yes</label><label style="margin-left:12px;"><input type="radio" name="adminEntryHomework" value="no" checked /> No</label></fieldset>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:4px;">
                    <button type="button" onclick="closeAddEntryModal()" style="padding:10px 14px; border:1px solid #d1d5db; background:#fff; border-radius:8px; cursor:pointer;">Cancel</button>
                    <button type="submit" style="padding:10px 14px; border:none; background:#1a73e8; color:#fff; border-radius:8px; cursor:pointer;">Save Entry</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById("closeAdminEntryModalBtn");
    if (closeBtn) {
        closeBtn.addEventListener("click", window.closeAddEntryModal);
    }

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            window.closeAddEntryModal();
        }
    });

    return modal;
}

// Open add entry modal
window.openAddEntryModal = async function() {
    const modal = ensureAdminEntryModal();

    await ensureAuthReady();
    
    // Load active teachers
    const teachersQuery = query(collection(db, "teachers"), where("status", "==", "active"));
    const teachersSnapshot = await getDocs(teachersQuery);
    const teacherSelect = document.getElementById("adminEntryTeacher");
    
    if (teacherSelect) {
        teacherSelect.innerHTML = '<option value="">Select Teacher</option>';
        teachersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const displayName = data.email ? `${data.name} (${data.email})` : data.name;
            teacherSelect.innerHTML += `<option value="${doc.id}">${displayName}</option>`;
        });
    }
    
    // Load active students
    const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
    const studentsSnapshot = await getDocs(studentsQuery);
    const studentSelect = document.getElementById("adminEntryStudent");
    
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Select Student</option>';
        const students = studentsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        students.forEach(student => {
            studentSelect.innerHTML += `<option value="${student.id}">${student.name}</option>`;
        });
    }
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("adminEntryDate").value = today;

    // Reset and bind form defensively
    const adminForm = document.getElementById("adminEntryForm");
    if (adminForm) {
        adminForm.reset();
        delete adminForm.dataset.editingId;
        adminForm.onsubmit = saveAdminEntry;
        const submitBtn = adminForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Save Entry';
        }
    }

    modal.style.display = "flex";
};

// Close add entry modal
window.closeAddEntryModal = function() {
    const modal = document.getElementById("addEntryModal");
    if (modal) {
        modal.style.display = "none";
        const adminForm = document.getElementById("adminEntryForm");
        if (adminForm) {
            adminForm.reset();
            delete adminForm.dataset.editingId;
            const submitBtn = adminForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Save Entry';
            }
        }

        const modalHeading = modal.querySelector('h2, h3');
        if (modalHeading) {
            modalHeading.textContent = 'Add New Entry';
        }
    }
};

// Save admin entry
window.saveAdminEntry = async function(event) {
    // Defensive: event may be undefined if handler called directly
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    console.log('saveAdminEntry invoked');

    try {
        await ensureAuthReady();
        // Defensive element lookup inside try so missing elements are caught
        const adminForm = document.getElementById('adminEntryForm');
        if (!adminForm) {
            alert('Internal error: admin form not found on the page.');
            console.error('saveAdminEntry: adminEntryForm is missing');
            return;
        }

        const getEl = (id) => {
            const el = document.getElementById(id);
            if (!el) {
                console.error('saveAdminEntry: missing element', id);
                alert('Internal error: form element missing: ' + id + '. See console.');
            }
            return el;
        };

        const dateEl = getEl('adminEntryDate');
        const teacherEl = getEl('adminEntryTeacher');
        const studentEl = getEl('adminEntryStudent');
        const timeFromEl = getEl('adminEntryTimeFrom');
        const timeToEl = getEl('adminEntryTimeTo');
        const classCountEl = getEl('adminEntryClasses');
        const subjectEl = getEl('adminEntrySubject');
        const topicEl = getEl('adminEntryTopic');

        if (!dateEl || !teacherEl || !studentEl || !timeFromEl || !timeToEl || !classCountEl || !subjectEl || !topicEl) {
            // Missing required form controls — abort
            return;
        }

        const date = dateEl.value;
        const teacherId = teacherEl.value;
        const studentId = studentEl.value;
        const editingId = adminForm.dataset.editingId || "";
        const timeFrom = timeFromEl.value;
        const timeTo = timeToEl.value;
        const classCount = parseFloat(classCountEl.value);
        const sheetMade = document.querySelector('input[name="adminEntrySheetMade"]:checked')?.value;
        const homeworkGiven = document.querySelector('input[name="adminEntryHomework"]:checked')?.value || "";
        const subject = subjectEl.value;
        const topic = topicEl.value;

        console.log('saveAdminEntry values:', { date, teacherId, studentId, timeFrom, timeTo, classCount, sheetMade, homeworkGiven, subject, topic });

        // Validate basic required fields
        if (!teacherId) { alert('Please select a teacher'); return; }
        if (!studentId) { alert('Please select a student'); return; }

        // Validate time range
        if (timeFrom >= timeTo) {
            alert("'Time To' must be later than 'Time From'");
            return;
        }

        console.log('Preparing to save entry, fetching teacher/student docs');
        // Get teacher data
        const teacherDoc = await getDoc(doc(db, "teachers", teacherId));
        if (!teacherDoc.exists()) {
            alert("❌ Teacher not found!");
            return;
        }
        const teacherData = teacherDoc.data();
        
        console.log('Got teacher data, fetching student');
        // Get student data
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("❌ Student not found!");
            return;
        }
        const studentData = studentDoc.data();
        
        // Calculate day of week
        const dateObj = new Date(date + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[dateObj.getDay()];
        
        const entryPayload = {
            teacherId: teacherId,
            teacherName: teacherData.name,
            teacherEmail: teacherData.email || "",
            studentId: studentId,
            studentName: studentData.name,
            date: date,
            dayOfWeek: dayOfWeek,
            timeFrom: timeFrom,
            timeTo: timeTo,
            classCount: classCount,
            sheetMade: sheetMade,
            homeworkGiven: homeworkGiven,
            homework: homeworkGiven,
            subject: subject,
            topic: topic
        };

        console.log('Saving entry to Firestore for teacherId', teacherId, 'studentId', studentId, 'editingId', editingId || 'new');

        if (editingId) {
            await updateDoc(doc(db, "entries", editingId), {
                ...entryPayload,
                updatedAt: Timestamp.now()
            });
            alert("Entry updated successfully.");
        } else {
            await addDoc(collection(db, "entries"), {
                ...entryPayload,
                createdAt: Timestamp.now()
            });
            alert("Entry added successfully.");
        }
        
        closeAddEntryModal();
        loadAdminEntries();
        
    } catch (error) {
        console.error("Error adding entry:", error);
        alert("❌ Error adding entry. Check console.");
    }
};

// ========== REPORTS PAGE FUNCTIONS ==========

let allEntriesData = [];

// Load all entries for reports page
window.loadReportsData = async function() {
    const entriesList = document.getElementById("entriesList");
    const filterTeacher = document.getElementById("filterTeacher");
    const filterStudent = document.getElementById("filterStudent");

    if (!entriesList) return;

    entriesList.innerHTML = '<div class="loading">Loading entries...</div>';

    try {
        // Fetch all entries
        const snapshot = await getDocs(collection(db, "entries"));
        
        allEntriesData = [];
        snapshot.forEach(doc => {
            allEntriesData.push({ id: doc.id, ...doc.data() });
        });

        // Sort by most recent first
        allEntriesData.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        // Populate filter dropdowns
        if (filterTeacher && filterStudent) {
            const teachers = [...new Set(allEntriesData.map(e => e.teacherName).filter(Boolean))].sort();
            const students = [...new Set(allEntriesData.map(e => e.student).filter(Boolean))].sort();

            filterTeacher.innerHTML = '<option value="">All Teachers</option>' + 
                teachers.map(t => `<option value="${t}">${t}</option>`).join('');
            
            filterStudent.innerHTML = '<option value="">All Students</option>' + 
                students.map(s => `<option value="${s}">${s}</option>`).join('');
        }

        // Display all entries initially
        displayEntries(allEntriesData);

    } catch (error) {
        console.error("Error loading reports data:", error);
        entriesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">Error loading entries</div></div>';
    }
};

// Display entries in card format
function displayEntries(entries) {
    const entriesList = document.getElementById("entriesList");
    const entriesCount = document.getElementById("entriesCount");

    if (!entriesList) return;

    // Update count
    if (entriesCount) {
        entriesCount.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    }

    // Check if empty
    if (entries.length === 0) {
        entriesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">No entries found</div>
                <p>Try adjusting your filters or create a new entry</p>
            </div>
        `;
        return;
    }

    // Display entries
    entriesList.innerHTML = entries.map(entry => {
        const paymentDisplay = entry.payment ? 
            `<span class="badge badge-payment">💰 ${entry.payment}</span>` : 
            '<span style="color: #95a5a6;">No payment</span>';
        
        const sheetDisplay = entry.sheetMade === 'yes' ? 
            '<span class="badge badge-yes">📄 Yes</span>' : 
            entry.sheetMade === 'no' ?
            '<span class="badge badge-no">📄 No</span>' :
            '<span style="color: #95a5a6;">-</span>';
        
        const studentName = entry.studentName || entry.student || 'N/A';

        return `
            <div class="entry-card">
                <div class="entry-top">
                    <div class="entry-field">
                        <div class="entry-label">Date & Day</div>
                        <div class="entry-value large">${entry.date || 'N/A'}<br><small style="color: #7f8c8d;">${entry.dayOfWeek || ''}</small></div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Teacher</div>
                        <div class="entry-value">${entry.teacherName || 'N/A'}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Student</div>
                        <div class="entry-value">${studentName}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Time</div>
                        <div class="entry-value">${entry.timeFrom || entry.startTime || 'N/A'} - ${entry.timeTo || entry.endTime || 'N/A'}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Classes</div>
                        <div class="entry-value">${entry.classCount || 'N/A'}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Sheet Made</div>
                        <div class="entry-value">${sheetDisplay}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Payment</div>
                        <div class="entry-value">${paymentDisplay}</div>
                    </div>
                </div>
                <div class="entry-topic">
                    <div class="entry-topic-label">Topic</div>
                    <div class="entry-topic-text">${entry.topic || 'No topic provided'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Apply filters
window.applyFilters = function() {
    const filterTeacher = document.getElementById("filterTeacher")?.value;
    const filterStudent = document.getElementById("filterStudent")?.value;
    const filterDateFrom = document.getElementById("filterDateFrom")?.value;
    const filterDateTo = document.getElementById("filterDateTo")?.value;
    const filterSheet = document.getElementById("filterSheet")?.value;

    let filtered = [...allEntriesData];

    // Filter by teacher
    if (filterTeacher) {
        filtered = filtered.filter(e => e.teacherName === filterTeacher);
    }

    // Filter by student
    if (filterStudent) {
        filtered = filtered.filter(e => (e.studentName || e.student) === filterStudent);
    }

    // Filter by date range
    if (filterDateFrom) {
        filtered = filtered.filter(e => e.date >= filterDateFrom);
    }

    if (filterDateTo) {
        filtered = filtered.filter(e => e.date <= filterDateTo);
    }

    // Filter by sheet made
    if (filterSheet) {
        filtered = filtered.filter(e => e.sheetMade === filterSheet);
    }

    displayEntries(filtered);
};

// Reset filters
window.resetFilters = function() {
    document.getElementById("filterTeacher").value = "";
    document.getElementById("filterStudent").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    document.getElementById("filterSheet").value = "";
    
    displayEntries(allEntriesData);
};

// Reports page initialization
if (window.location.pathname.includes('reports.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        const role = localStorage.getItem("role");
        
        if (!role) {
            alert("Please login first!");
            window.location.href = "index.html";
            return;
        }

        loadReportsData();
    });
}

// ===== ADVANCED REPORTS - TEACHER ANALYTICS =====
window.showAdvancedReports = function() {
    const modal = document.getElementById("advancedReportsModal");
    if (modal) {
        modal.style.display = "block";
        loadAdvancedReports();
    }
}

window.closeAdvancedReports = function() {
    const modal = document.getElementById("advancedReportsModal");
    if (modal) {
        modal.style.display = "none";
    }
}

window.onAdvancedTimePeriodChange = function() {
    const timePeriod = document.getElementById('advancedTimePeriod')?.value;
    const customRange = document.getElementById('advancedCustomRange');
    
    if (customRange) {
        if (timePeriod === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
            loadAdvancedReports();
        }
    }
}

window.loadAdvancedReports = async function() {
    const contentDiv = document.getElementById("advancedReportContent");
    const timePeriod = document.getElementById("advancedTimePeriod")?.value || "30";
    
    if (!contentDiv) return;
    
    contentDiv.innerHTML = '<div style="text-align: center; padding: 48px; color: #666666; font-family: \'Roboto\', sans-serif; font-size: 14px;">Loading teacher analytics...</div>';
    
    try {
        // Get all entries
        const entriesQuery = query(collection(db, "entries"));
        const snapshot = await getDocs(entriesQuery);
        
        // Calculate date filter (support custom range)
        let startDate = null;
        let endDate = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('advancedTimePeriodCustomFrom')?.value;
            const to = document.getElementById('advancedTimePeriodCustomTo')?.value;
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            startDate = parseLocalDateStart(from);
            endDate = parseLocalDateEnd(to);
        } else if (timePeriod !== "all") {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        
        // Process entries per teacher
        const teacherStats = {};
        
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            const entryDate = entry.createdAt?.toDate() || new Date(entry.date);
            
            // Filter by date
            if (startDate && entryDate < startDate) return;
            
            const teacherName = entry.teacherName || "Unknown";
            
            if (!teacherStats[teacherName]) {
                teacherStats[teacherName] = {
                    totalClasses: 0,
                    totalHours: 0,
                    students: new Set(),
                    totalPayment: 0
                };
            }
            
            teacherStats[teacherName].totalClasses += parseFloat(entry.classCount) || 0;
            teacherStats[teacherName].totalHours += calculateHoursDuration(entry.timeFrom, entry.timeTo);
            if (entry.studentName) {
                teacherStats[teacherName].students.add(entry.studentName);
            }
            
            // Parse payment
            const payment = entry.payment || "";
            const match = payment.match(/\d+/);
            if (match) {
                teacherStats[teacherName].totalPayment += parseInt(match[0]);
            }
        });
        
        // Sort teachers by total classes (descending)
        const sortedTeachers = Object.entries(teacherStats).sort((a, b) => b[1].totalClasses - a[1].totalClasses);
        
        if (sortedTeachers.length === 0) {
            contentDiv.innerHTML = '<div style="text-align: center; padding: 48px; color: #666666; font-family: \'Roboto\', sans-serif; font-size: 14px;">No data found for the selected time period.</div>';
            return;
        }
        
        // Build HTML
        let html = '<div style="overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse; font-family: \'Roboto\', sans-serif;">';
        html += '<thead><tr style="background: #f8f9fa; border-bottom: 2px solid #dadce0;">';
        html += '<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Teacher Name</th>';
        html += '<th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Total Classes</th>';
        html += '<th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Total Hours</th>';
        html += '<th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Students Taught</th>';
        html += '<th style="padding: 12px; text-align: right; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Total Payment</th>';
        html += '</tr></thead><tbody>';
        
        sortedTeachers.forEach(([teacherName, stats], index) => {
            const bgColor = index % 2 === 0 ? 'white' : '#f8f9fa';
            html += `<tr style="background: ${bgColor}; border-bottom: 1px solid #f0f0f0;">`;
            html += `<td style="padding: 12px; font-size: 14px; color: #2c2c2c; font-weight: 500;">${teacherName}</td>`;
            html += `<td style="padding: 12px; text-align: center; font-size: 18px; font-weight: 600; color: #d4af37;">${stats.totalClasses.toFixed(1)}</td>`;
            html += `<td style="padding: 12px; text-align: center; font-size: 14px; color: #666666;">${stats.totalHours.toFixed(1)}</td>`;
            html += `<td style="padding: 12px; text-align: center; font-size: 14px; color: #666666;">${stats.students.size}</td>`;
            html += `<td style="padding: 12px; text-align: right; font-size: 14px; color: #90ee90; font-weight: 500;">₹${stats.totalPayment}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        
        contentDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading advanced reports:", error);
        contentDiv.innerHTML = '<div style="text-align: center; padding: 48px; color: #d93025; font-family: \'Roboto\', sans-serif; font-size: 14px;">Error loading data. Please try again.</div>';
    }
}

// Helper function to calculate duration in hours from time strings like "10:00" and "11:30"
function calculateHoursDuration(timeFrom, timeTo) {
    try {
        if (!timeFrom || !timeTo) return 0;
        const parseTime = (t) => {
            const parts = t.split(':').map(Number);
            if (parts.length >= 2) return parts[0] + parts[1] / 60;
            return 0;
        };
        const fromHours = parseTime(timeFrom);
        const toHours = parseTime(timeTo);
        const duration = toHours - fromHours;
        return duration > 0 ? duration : 0;
    } catch (e) {
        return 0;
    }
}

// Load detailed report for a single teacher (triggered from Advanced Reports modal)
window.loadTeacherDetailReport = async function() {
    const teacherSearch = document.getElementById('advancedTeacherSearch');
    const teacherQueryText = teacherSearch?.value?.trim();
    const contentDiv = document.getElementById('advancedReportContent');

    if (!contentDiv) return;
    if (!teacherQueryText) {
        alert('Please enter a teacher name to view details.');
        return;
    }

    contentDiv.innerHTML = `
        <div id="teacherDetailMain" style="text-align: center; padding: 24px; color: #666; font-family: Roboto, sans-serif;">Loading teacher details...</div>
    `;

    console.log('[DEBUG] loadTeacherDetailReport called for:', teacherQueryText);

    try {
        // Determine date range using same rules as loadAdvancedReports
        const timePeriod = document.getElementById('advancedTimePeriod')?.value || '30';
        let startDate = null;
        let endDate = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('timePeriodCustomFrom')?.value;
            const to = document.getElementById('timePeriodCustomTo')?.value;
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            startDate = parseLocalDateStart(from);
            endDate = parseLocalDateEnd(to);
        } else if (timePeriod !== 'all') {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }

        // Fetch all entries and filter in JS for tolerant matching
        let snapshot;
        try {
            console.log('[DEBUG] timePeriod (advanced):', timePeriod, 'startDate:', startDate, 'endDate:', endDate);
            snapshot = await getDocs(query(collection(db, 'entries')));
            console.log('[DEBUG] entries snapshot size:', snapshot.size);
        } catch (getErr) {
            console.error('[DEBUG] getDocs failed in loadTeacherDetailReport:', getErr);
            const main = document.getElementById('teacherDetailMain');
            if (main) main.innerHTML = '<div style="text-align:center; padding: 36px; color:#d93025;">Error fetching entries. Check console for details.</div>';
            return;
        }
        const teacherLower = teacherQueryText.toLowerCase();

        const matched = [];
        snapshot.docs.forEach(d => {
            const entry = d.data();

            const entryTeacher = (entry.teacherName || '').toString();
            if (!entryTeacher) return;
            if (!entryTeacher.toLowerCase().includes(teacherLower)) return; // tolerant match

            // Determine entry date (prefer entry.date parsed as local Y-M-D, fallback to createdAt)
            let entryDate = null;
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                if ((!entryDate || isNaN(entryDate.getTime())) && entry.date) {
                    const parsed = new Date(entry.date + 'T00:00:00');
                    if (!isNaN(parsed.getTime())) entryDate = parsed;
                }
            }
            if (!entryDate && entry.createdAt && typeof entry.createdAt.toDate === 'function') {
                entryDate = entry.createdAt.toDate();
            }
            if (!entryDate && entry.createdAt) entryDate = new Date(entry.createdAt);

            // Apply date filters
            if (startDate && entryDate && entryDate < startDate) return;
            if (endDate && entryDate && entryDate > endDate) return;

            matched.push({ id: d.id, ...entry, __entryDate: entryDate });
        });

        if (matched.length === 0) {
            console.log('[DEBUG] matched entries: 0');
            const main = document.getElementById('teacherDetailMain');
            if (main) main.innerHTML = '<div style="text-align:center; padding: 36px; color:#666;">No records found for this teacher in the selected period.</div>';
            return;
        }

        console.log('[DEBUG] matched entries count:', matched.length);

        // Aggregations
        let totalHours = 0;
        let totalClasses = 0;
        const dayCounts = { 'Sunday':0,'Monday':0,'Tuesday':0,'Wednesday':0,'Thursday':0,'Friday':0,'Saturday':0 };
        const students = {}; // name -> count

        matched.forEach(e => {
            totalHours += calculateHoursDuration(e.timeFrom, e.timeTo);
            totalClasses += parseFloat(e.classCount) || 0;
            const d = e.__entryDate instanceof Date && !isNaN(e.__entryDate.getTime()) ? e.__entryDate : null;
            if (d) {
                const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                dayCounts[days[d.getDay()]] = (dayCounts[days[d.getDay()]] || 0) + 1;
            }
            const sname = e.studentName || e.student || 'Unknown';
            students[sname] = (students[sname] || 0) + 1;
        });

        // Build time period text for display
        let periodText = '';
        if (timePeriod === 'all') periodText = 'All Time';
        else if (timePeriod === 'custom') {
            const f = document.getElementById('advancedTimePeriodCustomFrom')?.value || '';
            const t = document.getElementById('advancedTimePeriodCustomTo')?.value || '';
            periodText = f && t ? `${f} to ${t}` : 'Custom Range';
        } else if (timePeriod === '7') periodText = 'Last 7 Days';
        else if (timePeriod === '30') periodText = 'Last 1 Month';
        else if (timePeriod === '90') periodText = 'Last 3 Months';
        else if (timePeriod === '180') periodText = 'Last 6 Months';
        else if (timePeriod === '365') periodText = 'Last 1 Year';
        else periodText = `Last ${timePeriod} Days`;

        // Build HTML
        let html = '<div class="print-only" style="text-align:center; margin-bottom:20px; border-bottom:2px solid #d4af37; padding-bottom:12px;">';
        html += `<h2 style="margin:0 0 8px 0; font-family:Roboto,sans-serif; color:#2c2c2c;">Teacher Performance Report</h2>`;
        html += `<p style="margin:0; color:#666; font-size:14px;">Teacher: <strong>${teacherQueryText}</strong> | Period: <strong>${periodText}</strong> | Generated: <strong>${formatDateDDMMYYYY(new Date())}</strong></p>`;
        html += '</div>';
        
        html += '<div class="no-print" style="margin-bottom:16px; display:flex; gap:12px; align-items:center; justify-content:space-between;">';
        html += '<div style="display:flex; gap:12px; align-items:center;">';
        html += `<button onclick="loadAdvancedReports()" style="padding:10px 16px; background:#1a73e8; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; font-family:Roboto,sans-serif;">← Back</button>`;
        html += `<h3 style="margin:0; font-family: Roboto, sans-serif;">Details for: <span style="color:#1a73e8;">${teacherQueryText}</span></h3>`;
        html += '</div>';
        html += '<div style="display:flex; gap:12px;">';
        html += `<button onclick="exportTeacherDetailExcel('${teacherQueryText}', '${periodText}')" style="padding:10px 16px; background:#0F9D58; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; font-family:Roboto,sans-serif;">📊 Export Excel</button>`;
        html += `<button onclick="window.print()" style="padding:10px 16px; background:#34a853; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; font-family:Roboto,sans-serif;">🖨️ Print Report</button>`;
        html += '</div>';
        html += '</div>';

        html += '<div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">';
        html += `<div style="background:#fff; padding:12px; border:1px solid #e6e6e6; border-radius:6px; min-width:150px;\"><div style="font-size:12px; color:#666;">Total Hours</div><div style="font-size:20px; font-weight:700;">${totalHours.toFixed(1)}</div></div>`;
        html += `<div style="background:#fff; padding:12px; border:1px solid #e6e6e6; border-radius:6px; min-width:150px;\"><div style="font-size:12px; color:#666;">Total Classes</div><div style="font-size:20px; font-weight:700;">${totalClasses.toFixed(1)}</div></div>`;
        html += `<div style="background:#fff; padding:12px; border:1px solid #e6e6e6; border-radius:6px; min-width:220px;\"><div style="font-size:12px; color:#666;">Unique Students</div><div style="font-size:20px; font-weight:700;">${Object.keys(students).length}</div></div>`;
        html += '</div>';

        // Day breakdown
        html += '<div style="margin-bottom:18px;"><strong>Classes by Day</strong>'; 
        html += '<table style="width:100%; border-collapse:collapse; margin-top:8px;"><thead><tr>';
        Object.keys(dayCounts).forEach(d => { html += `<th style="padding:8px; text-align:left; background:#f8f9fa; border:1px solid #eee;">${d}</th>` });
        html += '</tr></thead><tbody><tr>';
        Object.keys(dayCounts).forEach(d => { html += `<td style="padding:10px; border:1px solid #eee;">${dayCounts[d]}</td>` });
        html += '</tr></tbody></table></div>';

        // Students list
        html += '<div style="margin-bottom:18px;"><strong>Students Taught</strong>';
        html += '<table style="width:100%; border-collapse:collapse; margin-top:8px;"><thead><tr><th style="padding:8px; text-align:left; background:#f8f9fa; border:1px solid #eee;">#</th><th style="padding:8px; text-align:left; background:#f8f9fa; border:1px solid #eee;">Student</th><th style="padding:8px; text-align:right; background:#f8f9fa; border:1px solid #eee;">Sessions</th></tr></thead><tbody>';
        const studentEntries = Object.entries(students).sort((a,b) => b[1]-a[1]);
        studentEntries.forEach(([name, cnt], idx) => {
            html += `<tr style="border-bottom:1px solid #f0f0f0;\"><td style="padding:10px;">${idx+1}</td><td style="padding:10px;">${name}</td><td style="padding:10px; text-align:right;">${cnt}</td></tr>`;
        });
        html += '</tbody></table></div>';

        // Recent entries table (detailed)
        html += '<div><strong>Recent Entries</strong>';
        html += '<table style="width:100%; border-collapse:collapse; margin-top:8px;"><thead><tr>';
        html += '<th style="padding:8px; background:#f8f9fa; border:1px solid #eee;">Date</th>';
        html += '<th style="padding:8px; background:#f8f9fa; border:1px solid #eee;">Day</th>';
        html += '<th style="padding:8px; background:#f8f9fa; border:1px solid #eee;">Student</th>';
        html += '<th style="padding:8px; background:#f8f9fa; border:1px solid #eee;">Time</th>';
        html += '<th style="padding:8px; background:#f8f9fa; border:1px solid #eee;">Classes</th>';
        html += '<th style="padding:8px; background:#f8f9fa; border:1px solid #eee;">Topic</th>';
        html += '</tr></thead><tbody>';

        // Sort matched by date desc
        matched.sort((a,b) => {
            const ta = a.__entryDate ? a.__entryDate.getTime() : 0;
            const tb = b.__entryDate ? b.__entryDate.getTime() : 0;
            return tb - ta;
        });

        matched.forEach(e => {
            const dateText = e.date || (e.__entryDate ? e.__entryDate.toISOString().slice(0,10) : 'N/A');
            const dayText = e.dayOfWeek || (e.__entryDate ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][e.__entryDate.getDay()] : '');
            const studentText = e.studentName || e.student || 'N/A';
            const timeText = (e.timeFrom || e.startTime) && (e.timeTo || e.endTime) ? `${e.timeFrom || e.startTime} - ${e.timeTo || e.endTime}` : (e.timeFrom || e.startTime || e.timeTo || e.endTime || 'N/A');
            html += `<tr style="border-bottom:1px solid #f0f0f0;\"><td style="padding:10px;">${dateText}</td><td style="padding:10px;">${dayText}</td><td style="padding:10px;">${studentText}</td><td style="padding:10px;">${timeText}</td><td style="padding:10px; text-align:right;">${e.classCount||0}</td><td style="padding:10px;">${e.topic||''}</td></tr>`;
        });

        html += '</tbody></table></div>';

        contentDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading teacher detail report:', error);
        contentDiv.innerHTML = '<div style="text-align:center; padding: 36px; color:#d93025;">Error loading details. See console.</div>';
    }
}

// Export Teacher Detail Report to Excel
window.exportTeacherDetailExcel = async function(teacherName, periodText) {
    try {
        console.log('[DEBUG] exportTeacherDetailExcel called for:', teacherName, periodText);
        
        // Get the same data that's displayed in the report
        const teacherDropdown = document.getElementById('advancedTeacherSelect');
        const timePeriod = document.getElementById('advancedTimePeriod')?.value || 'all';
        
        // Get all entries
        const entriesSnapshot = await getDocs(collection(db, "entries"));
        const allEntries = [];
        
        entriesSnapshot.forEach(d => {
            const data = d.data();
            data.id = d.id;
            
            // Parse date
            let entryDate = null;
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                entryDate = data.createdAt.toDate();
            } else if (data.date) {
                entryDate = new Date(data.date);
            }
            data.__entryDate = entryDate;
            allEntries.push(data);
        });
        
        // Filter by teacher
        let matched = allEntries.filter(e => {
            const teacherFieldValue = e.teacherName || e.teacher || '';
            return teacherFieldValue.trim().toLowerCase() === teacherName.trim().toLowerCase();
        });
        
        // Filter by time period
        if (timePeriod !== 'all') {
            const now = new Date();
            let cutoffDate = new Date();
            
            if (timePeriod === 'custom') {
                const fromVal = document.getElementById('advancedTimePeriodCustomFrom')?.value;
                const toVal = document.getElementById('advancedTimePeriodCustomTo')?.value;
                if (fromVal && toVal) {
                    const fromDate = new Date(fromVal);
                    const toDate = new Date(toVal);
                    toDate.setHours(23, 59, 59, 999);
                    matched = matched.filter(e => {
                        return e.__entryDate && e.__entryDate >= fromDate && e.__entryDate <= toDate;
                    });
                }
            } else {
                const days = parseInt(timePeriod);
                if (!isNaN(days)) {
                    cutoffDate.setDate(cutoffDate.getDate() - days);
                    matched = matched.filter(e => e.__entryDate && e.__entryDate >= cutoffDate);
                }
            }
        }
        
        if (matched.length === 0) {
            alert('No entries found for this teacher in the selected period');
            return;
        }
        
        // Calculate aggregations
        let totalHours = 0;
        let totalClasses = 0;
        const dayCounts = { 'Sunday':0,'Monday':0,'Tuesday':0,'Wednesday':0,'Thursday':0,'Friday':0,'Saturday':0 };
        const students = {};
        
        matched.forEach(e => {
            totalHours += calculateHoursDuration(e.timeFrom, e.timeTo);
            totalClasses += parseFloat(e.classCount) || 0;
            const d = e.__entryDate instanceof Date && !isNaN(e.__entryDate.getTime()) ? e.__entryDate : null;
            if (d) {
                const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                dayCounts[days[d.getDay()]] = (dayCounts[days[d.getDay()]] || 0) + 1;
            }
            const sname = e.studentName || e.student || 'Unknown';
            students[sname] = (students[sname] || 0) + 1;
        });
        
        // Sort entries by date descending
        matched.sort((a,b) => {
            const ta = a.__entryDate ? a.__entryDate.getTime() : 0;
            const tb = b.__entryDate ? b.__entryDate.getTime() : 0;
            return tb - ta;
        });
        
        // Create CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `Teacher Performance Report\n`;
        csv += `Teacher: ${teacherName}\n`;
        csv += `Period: ${periodText}\n`;
        csv += `Generated: ${formatDateDDMMYYYY(new Date())}\n\n`;
        
        // Summary section
        csv += `Summary\n`;
        csv += `Total Hours,${totalHours.toFixed(1)}\n`;
        csv += `Total Classes,${totalClasses.toFixed(1)}\n`;
        csv += `Unique Students,${Object.keys(students).length}\n`;
        csv += `Total Entries,${matched.length}\n\n`;
        
        // Classes by Day
        csv += `Classes by Day of Week\n`;
        csv += `Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday\n`;
        csv += `${dayCounts.Sunday},${dayCounts.Monday},${dayCounts.Tuesday},${dayCounts.Wednesday},${dayCounts.Thursday},${dayCounts.Friday},${dayCounts.Saturday}\n\n`;
        
        // Students taught
        csv += `Students Taught\n`;
        csv += `#,Student Name,Sessions\n`;
        const studentEntries = Object.entries(students).sort((a,b) => b[1]-a[1]);
        studentEntries.forEach(([name, cnt], idx) => {
            csv += `${idx+1},"${name.replace(/"/g, '""')}",${cnt}\n`;
        });
        csv += `\n`;
        
        // Detailed entries
        csv += `Detailed Entries\n`;
        csv += `Date,Day,Student,Time From,Time To,Classes,Sheet Made,Payment,Homework,Topic\n`;
        
        matched.forEach(e => {
            const dateText = e.date || (e.__entryDate ? formatDateDDMMYYYY(e.__entryDate) : 'N/A');
            const dayText = e.dayOfWeek || (e.__entryDate ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][e.__entryDate.getDay()] : '');
            const studentText = e.studentName || e.student || 'N/A';
            const timeFrom = e.timeFrom || '';
            const timeTo = e.timeTo || '';
            const classes = e.classCount || 0;
            const sheetMade = e.sheetMade || '';
            const payment = e.payment || '';
            const homework = e.homeworkGiven || '';
            const topic = (e.topic || '').replace(/"/g, '""');
            
            csv += `"${dateText}","${dayText}","${studentText.replace(/"/g, '""')}","${timeFrom}","${timeTo}",${classes},"${sheetMade}","${payment}","${homework}","${topic}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Teacher_Report_${teacherName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('Teacher detail report exported:', fileName);
        
    } catch (error) {
        console.error('Error exporting teacher detail report:', error);
        alert('Error exporting report: ' + error.message);
    }
}

// Notify host page that this module has finished defining its public APIs
try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event('appFirestoreReady'));
    }
} catch (e) {
    console.warn('Could not dispatch appFirestoreReady event:', e);
}

// ===== PDF TEMPLATE HELPER =====
function generatePDFTemplate(title, content) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>ZIEL Classes - ${title}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    height: 100%;
                }
                body {
                    font-family: 'Arial', 'Helvetica Neue', sans-serif;
                    color: #1a1a1a;
                    background: #ffffff;
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    line-height: 1.4;
                }
                .page-content {
                    flex: 1 0 auto;
                    padding: 25px 35px;
                }
                
                /* Header Section - Left Aligned */
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #2d5016;
                }
                .header-left {
                    text-align: left;
                    font-size: 9px;
                    line-height: 1.6;
                    color: #555;
                }
                .header-left div {
                    margin-bottom: 2px;
                    white-space: nowrap;
                }
                .header-center {
                    display: none;
                }
                .header-right {
                    text-align: right;
                    font-size: 9px;
                    line-height: 1.6;
                    color: #555;
                }
                .header-right div {
                    margin-bottom: 2px;
                    white-space: nowrap;
                }
                .logo {
                    width: 70px;
                    height: 70px;
                    display: block;
                    margin-bottom: 5px;
                }
                .brand-name {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1a1a1a;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                    font-family: 'Times New Roman', Georgia, serif;
                }
                .tagline {
                    font-size: 10px;
                    color: #666;
                    font-weight: 400;
                }
                .divider-line {
                    height: 1px;
                    background: #2d5016;
                    margin: 8px 0 12px 0;
                }
                
                /* Content Area */
                .content {
                    min-height: 200px;
                }
                
                /* Document Title */
                .doc-title {
                    font-size: 18px;
                    font-weight: 700;
                    color: #1a1a1a;
                    text-align: center;
                    margin: 10px 0 15px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                /* Section Headings */
                .section-heading {
                    font-size: 14px;
                    font-weight: 700;
                    color: #2d5016;
                    margin: 15px 0 8px 0;
                    padding-bottom: 4px;
                    border-bottom: 2px solid #2d5016;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                
                /* Info Block - Compact Grid */
                .info-block {
                    background: #fafafa;
                    border: 1px solid #ddd;
                    border-left: 3px solid #2d5016;
                    padding: 10px 12px;
                    margin: 10px 0;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 6px 15px;
                    font-size: 11px;
                }
                .info-row {
                    display: flex;
                    line-height: 1.4;
                }
                .info-row:last-child {
                    margin-bottom: 0;
                }
                .info-label {
                    font-weight: 700;
                    color: #1a1a1a;
                    min-width: 110px;
                    flex-shrink: 0;
                }
                .info-value {
                    color: #333;
                    flex: 1;
                }
                
                /* Table Styling - Compact */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 10px;
                }
                table th {
                    background: #e8f5e9;
                    color: #2d5016;
                    padding: 6px 5px;
                    text-align: left;
                    font-weight: 700;
                    border: 1px solid #c8e6c9;
                    text-transform: uppercase;
                    font-size: 9px;
                    letter-spacing: 0.3px;
                }
                table td {
                    padding: 5px;
                    border: 1px solid #ddd;
                    color: #1a1a1a;
                    text-align: left;
                }
                table tr:nth-child(even) {
                    background: #f9f9f9;
                }
                table tr:hover {
                    background: #f5f5f5;
                }
                
                /* Payment Card - Compact */
                .payment-card {
                    background: #fafafa;
                    border: 1px solid #ddd;
                    border-left: 3px solid #2d5016;
                    padding: 10px 12px;
                    margin: 8px 0;
                    page-break-inside: avoid;
                }
                .payment-card h3 {
                    color: #1a1a1a;
                    font-size: 13px;
                    font-weight: 700;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                .payment-details {
                    font-size: 10px;
                    line-height: 1.5;
                    color: #333;
                }
                .payment-details div {
                    margin-bottom: 4px;
                }
                .payment-details strong {
                    color: #1a1a1a;
                    font-weight: 700;
                }
                
                /* Footer Section - Compact */
                .footer {
                    flex-shrink: 0;
                    margin-top: 15px;
                    padding: 10px 35px;
                    background: #f5f5f5;
                    border-top: 2px solid #2d5016;
                    font-size: 8px;
                    color: #555;
                    page-break-inside: avoid;
                    page-break-before: avoid;
                }
                .footer-title {
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 5px;
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .footer p {
                    margin: 2px 0;
                    line-height: 1.4;
                }
                
                /* Print Button */
                .print-btn {
                    display: block;
                    margin: 20px auto;
                    padding: 12px 30px;
                    background: #8BC34A;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 15px;
                    cursor: pointer;
                    font-weight: 600;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .print-btn:hover {
                    background: #7ab93c;
                }
                
                /* Print Styles */
                @media print {
                    .print-btn { 
                        display: none; 
                    }
                    html, body {
                        height: 100%;
                    }
                    body {
                        display: flex;
                        flex-direction: column;
                    }
                    .page-content {
                        flex: 1 0 auto;
                        padding: 20px 30px;
                    }
                    .footer {
                        flex-shrink: 0;
                        padding: 8px 30px;
                    }
                    table {
                        font-size: 9px;
                    }
                    table th {
                        padding: 5px 4px;
                        font-size: 8px;
                    }
                    table td {
                        padding: 4px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="page-content">
                <div class="header">
                    <div class="header-left">
                        <img src="ziel.png" alt="ZIEL Logo" class="logo" onerror="this.style.display='none'">
                        <div class="brand-name">ZIEL CLASSES</div>
                        <div class="tagline">Let's Learn</div>
                    </div>
                    <div class="header-right">
                        <div>Call: +91 6289453638</div>
                        <div>Email: info@zielclasses.com</div>
                        <div>Web: www.zielclasses.com</div>
                    </div>
                </div>
                <div class="divider-line"></div>
                <div class="content">
                    ${content}
                </div>
            </div>
            <div class="footer">
                <div class="footer-title">Our Centres</div>
                <p><strong>Kasba (Main Branch)</strong> – Gayetri Villa, 68, Rajdanga, Kasba, Kolkata - 700107</p>
                <p><strong>Jadavpur</strong> – 2nd Floor, 400/1B, Prince Anwar Shah Rd, Opp. South City Mall, Kolkata - 700045</p>
                <p><strong>Nayabad</strong> – Premises No. 3145, DPK Housing 2nd Lane, Mukundapur, Kolkata - 700099</p>
                <p><strong>Chinar Park</strong> – Rajarhat Main Rd, Dash Drone, Kolkata - 700136</p>
            </div>
            <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </body>
        </html>
    `;
}

// ===== PDF COLUMN OPTIONS MODAL =====
window.openPDFOptionsModal = function() {
    const modal = document.getElementById('pdfOptionsModal');
    if (modal) {
        modal.style.display = 'block';
        return;
    }

    // Fallback for layouts where the modal markup is not present.
    console.warn('pdfOptionsModal not found. Exporting with default columns.');
    generateStudentPDFCustom({
        date: true,
        teacher: true,
        subject: true,
        time: true,
        classes: true,
        sheet: true,
        payment: true
    });
}

window.closePDFOptionsModal = function() {
    const modal = document.getElementById('pdfOptionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.selectAllPDFColumns = function() {
    const checkboxIds = [
        'pdfCol_date',
        'pdfCol_teacher',
        'pdfCol_subject',
        'pdfCol_time',
        'pdfCol_classes',
        'pdfCol_sheet',
        'pdfCol_payment'
    ];

    checkboxIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = true;
    });
}

window.generateStudentPDFWithOptions = async function() {
    const hasModalCheckboxes = !!document.getElementById('pdfCol_date');

    // If modal checkboxes do not exist in current page, export with defaults.
    const selectedColumns = hasModalCheckboxes
        ? {
            date: document.getElementById('pdfCol_date')?.checked ?? true,
            teacher: document.getElementById('pdfCol_teacher')?.checked ?? true,
            subject: document.getElementById('pdfCol_subject')?.checked ?? true,
            time: document.getElementById('pdfCol_time')?.checked ?? true,
            classes: document.getElementById('pdfCol_classes')?.checked ?? true,
            sheet: document.getElementById('pdfCol_sheet')?.checked ?? true,
            payment: document.getElementById('pdfCol_payment')?.checked ?? true
        }
        : {
            date: true,
            teacher: true,
            subject: true,
            time: true,
            classes: true,
            sheet: true,
            payment: true
        };
    
    // Close modal (safe no-op if modal doesn't exist)
    closePDFOptionsModal();
    
    // Generate PDF with selected columns
    await generateStudentPDFCustom(selectedColumns);
}

// ===== PDF GENERATION FOR STUDENT REPORTS =====
window.generateStudentPDF = async function() {
    const selectedStudent = document.getElementById("searchStudentReport")?.value;
    const timePeriod = document.getElementById("timePeriodFilter")?.value || "30";
    
    if (!selectedStudent) {
        alert("Please select a student first!");
        return;
    }
    
    try {
        // Get student entries
        const entriesQuery = query(
            collection(db, "entries"),
            where("studentName", "==", selectedStudent)
        );
        
        const snapshot = await getDocs(entriesQuery);
        
        // Calculate date filter (support custom range)
        let startDate = null;
        let endDate = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('timePeriodCustomFrom')?.value;
            const to = document.getElementById('timePeriodCustomTo')?.value;
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            startDate = parseLocalDateStart(from);
            endDate = parseLocalDateEnd(to);
        } else if (timePeriod !== "all") {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        
        // Filter and sort entries
        let entries = [];
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            // Prefer entry.date (class date), parse as local date; fallback to createdAt
            let entryDate = null;
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                if (!entryDate || isNaN(entryDate.getTime())) {
                    const parsed = new Date(entry.date + 'T00:00:00');
                    if (!isNaN(parsed.getTime())) entryDate = parsed;
                }
            }
            if (!entryDate && entry.createdAt) entryDate = entry.createdAt.toDate();

            // Check against start/end filters
            let inRange = true;
            if (startDate && endDate) {
                inRange = entryDate && entryDate >= startDate && entryDate <= endDate;
            } else if (startDate) {
                inRange = entryDate && entryDate >= startDate;
            }

            if (inRange) {
                // Format date as DD/MM/YYYY for display
                let formattedDate = entry.date;
                if (entry.date) {
                    const dateParts = ('' + entry.date).split('-').map(Number);
                    if (dateParts.length >= 3) {
                        formattedDate = `${String(dateParts[2]).padStart(2, '0')}/${String(dateParts[1]).padStart(2, '0')}/${dateParts[0]}`;
                    }
                }
                
                entries.push({
                    date: formattedDate,
                    dayOfWeek: entry.dayOfWeek,
                    teacher: entry.teacherName || "N/A",
                    subject: entry.subject || "N/A",
                    topic: entry.topic || "N/A",
                    timeFrom: entry.timeFrom || "",
                    timeTo: entry.timeTo || "",
                    classes: entry.classCount || 0,
                    sheetMade: entry.sheetMade || "No",
                    homeworkGiven: entry.homeworkGiven || "N/A",
                    payment: entry.payment || "",
                    rawDate: entry.date // Keep for sorting
                });
            }
        });
        
        // Sort by parsed entry date (prefer date field), newest first
        entries.sort((a, b) => {
            const parse = (x) => {
                if (!x.rawDate) return new Date(0);
                const parts = ('' + x.rawDate).split('-').map(Number);
                if (parts.length >= 3) return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                const p = new Date(x.rawDate + 'T00:00:00');
                return isNaN(p.getTime()) ? new Date(0) : p;
            };
            return parse(b) - parse(a);
        });
        
        if (entries.length === 0) {
            alert("No records found for the selected time period!");
            return;
        }
        
        // Generate period text for header
        let periodText = '';
        if (timePeriod === 'all') periodText = 'All Time';
        else if (timePeriod === 'custom') {
            const f = document.getElementById('timePeriodCustomFrom')?.value || '';
            const t = document.getElementById('timePeriodCustomTo')?.value || '';
            periodText = `Custom: ${f} → ${t}`;
        } else if (timePeriod === '7') periodText = 'Last 7 Days';
        else if (timePeriod === '30') periodText = 'Last 1 Month';
        else if (timePeriod === '90') periodText = 'Last 3 Months';
        else if (timePeriod === '180') periodText = 'Last 6 Months';
        else periodText = 'Last 1 Year';
        
        // Get student details
        const studentId = document.getElementById('selectedStudentId')?.value;
        let studentMode = 'N/A';
        let studentSubjects = 'All Subjects';
        
        // Calculate total class hours
        let totalClassHours = 0;
        entries.forEach(entry => {
            totalClassHours += parseFloat(entry.classes) || 0;
        });
        
        if (studentId) {
            try {
                const studentDoc = await getDoc(doc(db, 'students', studentId));
                if (studentDoc.exists()) {
                    const studentData = studentDoc.data();
                    studentMode = studentData.mode ? studentData.mode.charAt(0).toUpperCase() + studentData.mode.slice(1) : 'N/A';
                    if (studentData.subjects && studentData.subjects.length > 0) {
                        studentSubjects = studentData.subjects.join(', ');
                    }
                }
            } catch (error) {
                console.error('Error fetching student details:', error);
            }
        }
        
        // Build content for PDF template
        let content = `
            <div class="doc-title">Student Class Report</div>
            
            <div class="section-heading">Student Info</div>
            
            <div class="info-block">
                <div class="info-row">
                    <div class="info-label">Student Name:</div>
                    <div class="info-value">${selectedStudent}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Mode:</div>
                    <div class="info-value">${studentMode}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Report Period:</div>
                    <div class="info-value">${periodText}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Sessions:</div>
                    <div class="info-value">${entries.length}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Class Hours:</div>
                    <div class="info-value">${totalClassHours.toFixed(1)} hrs</div>
                </div>
            </div>
            
            <div class="section-heading">Class History</div>
            
            <table>
                <thead>
                    <tr>
                        <th style="background: #e3f2fd; color: #1565c0;">Date</th>
                        <th style="background: #f3e5f5; color: #6a1b9a;">Day</th>
                        <th style="background: #fff3e0; color: #e65100;">Teacher</th>
                        <th style="background: #e8f5e9; color: #2e7d32;">Subject</th>
                        <th style="background: #fce4ec; color: #c2185b;">Topic</th>
                        <th style="background: #fff9c4; color: #f57f17;">Time</th>
                        <th style="background: #e0f2f1; color: #00695c;">Classes</th>
                        <th style="background: #f1f8e9; color: #558b2f;">C/W Doc</th>
                        <th style="background: #fbe9e7; color: #bf360c;">Homework</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        entries.forEach(entry => {
            const timeRange = (entry.timeFrom || entry.startTime) && (entry.timeTo || entry.endTime) ? `${entry.timeFrom || entry.startTime} - ${entry.timeTo || entry.endTime}` : "N/A";
            const cwDoc = entry.sheetMade === "yes" ? "Yes" : "No";
            const homework = entry.homeworkGiven === "yes" ? "Yes" : entry.homeworkGiven === "no" ? "No" : "N/A";
            content += `
                    <tr>
                        <td>${entry.date}</td>
                        <td>${entry.dayOfWeek}</td>
                        <td>${entry.teacher}</td>
                        <td>${entry.subject}</td>
                        <td>${entry.topic}</td>
                        <td>${timeRange}</td>
                        <td style="text-align: center;">${entry.classes}</td>
                        <td style="text-align: center;">${cwDoc}</td>
                        <td style="text-align: center;">${homework}</td>
                    </tr>
            `;
        });
        
        content += `
                </tbody>
            </table>
        `;
        
        // Generate PDF using the standardized template with ZIEL branding
        const pdfContent = generatePDFTemplate('Student Class Report', content);
        
        // Open in new window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error generating PDF. Please try again.");
    }
}

// ===== PDF GENERATION WITH CUSTOM COLUMNS =====
window.generateStudentPDFCustom = async function(selectedColumns) {
    const selectedStudent = document.getElementById("searchStudentReport")?.value;
    const timePeriod = document.getElementById("timePeriodFilter")?.value || "30";
    
    console.log('PDF Custom - Selected Columns:', selectedColumns);
    
    if (!selectedStudent) {
        alert("Please select a student first!");
        return;
    }
    
    // Check if at least one column is selected
    const hasSelection = Object.values(selectedColumns).some(val => val === true);
    if (!hasSelection) {
        alert("Please select at least one column to display in the PDF!");
        const modal = document.getElementById('pdfOptionsModal');
        if (modal) {
            openPDFOptionsModal();
        }
        return;
    }
    
    try {
        // Get student entries
        const entriesQuery = query(
            collection(db, "entries"),
            where("studentName", "==", selectedStudent)
        );
        
        const snapshot = await getDocs(entriesQuery);
        console.log(`Found ${snapshot.size} entries for student: ${selectedStudent}`);
        
        // Calculate date filter (support custom range)
        let startDate = null;
        let endDate = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('timePeriodCustomFrom')?.value;
            const to = document.getElementById('timePeriodCustomTo')?.value;
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            startDate = parseLocalDateStart(from);
            endDate = parseLocalDateEnd(to);
        } else if (timePeriod !== "all") {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        
        // Filter and sort entries
        let entries = [];
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            console.log('PDF Entry payment:', entry.date, entry.studentName, 'Payment:', entry.payment);
            // Prefer entry.date (class date), parse as local date; fallback to createdAt
            let entryDate = null;
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                if (!entryDate || isNaN(entryDate.getTime())) {
                    const parsed = new Date(entry.date + 'T00:00:00');
                    if (!isNaN(parsed.getTime())) entryDate = parsed;
                }
            }
            if (!entryDate && entry.createdAt) entryDate = entry.createdAt.toDate();

            // Check against start/end filters
            let inRange = true;
            if (startDate && endDate) {
                inRange = entryDate && entryDate >= startDate && entryDate <= endDate;
            } else if (startDate) {
                inRange = entryDate && entryDate >= startDate;
            }

            if (inRange) {
                // Format date as DD/MM/YYYY for display
                let formattedDate = entry.date;
                if (entry.date) {
                    const dateParts = ('' + entry.date).split('-').map(Number);
                    if (dateParts.length >= 3) {
                        formattedDate = `${String(dateParts[2]).padStart(2, '0')}/${String(dateParts[1]).padStart(2, '0')}/${dateParts[0]}`;
                    }
                }
                
                entries.push({
                    date: formattedDate,
                    dayOfWeek: entry.dayOfWeek,
                    teacher: entry.teacherName || "N/A",
                    subject: entry.subject || "N/A",
                    topic: entry.topic || "N/A",
                    timeFrom: entry.timeFrom || "",
                    timeTo: entry.timeTo || "",
                    classes: entry.classCount || 0,
                    sheetMade: entry.sheetMade || "No",
                    homeworkGiven: entry.homeworkGiven || "N/A",
                    payment: entry.payment || "",
                    rawDate: entry.date // Keep for sorting
                });
            }
        });
        
        // Sort by parsed entry date (prefer date field), newest first
        entries.sort((a, b) => {
            const parse = (x) => {
                if (!x.rawDate) return new Date(0);
                const parts = ('' + x.rawDate).split('-').map(Number);
                if (parts.length >= 3) return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                const p = new Date(x.rawDate + 'T00:00:00');
                return isNaN(p.getTime()) ? new Date(0) : p;
            };
            return parse(b) - parse(a);
        });
        
        if (entries.length === 0) {
            alert("No records found for the selected time period!");
            return;
        }
        
        // Generate period text for header
        let periodText = '';
        if (timePeriod === 'all') periodText = 'All Time';
        else if (timePeriod === 'custom') {
            const f = document.getElementById('timePeriodCustomFrom')?.value || '';
            const t = document.getElementById('timePeriodCustomTo')?.value || '';
            periodText = `Custom: ${f} → ${t}`;
        } else if (timePeriod === '7') periodText = 'Last 7 Days';
        else if (timePeriod === '30') periodText = 'Last 1 Month';
        else if (timePeriod === '90') periodText = 'Last 3 Months';
        else if (timePeriod === '180') periodText = 'Last 6 Months';
        else periodText = 'Last 1 Year';
        
        // Get student details
        const studentId = document.getElementById('selectedStudentId')?.value;
        let studentMode = 'N/A';
        let studentSubjects = 'All Subjects';
        
        // Calculate total class hours
        let totalClassHours = 0;
        entries.forEach(entry => {
            totalClassHours += parseFloat(entry.classes) || 0;
        });
        
        if (studentId) {
            try {
                const studentDoc = await getDoc(doc(db, 'students', studentId));
                if (studentDoc.exists()) {
                    const studentData = studentDoc.data();
                    studentMode = studentData.mode ? studentData.mode.charAt(0).toUpperCase() + studentData.mode.slice(1) : 'N/A';
                    if (studentData.subjects && studentData.subjects.length > 0) {
                        studentSubjects = studentData.subjects.join(', ');
                    }
                }
            } catch (error) {
                console.error('Error fetching student details:', error);
            }
        }
        
        // Build content for PDF template with dynamic columns
        let content = `
            <div class="doc-title">Student Class Report</div>
            
            <div class="section-heading">Student Info</div>
            
            <div class="info-block">
                <div class="info-row">
                    <div class="info-label">Student Name:</div>
                    <div class="info-value">${selectedStudent}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Mode:</div>
                    <div class="info-value">${studentMode}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Report Period:</div>
                    <div class="info-value">${periodText}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Sessions:</div>
                    <div class="info-value">${entries.length}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Class Hours:</div>
                    <div class="info-value">${totalClassHours.toFixed(1)} hrs</div>
                </div>
            </div>
            
            <div class="section-heading">Class History</div>
            
            <table>
                <thead>
                    <tr>
        `;
        
        // Build table headers based on selected columns
        if (selectedColumns.date) {
            content += `<th style="background: #e3f2fd; color: #1565c0;">Date & Day</th>`;
        }
        if (selectedColumns.teacher) {
            content += `<th style="background: #fff3e0; color: #e65100;">Teacher</th>`;
        }
        if (selectedColumns.subject) {
            content += `<th style="background: #e8f5e9; color: #2e7d32;">Subject/Topic</th>`;
        }
        if (selectedColumns.time) {
            content += `<th style="background: #fce4ec; color: #c2185b;">Time</th>`;
        }
        if (selectedColumns.classes) {
            content += `<th style="background: #fff9c4; color: #f57f17;">Classes</th>`;
        }
        if (selectedColumns.sheet) {
            content += `<th style="background: #e0f2f1; color: #00695c;">Sheet Made</th>`;
        }
        if (selectedColumns.payment) {
            content += `<th style="background: #f3e5f5; color: #6a1b9a;">Payment</th>`;
        }
        
        content += `
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Build table rows based on selected columns
        entries.forEach(entry => {
            console.log('Building PDF row - Payment value:', entry.payment);
            const timeRange = (entry.timeFrom || entry.startTime) && (entry.timeTo || entry.endTime) ? `${entry.timeFrom || entry.startTime} - ${entry.timeTo || entry.endTime}` : "N/A";
            content += `<tr>`;
            
            if (selectedColumns.date) {
                content += `<td>${entry.date}<br><small style="color: #666;">${entry.dayOfWeek}</small></td>`;
            }
            if (selectedColumns.teacher) {
                content += `<td>${entry.teacher}</td>`;
            }
            if (selectedColumns.subject) {
                content += `<td>${entry.subject}</td>`;
            }
            if (selectedColumns.time) {
                content += `<td>${timeRange}</td>`;
            }
            if (selectedColumns.classes) {
                content += `<td style="text-align: center;">${entry.classes}</td>`;
            }
            if (selectedColumns.sheet) {
                content += `<td style="text-align: center;">${entry.sheetMade}</td>`;
            }
            if (selectedColumns.payment) {
                const paymentValue = entry.payment && entry.payment.trim() !== "" ? entry.payment : "-";
                console.log('Displaying payment:', paymentValue, 'from entry.payment:', entry.payment);
                content += `<td style="text-align: center;">${paymentValue}</td>`;
            }
            
            content += `</tr>`;
        });
        
        content += `
                </tbody>
            </table>
        `;
        
        // Generate PDF using the standardized template with ZIEL branding
        const pdfContent = generatePDFTemplate('Student Class Report', content);
        
        // Open in new window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error generating PDF. Please try again.");
    }
}

// ===== EXCEL EXPORT FOR STUDENT REPORTS =====
window.exportStudentExcel = async function() {
    const selectedStudent = document.getElementById("searchStudentReport")?.value;
    const timePeriod = document.getElementById("timePeriodFilter")?.value || "30";
    
    if (!selectedStudent) {
        alert("Please select a student first!");
        return;
    }
    
    try {
        // Get student entries
        const entriesQuery = query(
            collection(db, "entries"),
            where("studentName", "==", selectedStudent)
        );
        
        const snapshot = await getDocs(entriesQuery);
        
        // Calculate date filter (support custom range)
        let startDate = null;
        let endDate = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('timePeriodCustomFrom')?.value;
            const to = document.getElementById('timePeriodCustomTo')?.value;
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            startDate = parseLocalDateStart(from);
            endDate = parseLocalDateEnd(to);
        } else if (timePeriod !== "all") {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        
        // Filter and sort entries
        let entries = [];
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            // Prefer entry.date (class date), parse as local date; fallback to createdAt
            let entryDate = null;
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                if (!entryDate || isNaN(entryDate.getTime())) {
                    const parsed = new Date(entry.date + 'T00:00:00');
                    if (!isNaN(parsed.getTime())) entryDate = parsed;
                }
            }
            if (!entryDate && entry.createdAt) entryDate = entry.createdAt.toDate();

            // Check against start/end filters
            let inRange = true;
            if (startDate && endDate) {
                inRange = entryDate && entryDate >= startDate && entryDate <= endDate;
            } else if (startDate) {
                inRange = entryDate && entryDate >= startDate;
            }

            if (inRange) {
                entries.push({
                    date: entry.date,
                    dayOfWeek: entry.dayOfWeek,
                    teacher: entry.teacherName || "N/A",
                    subject: entry.subject || "N/A",
                    topic: entry.topic || "N/A",
                    timeFrom: entry.timeFrom || "",
                    timeTo: entry.timeTo || "",
                    classes: entry.classCount || 0,
                    sheetMade: entry.sheetMade || "No",
                    homeworkGiven: entry.homeworkGiven || "N/A",
                    payment: entry.payment || "",
                    homeworkGiven: entry.homeworkGiven || ""
                });
            }
        });
        
        // Sort by parsed entry date (prefer date field), newest first
        entries.sort((a, b) => {
            const parse = (x) => {
                if (!x.date) return new Date(0);
                const parts = ('' + x.date).split('-').map(Number);
                if (parts.length >= 3) return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                const p = new Date(x.date + 'T00:00:00');
                return isNaN(p.getTime()) ? new Date(0) : p;
            };
            return parse(b) - parse(a);
        });
        
        if (entries.length === 0) {
            alert("No records found for the selected time period!");
            return;
        }
        
        // Generate period text
        let periodText = '';
        if (timePeriod === 'all') periodText = 'All Time';
        else if (timePeriod === 'custom') {
            const f = document.getElementById('timePeriodCustomFrom')?.value || '';
            const t = document.getElementById('timePeriodCustomTo')?.value || '';
            periodText = `${f} to ${t}`;
        } else if (timePeriod === '7') periodText = 'Last 7 Days';
        else if (timePeriod === '30') periodText = 'Last 1 Month';
        else if (timePeriod === '90') periodText = 'Last 3 Months';
        else if (timePeriod === '180') periodText = 'Last 6 Months';
        else periodText = 'Last 1 Year';
        
        // Calculate statistics
        const totalClasses = entries.reduce((sum, e) => sum + parseFloat(e.classes || 0), 0);
        const teachers = [...new Set(entries.map(e => e.teacher))].filter(t => t && t !== 'N/A');
        
        // Create CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel to recognize encoding
        csv += `Student Report: ${selectedStudent}\n`;
        csv += `Period: ${periodText}\n`;
        csv += `Generated: ${formatDateDDMMYYYY(new Date())}\n`;
        csv += `Total Sessions: ${entries.length}\n`;
        csv += `Total Classes: ${totalClasses.toFixed(1)}\n`;
        csv += `Teachers: ${teachers.join(', ')}\n\n`;
        
        // Add table headers
        csv += 'Date,Day,Teacher,Subject/Topic,Time From,Time To,Classes,Sheet Made,Payment,Homework Given\n';
        
        // Add data rows
        entries.forEach(entry => {
            const row = [
                entry.date || '',
                entry.dayOfWeek || '',
                `"${entry.teacher}"`,
                `"${entry.subject}"`,
                entry.timeFrom || '',
                entry.timeTo || '',
                entry.classes,
                entry.sheetMade || '',
                `"${entry.payment}"`,
                entry.homeworkGiven || ''
            ];
            csv += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Student_Report_${selectedStudent.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Error generating Excel file. Please try again.");
    }
}

// ===== EXCEL EXPORT FOR TEACHER REPORTS =====
window.exportTeacherExcel = async function() {
    const timePeriod = document.getElementById('advancedTimePeriod')?.value || '30';
    
    try {
        // Determine date range using same rules as loadAdvancedReports
        let startDate = null;
        let endDate = null;
        if (timePeriod === 'custom') {
            const from = document.getElementById('advancedTimePeriodCustomFrom')?.value;
            const to = document.getElementById('advancedTimePeriodCustomTo')?.value;
            const parseLocalDateStart = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                if (!s) return null;
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            startDate = parseLocalDateStart(from);
            endDate = parseLocalDateEnd(to);
        } else if (timePeriod !== 'all') {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }

        // Fetch all entries
        const snapshot = await getDocs(query(collection(db, 'entries')));
        
        const teacherStats = {};
        
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            const teacherName = entry.teacherName || entry.teacher;
            if (!teacherName) return;

            // Determine entry date
            let entryDate = null;
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                if (!entryDate || isNaN(entryDate.getTime())) {
                    const parsed = new Date(entry.date + 'T00:00:00');
                    if (!isNaN(parsed.getTime())) entryDate = parsed;
                }
            }
            if (!entryDate && entry.createdAt && typeof entry.createdAt.toDate === 'function') {
                entryDate = entry.createdAt.toDate();
            }
            if (!entryDate && entry.createdAt) entryDate = new Date(entry.createdAt);

            // Apply date filters
            if (startDate && entryDate && entryDate < startDate) return;
            if (endDate && entryDate && entryDate > endDate) return;

            if (!teacherStats[teacherName]) {
                teacherStats[teacherName] = {
                    totalClasses: 0,
                    totalHours: 0,
                    students: new Set(),
                    totalPayment: 0
                };
            }
            
            teacherStats[teacherName].totalClasses += parseFloat(entry.classCount) || 0;
            teacherStats[teacherName].totalHours += calculateHoursDuration(entry.timeFrom, entry.timeTo);
            if (entry.studentName) {
                teacherStats[teacherName].students.add(entry.studentName);
            }
            
            // Parse payment
            const payment = entry.payment || "";
            const match = payment.match(/\d+/);
            if (match) {
                teacherStats[teacherName].totalPayment += parseInt(match[0]);
            }
        });
        
        // Sort teachers by total classes (descending)
        const sortedTeachers = Object.entries(teacherStats).sort((a, b) => b[1].totalClasses - a[1].totalClasses);
        
        if (sortedTeachers.length === 0) {
            alert("No data found for the selected time period!");
            return;
        }
        
        // Generate period text
        let periodText = '';
        if (timePeriod === 'all') periodText = 'All Time';
        else if (timePeriod === 'custom') {
            const f = document.getElementById('advancedTimePeriodCustomFrom')?.value || '';
            const t = document.getElementById('advancedTimePeriodCustomTo')?.value || '';
            periodText = `${f} to ${t}`;
        } else if (timePeriod === '7') periodText = 'Last 7 Days';
        else if (timePeriod === '30') periodText = 'Last 1 Month';
        else if (timePeriod === '90') periodText = 'Last 3 Months';
        else if (timePeriod === '180') periodText = 'Last 6 Months';
        else if (timePeriod === '365') periodText = 'Last 1 Year';
        else periodText = `Last ${timePeriod} Days`;
        
        // Create CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `Teacher Analytics Report\n`;
        csv += `Period: ${periodText}\n`;
        csv += `Generated: ${formatDateDDMMYYYY(new Date())}\n\n`;
        
        // Add table headers
        csv += 'Teacher Name,Total Classes,Total Hours,Students Taught,Total Payment (₹)\n';
        
        // Add data rows
        sortedTeachers.forEach(([teacherName, stats]) => {
            const row = [
                `"${teacherName}"`,
                stats.totalClasses.toFixed(1),
                stats.totalHours.toFixed(1),
                stats.students.size,
                stats.totalPayment
            ];
            csv += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Teacher_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Error generating Excel file. Please try again.");
    }
}

// ===== EXCEL EXPORT FOR ALL ENTRIES =====
window.exportAllEntriesExcel = async function() {
    try {
        // Check if we have entries already loaded, if not fetch them
        let entriesToExport = filteredAdminEntries && filteredAdminEntries.length > 0 
            ? filteredAdminEntries 
            : allAdminEntries;
        
        // If no entries loaded, fetch them from Firestore
        if (!entriesToExport || entriesToExport.length === 0) {
            const snapshot = await getDocs(collection(db, "entries"));
            entriesToExport = [];
            snapshot.forEach(doc => {
                entriesToExport.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
        if (entriesToExport.length === 0) {
            alert("No entries to export!");
            return;
        }
        
        // Get filter values for header info
        const dateFrom = document.getElementById("filterDateFrom")?.value || 'All';
        const dateTo = document.getElementById("filterDateTo")?.value || 'All';
        const teacher = document.getElementById("filterTeacher")?.value || 'All';
        const student = document.getElementById("filterStudent")?.value || 'All';
        const sheetMade = document.getElementById("filterSheetMade")?.value || 'All';
        
        // Create CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `All Entries Report\n`;
        csv += `Generated: ${formatDateTimeDDMMYYYY(new Date())}\n`;
        csv += `Total Entries: ${entriesToExport.length}\n`;
        csv += `Date Range: ${dateFrom} to ${dateTo}\n`;
        csv += `Teacher Filter: ${teacher}\n`;
        csv += `Student Filter: ${student}\n`;
        csv += `Sheet Made Filter: ${sheetMade}\n\n`;
        
        // Add table headers
        csv += 'Date,Day of Week,Teacher,Student,Time From,Time To,Classes,Sheet Made,Payment,Homework Given,Topic,Created At\n';
        
        // Add data rows
        entriesToExport.forEach(entry => {
            const createdAt = entry.createdAt && typeof entry.createdAt.toDate === 'function' 
                ? formatDateTimeDDMMYYYY(entry.createdAt.toDate()) 
                : (entry.createdAt ? formatDateTimeDDMMYYYY(new Date(entry.createdAt)) : '');
            
            const row = [
                entry.date || '',
                entry.dayOfWeek || '',
                `"${entry.teacherName || ''}"`,
                `"${entry.studentName || entry.student || ''}"`,
                entry.timeFrom || '',
                entry.timeTo || '',
                entry.classCount || 0,
                entry.sheetMade || '',
                `"${entry.payment || ''}"`,
                entry.homeworkGiven || '',
                `"${(entry.topic || '').replace(/"/g, '""')}"`,
                `"${createdAt}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `All_Entries_Report_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Error generating Excel file. Please try again.");
    }
}

// ===== EXPORT DATE RANGE MODAL FUNCTIONS =====
window.openExportDateRangeModal = function() {
    const modal = document.getElementById('exportDateRangeModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

window.closeExportDateRangeModal = function() {
    const modal = document.getElementById('exportDateRangeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.toggleExportCustomDates = function() {
    const customDiv = document.getElementById('exportCustomDateInputs');
    const selectedOption = document.querySelector('input[name="exportDateOption"]:checked')?.value;
    if (customDiv) {
        customDiv.style.display = selectedOption === 'custom' ? 'block' : 'none';
    }
}

window.confirmExportWithDateRange = async function() {
    const selectedOption = document.querySelector('input[name="exportDateOption"]:checked')?.value;
    
    try {
        let entriesToExport = [];
        
        if (selectedOption === 'filtered') {
            // Use currently filtered entries
            entriesToExport = filteredAdminEntries && filteredAdminEntries.length > 0 
                ? filteredAdminEntries 
                : allAdminEntries || [];
        } else {
            // Fetch all entries from Firestore
            const snapshot = await getDocs(collection(db, "entries"));
            snapshot.forEach(doc => {
                entriesToExport.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
        // Apply custom date range if selected
        if (selectedOption === 'custom') {
            const dateFrom = document.getElementById('exportDateFrom')?.value;
            const dateTo = document.getElementById('exportDateTo')?.value;
            
            if (!dateFrom || !dateTo) {
                alert('Please select both From and To dates');
                return;
            }
            
            const parseLocalDateStart = (s) => {
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 0, 0, 0, 0);
            };
            const parseLocalDateEnd = (s) => {
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d, 23, 59, 59, 999);
            };
            
            const startDate = parseLocalDateStart(dateFrom);
            const endDate = parseLocalDateEnd(dateTo);
            
            // Filter entries by date range
            entriesToExport = entriesToExport.filter(entry => {
                let entryDate = null;
                if (entry.date) {
                    const parts = ('' + entry.date).split('-').map(Number);
                    if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
                    if (!entryDate || isNaN(entryDate.getTime())) {
                        const parsed = new Date(entry.date + 'T00:00:00');
                        if (!isNaN(parsed.getTime())) entryDate = parsed;
                    }
                }
                if (!entryDate && entry.createdAt && typeof entry.createdAt.toDate === 'function') {
                    entryDate = entry.createdAt.toDate();
                }
                if (!entryDate && entry.createdAt) entryDate = new Date(entry.createdAt);
                
                return entryDate && entryDate >= startDate && entryDate <= endDate;
            });
        }
        
        if (entriesToExport.length === 0) {
            alert("No entries found for the selected date range!");
            return;
        }
        
        // Close modal
        closeExportDateRangeModal();
        
        // Generate CSV
        const dateFrom = selectedOption === 'custom' ? document.getElementById('exportDateFrom')?.value : 
                        (selectedOption === 'filtered' ? (document.getElementById('filterDateFrom')?.value || 'All') : 'All');
        const dateTo = selectedOption === 'custom' ? document.getElementById('exportDateTo')?.value : 
                      (selectedOption === 'filtered' ? (document.getElementById('filterDateTo')?.value || 'All') : 'All');
        
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `All Entries Report\n`;
        csv += `Generated: ${formatDateTimeDDMMYYYY(new Date())}\n`;
        csv += `Total Entries: ${entriesToExport.length}\n`;
        csv += `Export Type: ${selectedOption === 'all' ? 'All Entries' : (selectedOption === 'filtered' ? 'Filtered Entries' : 'Custom Date Range')}\n`;
        csv += `Date Range: ${dateFrom} to ${dateTo}\n\n`;
        
        // Add table headers
        csv += 'Date,Day of Week,Teacher,Student,Time From,Time To,Classes,Sheet Made,Payment,Homework Given,Topic,Created At\n';
        
        // Add data rows
        entriesToExport.forEach(entry => {
            const createdAt = entry.createdAt && typeof entry.createdAt.toDate === 'function' 
                ? formatDateTimeDDMMYYYY(entry.createdAt.toDate()) 
                : (entry.createdAt ? formatDateTimeDDMMYYYY(new Date(entry.createdAt)) : '');
            
            const row = [
                entry.date || '',
                entry.dayOfWeek || '',
                `"${entry.teacherName || ''}"`,
                `"${entry.studentName || entry.student || ''}"`,
                entry.timeFrom || '',
                entry.timeTo || '',
                entry.classCount || 0,
                entry.sheetMade || '',
                `"${entry.payment || ''}"`,
                entry.homeworkGiven || '',
                `"${(entry.topic || '').replace(/"/g, '""')}"`,
                `"${createdAt}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `All_Entries_Report_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Error generating Excel file. Please try again.");
    }
}

// ===== PAYMENT GATEWAY SYSTEM =====

// Global variables for payment system
let selectedPaymentType = null;
let allPaymentStudents = [];

// Load students for payment dropdown
async function loadPaymentStudents() {
    try {
        const studentsQuery = query(
            collection(db, "students"),
            where("status", "==", "active")
        );
        const snapshot = await getDocs(studentsQuery);
        
        allPaymentStudents = [];
        snapshot.forEach(doc => {
            allPaymentStudents.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        allPaymentStudents.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error("Error loading payment students:", error);
    }
}

// Filter payment student list
window.filterPaymentStudentList = function() {
    const searchInput = document.getElementById('paymentStudentSearch');
    const dropdown = document.getElementById('paymentStudentDropdown');
    
    if (!searchInput || !dropdown) {
        console.error('Payment search elements not found');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #666;">Type to search students...</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    const filtered = allPaymentStudents.filter(s => 
        s.name && s.name.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #999;">No students found</div>';
    } else {
        dropdown.innerHTML = filtered.map(s => `
            <div onclick="selectPaymentStudent('${s.id}', '${s.name.replace(/'/g, "\\'")}')" 
                 style="padding: 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;"
                 onmouseover="this.style.background='#f8f9fa'" 
                 onmouseout="this.style.background='white'">
                ${s.name}
            </div>
        `).join('');
    }
    
    dropdown.style.display = 'block';
}

// Show payment student dropdown
window.showPaymentStudentDropdown = function() {
    const dropdown = document.getElementById('paymentStudentDropdown');
    if (!dropdown) {
        console.error('Payment dropdown not found');
        return;
    }
    
    if (allPaymentStudents.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #666;">Loading students...</div>';
        dropdown.style.display = 'block';
        loadPaymentStudents().then(() => {
            filterPaymentStudentList();
        }).catch(error => {
            console.error('Error loading students:', error);
            dropdown.innerHTML = '<div style="padding: 12px; color: #e74c3c;">Error loading students. Please refresh.</div>';
        });
    } else {
        filterPaymentStudentList();
    }
}

// Select payment student
window.selectPaymentStudent = async function(studentId, studentName) {
    const studentIdInput = document.getElementById('selectedPaymentStudentId');
    const studentNameInput = document.getElementById('selectedPaymentStudentName');
    const searchInput = document.getElementById('paymentStudentSearch');
    const dropdown = document.getElementById('paymentStudentDropdown');
    const infoDiv = document.getElementById('selectedStudentInfo');
    const nameDisplay = document.getElementById('selectedStudentNameDisplay');
    
    if (!studentIdInput || !studentNameInput || !searchInput || !dropdown || !infoDiv || !nameDisplay) {
        console.error('Payment student selection elements not found');
        return;
    }
    
    studentIdInput.value = studentId;
    studentNameInput.value = studentName;
    searchInput.value = studentName;
    dropdown.style.display = 'none';
    
    infoDiv.style.display = 'block';
    nameDisplay.textContent = studentName;
    
    // Load payment history for this student
    try {
        await loadPaymentHistory(studentId);
    } catch (error) {
        console.error('Error loading payment history:', error);
    }
}

// Hide dropdown on click outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('paymentStudentDropdown');
    const searchInput = document.getElementById('paymentStudentSearch');
    
    if (dropdown && searchInput && !dropdown.contains(e.target) && !searchInput.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// Select payment type
window.selectPaymentType = function(type) {
    selectedPaymentType = type;
    
    // Reset all button styles
    ['monthly', 'perClass', 'lumpSum', 'custom'].forEach(t => {
        const btn = document.getElementById(`paymentType${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            btn.style.background = 'white';
            btn.style.borderColor = '#dadce0';
            btn.style.transform = 'scale(1)';
        }
    });
    
    // Highlight selected button
    const selectedBtn = document.getElementById(`paymentType${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (selectedBtn) {
        selectedBtn.style.background = 'linear-gradient(135deg, #667eea15, #764ba215)';
        selectedBtn.style.borderColor = '#667eea';
        selectedBtn.style.transform = 'scale(1.05)';
    }
    
    // Hide all forms
    const monthlyForm = document.getElementById('monthlyPaymentForm');
    const perClassForm = document.getElementById('perClassPaymentForm');
    const lumpSumForm = document.getElementById('lumpSumPaymentForm');
    const customForm = document.getElementById('customPaymentForm');
    const saveButton = document.getElementById('paymentSaveButton');
    
    if (monthlyForm) monthlyForm.style.display = 'none';
    if (perClassForm) perClassForm.style.display = 'none';
    if (lumpSumForm) lumpSumForm.style.display = 'none';
    if (customForm) customForm.style.display = 'none';
    
    // Show selected form
    const selectedForm = document.getElementById(`${type}PaymentForm`);
    if (selectedForm) {
        selectedForm.style.display = 'block';
    }
    if (saveButton) {
        saveButton.style.display = 'block';
    }
}

// Array to store subjects for per-class payment
let perClassSubjectsArray = [];

// Add subject to per-class payment
window.addSubject = function() {
    const subjectName = document.getElementById('subjectName')?.value.trim();
    const subjectFee = parseFloat(document.getElementById('subjectFee')?.value || 0);
    
    if (!subjectName) {
        alert('Please enter a subject name');
        return;
    }
    
    if (subjectFee <= 0) {
        alert('Please enter a valid fee amount');
        return;
    }
    
    // Add to array
    perClassSubjectsArray.push({
        name: subjectName,
        fee: subjectFee
    });
    
    // Clear inputs
    document.getElementById('subjectName').value = '';
    document.getElementById('subjectFee').value = '';
    
    // Update display
    updateSubjectsList();
}

// Remove subject from list
window.removeSubject = function(index) {
    perClassSubjectsArray.splice(index, 1);
    updateSubjectsList();
}

// Update subjects list display
function updateSubjectsList() {
    const subjectsListDiv = document.getElementById('subjectsList');
    const subjectsListContent = document.getElementById('subjectsListContent');
    
    if (perClassSubjectsArray.length === 0) {
        subjectsListDiv.style.display = 'none';
        return;
    }
    
    subjectsListDiv.style.display = 'block';
    
    // Build subjects list HTML
    let html = '';
    perClassSubjectsArray.forEach((subject, index) => {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e0e0e0;">
                <div style="flex: 1;">
                    <span style="font-weight: 500; color: #2c2c2c; font-size: 14px;">${subject.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 600; color: #667eea; font-size: 14px;">₹${subject.fee}</span>
                    <button type="button" onclick="removeSubject(${index})" style="padding: 4px 12px; background: #d93025; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Remove</button>
                </div>
            </div>
        `;
    });
    
    subjectsListContent.innerHTML = html;
}

// Save payment structure
window.savePaymentStructure = async function() {
    const studentId = document.getElementById('selectedPaymentStudentId').value;
    const studentName = document.getElementById('selectedPaymentStudentName').value;
    
    if (!studentId) {
        alert('Please select a student first');
        return;
    }
    
    if (!selectedPaymentType) {
        alert('Please select a payment type');
        return;
    }
    
    try {
        let paymentData = {
            studentId: studentId,
            studentName: studentName,
            paymentType: selectedPaymentType,
            createdAt: Timestamp.now(),
            createdBy: 'admin'
        };
        
        // Collect data based on payment type
        if (selectedPaymentType === 'monthly') {
            paymentData.amount = parseFloat(document.getElementById('monthlyFee')?.value || 0);
            paymentData.dateFrom = document.getElementById('monthlyDateFrom')?.value || '';
            paymentData.dateTo = document.getElementById('monthlyDateTo')?.value || '';
            paymentData.remarks = document.getElementById('monthlyRemarks')?.value.trim() || '';
            paymentData.lastPaymentText = document.getElementById('monthlyLastPaymentText')?.value.trim() || '';
            paymentData.lastPaymentAmount = parseFloat(document.getElementById('monthlyLastPaymentAmount')?.value || 0);
            paymentData.recurring = true; // Mark as recurring payment
        } else if (selectedPaymentType === 'perClass') {
            if (perClassSubjectsArray.length === 0) {
                alert('Please add at least one subject');
                return;
            }
            
            // Calculate totals from subjects array
            const totalAmount = perClassSubjectsArray.reduce((sum, subject) => sum + subject.fee, 0);
            const subjectsListText = perClassSubjectsArray.map(s => `${s.name} (₹${s.fee})`).join(', ');
            
            paymentData.subjects = perClassSubjectsArray; // Store array of subjects with individual fees
            paymentData.numberOfSubjects = perClassSubjectsArray.length;
            paymentData.totalAmount = totalAmount;
            paymentData.subjectsList = subjectsListText;
            paymentData.remarks = document.getElementById('perClassRemarks')?.value.trim() || '';
            paymentData.lastPaymentText = document.getElementById('perClassLastPaymentText')?.value.trim() || '';
            paymentData.lastPaymentAmount = parseFloat(document.getElementById('perClassLastPaymentAmount')?.value || 0);
        } else if (selectedPaymentType === 'lumpSum') {
            paymentData.totalAmount = parseFloat(document.getElementById('lumpSumAmount')?.value || 0);
            paymentData.timePeriod = document.getElementById('lumpSumPeriod')?.value.trim() || '';
            paymentData.validFrom = document.getElementById('lumpSumValidFrom')?.value || '';
            paymentData.validTo = document.getElementById('lumpSumValidTo')?.value || '';
            paymentData.remarks = document.getElementById('lumpSumRemarks')?.value.trim() || '';
            paymentData.lastPaymentText = document.getElementById('lumpSumLastPaymentText')?.value.trim() || '';
            paymentData.lastPaymentAmount = parseFloat(document.getElementById('lumpSumLastPaymentAmount')?.value || 0);
        } else if (selectedPaymentType === 'custom') {
            paymentData.amount = parseFloat(document.getElementById('customAmount')?.value || 0);
            paymentData.timePeriod = document.getElementById('customPeriod')?.value.trim() || '';
            paymentData.validFrom = document.getElementById('customValidFrom')?.value || '';
            paymentData.validTo = document.getElementById('customValidTo')?.value || '';
            paymentData.remarks = document.getElementById('customRemarks')?.value.trim() || '';
            paymentData.lastPaymentText = document.getElementById('customLastPaymentText')?.value.trim() || '';
            paymentData.lastPaymentAmount = parseFloat(document.getElementById('customLastPaymentAmount')?.value || 0);
        }
        
        // Save to Firestore: students/{studentId}/payments/{autoId}
        const paymentsRef = collection(db, 'students', studentId, 'payments');
        await addDoc(paymentsRef, paymentData);
        
        alert('✅ Payment structure saved successfully!');
        
        // Clear form
        clearPaymentForm();
        
        // Reload payment history
        await loadPaymentHistory(studentId);
        
    } catch (error) {
        console.error('Error saving payment structure:', error);
        alert('Error saving payment structure: ' + error.message);
    }
}

// Clear payment form
function clearPaymentForm() {
    // Clear all input fields
    ['monthly', 'perClass', 'lumpSum', 'custom'].forEach(type => {
        const form = document.getElementById(`${type}PaymentForm`);
        if (form) {
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => input.value = '');
        }
    });
    
    // Clear subjects array for per-class payment
    perClassSubjectsArray = [];
    updateSubjectsList();
    
    // Reset selected payment type
    selectedPaymentType = null;
    ['monthly', 'perClass', 'lumpSum', 'custom'].forEach(t => {
        const btn = document.getElementById(`paymentType${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            btn.style.background = 'white';
            btn.style.borderColor = '#dadce0';
            btn.style.transform = 'scale(1)';
        }
    });
    
    // Hide forms
    document.getElementById('monthlyPaymentForm').style.display = 'none';
    document.getElementById('perClassPaymentForm').style.display = 'none';
    document.getElementById('lumpSumPaymentForm').style.display = 'none';
    document.getElementById('customPaymentForm').style.display = 'none';
    document.getElementById('paymentSaveButton').style.display = 'none';
}

// ==================== EXPORT ALL PAYMENTS WITH OPTIONS ====================

// Open export all payments modal
window.openExportAllPaymentsModal = function() {
    const modal = document.getElementById('exportAllPaymentsModal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        alert('Export modal not found. Please refresh the page.');
    }
};

// Close export all payments modal
window.closeExportAllPaymentsModal = function() {
    const modal = document.getElementById('exportAllPaymentsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Toggle export date filter visibility
window.toggleExportDateFilter = function(filterType) {
    const customDateRange = document.getElementById('exportCustomDateRange');
    const radioAll = document.getElementById('exportAll');
    const radioCustom = document.getElementById('exportCustom');
    
    if (filterType === 'all') {
        radioAll.checked = true;
        radioCustom.checked = false;
        if (customDateRange) customDateRange.style.display = 'none';
    } else if (filterType === 'custom') {
        radioCustom.checked = true;
        radioAll.checked = false;
        if (customDateRange) customDateRange.style.display = 'block';
    }
};

// Confirm and execute export with options
window.confirmExportAllPayments = async function() {
    try {
        // Get filter options
        const dateFilter = document.querySelector('input[name="exportDateFilter"]:checked')?.value || 'all';
        const dateFrom = document.getElementById('exportDateFrom')?.value;
        const dateTo = document.getElementById('exportDateTo')?.value;
        const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'excel';
        
        // Validate custom date range
        if (dateFilter === 'custom' && (!dateFrom || !dateTo)) {
            alert('Please select both From and To dates for custom date range.');
            return;
        }
        
        if (dateFilter === 'custom' && new Date(dateFrom) > new Date(dateTo)) {
            alert('From date cannot be after To date.');
            return;
        }
        
        // Close modal
        window.closeExportAllPaymentsModal();
        
        // Execute export based on format (sortOrder removed, always chronological)
        if (format === 'excel') {
            await window.exportAllPaymentsExcelWithOptions(dateFilter, dateFrom, dateTo);
        } else if (format === 'pdf') {
            await window.exportAllPaymentsPDFWithOptions(dateFilter, dateFrom, dateTo);
        }
        
    } catch (error) {
        console.error('Error in confirmExportAllPayments:', error);
        alert('Error processing export: ' + error.message);
    }
};

// Export all payments to Excel with filtering and sorting options
window.exportAllPaymentsExcelWithOptions = async function(dateFilter, dateFrom, dateTo) {
    console.log('Export All Payments (Excel) with options:', { dateFilter, dateFrom, dateTo });
    
    // Prevent multiple simultaneous exports
    if (window.isExportingAllPayments) {
        console.log('Export already in progress, ignoring request');
        return;
    }
    window.isExportingAllPayments = true;
    
    try {
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'exportLoadingMsg';
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; font-family: Roboto, sans-serif; text-align: center;';
        loadingMsg.innerHTML = '<div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Exporting Payment Data...</div><div id="exportProgress" style="font-size: 14px; color: #666;">Fetching students...</div>';
        document.body.appendChild(loadingMsg);
        
        // Get all active students
        const studentsQuery = query(
            collection(db, "students"),
            where("status", "==", "active")
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        console.log('Students fetched:', studentsSnapshot.size);
        
        if (studentsSnapshot.empty) {
            let loadingMsgEl = document.getElementById('exportLoadingMsg');
            if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
            window.isExportingAllPayments = false;
            alert('No active students found');
            return;
        }
        
        let totalPayments = 0;
        let processedStudents = 0;
        const allRows = [];
        
        // Convert date strings to Date objects for filtering
        const fromDate = dateFilter === 'custom' ? new Date(dateFrom) : null;
        const toDate = dateFilter === 'custom' ? new Date(dateTo + 'T23:59:59') : null;
        
        // Helper function to process a single student
        const processStudent = async (studentDoc) => {
            const studentData = studentDoc.data();
            const studentName = studentData.name || 'Unknown';
            const studentId = studentDoc.id;
            
            try {
                // Get payments for this student
                const paymentsQuery = query(
                    collection(db, "students", studentId, "payments"),
                    orderBy("createdAt", "asc")
                );
                const paymentsSnapshot = await getDocs(paymentsQuery);
                
                paymentsSnapshot.forEach(paymentDoc => {
                    const payment = paymentDoc.data();
                    const createdDate = payment.createdAt?.toDate ? payment.createdAt.toDate() : null;
                    
                    // Apply date filter
                    if (dateFilter === 'custom' && createdDate) {
                        if (createdDate < fromDate || createdDate > toDate) {
                            return; // Skip this payment
                        }
                    }
                    
                    totalPayments++;
                    
                    let paymentType = payment.paymentType || 'N/A';
                    let amount = '';
                    let numberOfSubjects = '';
                    let subjectsList = '';
                    let paymentPeriod = '';
                    let advanced = '';
                    let timePeriod = '';
                    let sortingDate = createdDate; // Default to created date
                    
                    if (payment.paymentType === 'monthly') {
                        paymentType = 'Monthly Recurring';
                        amount = payment.amount || payment.monthlyFee || 0;
                        paymentPeriod = payment.dateFrom ? `${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}` : '';
                        advanced = payment.advanced || 0;
                        // Use dateFrom for sorting if available
                        if (payment.dateFrom) {
                            sortingDate = new Date(payment.dateFrom);
                        }
                    } else if (payment.paymentType === 'perClass') {
                        paymentType = 'Per Class';
                        amount = payment.totalAmount || 0;
                        numberOfSubjects = payment.numberOfSubjects || 0;
                        if (payment.subjects && Array.isArray(payment.subjects)) {
                            subjectsList = payment.subjects.map(s => `${s.name} (₹${s.fee})`).join('; ');
                        } else {
                            subjectsList = payment.subjectsList || '';
                        }
                    } else if (payment.paymentType === 'lumpSum') {
                        paymentType = 'Lump Sum';
                        amount = payment.totalAmount || 0;
                        timePeriod = payment.timePeriod || '';
                    } else if (payment.paymentType === 'custom') {
                        paymentType = 'Custom';
                        amount = payment.amount || 0;
                        timePeriod = payment.timePeriod || '';
                    }
                    
                    allRows.push({
                        studentName,
                        paymentType,
                        amount: amount.toString(),
                        numberOfSubjects: numberOfSubjects.toString(),
                        subjectsList,
                        paymentPeriod,
                        advanced: advanced.toString(),
                        timePeriod,
                        remarks: (payment.remarks || '').replace(/[\n\r,]/g, ' '),
                        lastPaymentText: (payment.lastPaymentText || '').replace(/[\n\r,]/g, ' '),
                        lastPaymentAmount: (payment.lastPaymentAmount || '').toString(),
                        createdDate: createdDate ? `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}` : 'N/A',
                        createdTimestamp: createdDate ? createdDate.getTime() : 0,
                        sortingTimestamp: sortingDate ? sortingDate.getTime() : (createdDate ? createdDate.getTime() : 0)
                    });
                });
            } catch (error) {
                console.error(`Error processing student ${studentId}:`, error);
            }
        };
        
        // Process all students
        const studentDocs = studentsSnapshot.docs;
        for (let i = 0; i < studentDocs.length; i += 20) {
            const batch = studentDocs.slice(i, i + 20);
            await Promise.all(batch.map(processStudent));
            processedStudents += batch.length;
            
            // Update progress
            const progressEl = document.getElementById('exportProgress');
            if (progressEl) {
                progressEl.textContent = `Processing: ${processedStudents}/${studentDocs.length} students...`;
            }
        }
        
        if (allRows.length === 0) {
            let loadingMsgEl = document.getElementById('exportLoadingMsg');
            if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
            window.isExportingAllPayments = false;
            alert('No payment records found matching your criteria');
            return;
        }
        
        // Always sort by date chronologically (oldest to newest)
        // For monthly payments, use the payment period start date (dateFrom)
        // For other payments, use the creation date
        // This ensures proper chronological order: Jan, Feb, Mar... Dec
        allRows.sort((a, b) => {
            return a.sortingTimestamp - b.sortingTimestamp;
        });
        
        // Create CSV content with serial numbers based on chronological order
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `All Students Payment History\n`;
        const now = new Date();
        csv += `Generated on: ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}\n`;
        if (dateFilter === 'custom') {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            csv += `Date Range: ${String(from.getDate()).padStart(2, '0')}/${String(from.getMonth() + 1).padStart(2, '0')}/${from.getFullYear()} to ${String(to.getDate()).padStart(2, '0')}/${String(to.getMonth() + 1).padStart(2, '0')}/${to.getFullYear()}\n`;
        }
        csv += `Total Records: ${allRows.length}\n\n`;
        csv += 'S.No,Student Name,Payment Type,Amount,Number of Subjects,Subjects,Payment Period,Advanced,Time Period,Remarks,Last Payment Text,Last Payment Amount,Created Date\n';
        
        // Add rows with serial numbers
        allRows.forEach((row, index) => {
            const serialNo = index + 1;
            csv += `${serialNo},${row.studentName},${row.paymentType},${row.amount},${row.numberOfSubjects},${row.subjectsList},${row.paymentPeriod},${row.advanced},${row.timePeriod},${row.remarks},${row.lastPaymentText},${row.lastPaymentAmount},${row.createdDate}\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        let fileName = `All_Payments_${new Date().toISOString().split('T')[0]}`;
        if (dateFilter === 'custom') {
            fileName += `_${dateFrom}_to_${dateTo}`;
        }
        fileName += '.csv';
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Remove loading message
        let loadingMsgEl = document.getElementById('exportLoadingMsg');
        if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
        
        console.log(`Exported ${allRows.length} payment records:`, fileName);
        alert(`Exported ${allRows.length} payment records successfully!`);
        
    } catch (error) {
        console.error('Error exporting all payments:', error);
        
        // Remove loading message
        let loadingMsgEl = document.getElementById('exportLoadingMsg');
        if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
        
        alert('Error exporting payments: ' + error.message);
    } finally {
        window.isExportingAllPayments = false;
    }
};

// Export all payments to PDF with filtering and sorting options
window.exportAllPaymentsPDFWithOptions = async function(dateFilter, dateFrom, dateTo) {
    console.log('Export All Payments (PDF) with options:', { dateFilter, dateFrom, dateTo });
    
    // Prevent multiple simultaneous exports
    if (window.isExportingAllPayments) {
        console.log('Export already in progress, ignoring request');
        return;
    }
    window.isExportingAllPayments = true;
    
    try {
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'exportLoadingMsg';
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; font-family: Roboto, sans-serif; text-align: center;';
        loadingMsg.innerHTML = '<div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Generating PDF...</div><div id="exportProgress" style="font-size: 14px; color: #666;">Fetching students...</div>';
        document.body.appendChild(loadingMsg);
        
        // Get all active students
        const studentsQuery = query(
            collection(db, "students"),
            where("status", "==", "active")
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        console.log('Students fetched:', studentsSnapshot.size);
        
        if (studentsSnapshot.empty) {
            let loadingMsgEl = document.getElementById('exportLoadingMsg');
            if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
            window.isExportingAllPayments = false;
            alert('No active students found');
            return;
        }
        
        let totalPayments = 0;
        let processedStudents = 0;
        const allRows = [];
        
        // Convert date strings to Date objects for filtering
        const fromDate = dateFilter === 'custom' ? new Date(dateFrom) : null;
        const toDate = dateFilter === 'custom' ? new Date(dateTo + 'T23:59:59') : null;
        
        // Helper function to process a single student
        const processStudent = async (studentDoc) => {
            const studentData = studentDoc.data();
            const studentName = studentData.name || 'Unknown';
            const studentId = studentDoc.id;
            
            try {
                // Get payments for this student
                const paymentsQuery = query(
                    collection(db, "students", studentId, "payments"),
                    orderBy("createdAt", "asc")
                );
                const paymentsSnapshot = await getDocs(paymentsQuery);
                
                paymentsSnapshot.forEach(paymentDoc => {
                    const payment = paymentDoc.data();
                    const createdDate = payment.createdAt?.toDate ? payment.createdAt.toDate() : null;
                    
                    // Apply date filter
                    if (dateFilter === 'custom' && createdDate) {
                        if (createdDate < fromDate || createdDate > toDate) {
                            return; // Skip this payment
                        }
                    }
                    
                    totalPayments++;
                    
                    let paymentType = payment.paymentType || 'N/A';
                    let amount = '';
                    let numberOfSubjects = '';
                    let subjectsList = '';
                    let paymentPeriod = '';
                    let advanced = '';
                    let timePeriod = '';
                    let sortingDate = createdDate; // Default to created date
                    
                    if (payment.paymentType === 'monthly') {
                        paymentType = 'Monthly Recurring';
                        amount = payment.amount || payment.monthlyFee || 0;
                        paymentPeriod = payment.dateFrom ? `${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}` : '';
                        advanced = payment.advanced || 0;
                        // Use dateFrom for sorting if available
                        if (payment.dateFrom) {
                            sortingDate = new Date(payment.dateFrom);
                        }
                    } else if (payment.paymentType === 'perClass') {
                        paymentType = 'Per Class';
                        amount = payment.totalAmount || 0;
                        numberOfSubjects = payment.numberOfSubjects || 0;
                        if (payment.subjects && Array.isArray(payment.subjects)) {
                            subjectsList = payment.subjects.map(s => `${s.name} (₹${s.fee})`).join(', ');
                        } else {
                            subjectsList = payment.subjectsList || '';
                        }
                    } else if (payment.paymentType === 'lumpSum') {
                        paymentType = 'Lump Sum';
                        amount = payment.totalAmount || 0;
                        timePeriod = payment.timePeriod || '';
                    } else if (payment.paymentType === 'custom') {
                        paymentType = 'Custom';
                        amount = payment.amount || 0;
                        timePeriod = payment.timePeriod || '';
                    }
                    
                    allRows.push({
                        studentName,
                        paymentType,
                        amount,
                        numberOfSubjects,
                        subjectsList,
                        paymentPeriod,
                        advanced,
                        timePeriod,
                        remarks: payment.remarks || '',
                        lastPaymentText: payment.lastPaymentText || '',
                        lastPaymentAmount: payment.lastPaymentAmount || '',
                        createdDate: createdDate ? `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}` : 'N/A',
                        createdTimestamp: createdDate ? createdDate.getTime() : 0,
                        sortingTimestamp: sortingDate ? sortingDate.getTime() : (createdDate ? createdDate.getTime() : 0)
                    });
                });
            } catch (error) {
                console.error(`Error processing student ${studentId}:`, error);
            }
        };
        
        // Process all students
        const studentDocs = studentsSnapshot.docs;
        for (let i = 0; i < studentDocs.length; i += 20) {
            const batch = studentDocs.slice(i, i + 20);
            await Promise.all(batch.map(processStudent));
            processedStudents += batch.length;
            
            // Update progress
            const progressEl = document.getElementById('exportProgress');
            if (progressEl) {
                progressEl.textContent = `Processing: ${processedStudents}/${studentDocs.length} students...`;
            }
        }
        
        if (allRows.length === 0) {
            let loadingMsgEl = document.getElementById('exportLoadingMsg');
            if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
            window.isExportingAllPayments = false;
            alert('No payment records found matching your criteria');
            return;
        }
        
        // Always sort by date chronologically (oldest to newest)
        // For monthly payments, use the payment period start date (dateFrom)
        // For other payments, use the creation date
        // This ensures proper chronological order: Jan, Feb, Mar... Dec
        allRows.sort((a, b) => {
            return a.sortingTimestamp - b.sortingTimestamp;
        });
        
        // Generate PDF HTML
        let pdfHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>All Payments Report</title>
                <style>
                    @media print {
                        @page {
                            size: A4 landscape;
                            margin: 10mm;
                        }
                        body { margin: 0; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        font-size: 10px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #0F9D58;
                        padding-bottom: 10px;
                    }
                    .header h1 {
                        margin: 5px 0;
                        color: #0F9D58;
                        font-size: 20px;
                    }
                    .header p {
                        margin: 3px 0;
                        color: #666;
                        font-size: 11px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 6px;
                        text-align: left;
                        font-size: 9px;
                    }
                    th {
                        background-color: #0F9D58;
                        color: white;
                        font-weight: bold;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: center;
                        font-size: 9px;
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>All Students Payment History</h1>
                    <p>Generated on: ${(() => {
                        const now = new Date();
                        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} at ${now.toLocaleTimeString('en-IN')}`;
                    })()}</p>
                    ${dateFilter === 'custom' ? `<p>Date Range: ${(() => {
                        const from = new Date(dateFrom);
                        const to = new Date(dateTo);
                        return `${String(from.getDate()).padStart(2, '0')}/${String(from.getMonth() + 1).padStart(2, '0')}/${from.getFullYear()} to ${String(to.getDate()).padStart(2, '0')}/${String(to.getMonth() + 1).padStart(2, '0')}/${to.getFullYear()}`;
                    })()}</p>` : ''}
                    <p>Total Records: ${allRows.length}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px;">S.No</th>
                            <th style="width: 100px;">Student Name</th>
                            <th style="width: 80px;">Payment Type</th>
                            <th style="width: 60px;">Amount</th>
                            <th style="width: 150px;">Subjects</th>
                            <th style="width: 100px;">Payment Period</th>
                            <th style="width: 50px;">Advanced</th>
                            <th style="width: 80px;">Time Period</th>
                            <th style="width: 120px;">Remarks</th>
                            <th style="width: 80px;">Created Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add rows with serial numbers
        allRows.forEach((row, index) => {
            const serialNo = index + 1;
            pdfHTML += `
                <tr>
                    <td>${serialNo}</td>
                    <td>${row.studentName}</td>
                    <td>${row.paymentType}</td>
                    <td>₹${row.amount}</td>
                    <td>${row.subjectsList || '-'}</td>
                    <td>${row.paymentPeriod || '-'}</td>
                    <td>${row.advanced ? '₹' + row.advanced : '-'}</td>
                    <td>${row.timePeriod || '-'}</td>
                    <td>${row.remarks || '-'}</td>
                    <td>${row.createdDate}</td>
                </tr>
            `;
        });
        
        pdfHTML += `
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>This is a computer-generated report. Total ${allRows.length} payment records from ${studentsSnapshot.size} active students.</p>
                </div>
                
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;
        
        // Remove loading message
        let loadingMsgEl = document.getElementById('exportLoadingMsg');
        if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
        
        // Open PDF in new window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(pdfHTML);
            printWindow.document.close();
        } else {
            alert('Please allow popups to generate PDF');
        }
        
        console.log(`Generated PDF with ${allRows.length} payment records`);
        
    } catch (error) {
        console.error('Error exporting all payments to PDF:', error);
        
        // Remove loading message
        let loadingMsgEl = document.getElementById('exportLoadingMsg');
        if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
        
        alert('Error generating PDF: ' + error.message);
    } finally {
        window.isExportingAllPayments = false;
    }
};

// ==================== END EXPORT ALL PAYMENTS WITH OPTIONS ====================

// Export all payments for all students to Excel
window.exportAllPaymentsExcel = async function() {
    console.log('Export All Payments button clicked');
    
    // Prevent multiple simultaneous exports
    if (window.isExportingAllPayments) {
        console.log('Export already in progress, ignoring click');
        return;
    }
    window.isExportingAllPayments = true;
    
    try {
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'exportLoadingMsg';
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; font-family: Roboto, sans-serif; text-align: center;';
        loadingMsg.innerHTML = '<div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Exporting Payment Data...</div><div id="exportProgress" style="font-size: 14px; color: #666;">Fetching students...</div>';
        document.body.appendChild(loadingMsg);
        
        // Get all active students
        const studentsQuery = query(
            collection(db, "students"),
            where("status", "==", "active")
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        console.log('Students fetched:', studentsSnapshot.size);
        
        if (studentsSnapshot.empty) {
            let loadingMsgEl = document.getElementById('exportLoadingMsg');
            if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
            window.isExportingAllPayments = false;
            alert('No active students found');
            return;
        }
        
        // Create CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `All Students Payment History\n`;
        csv += `Generated on: ${new Date().toLocaleDateString('en-IN')}\n\n`;
        csv += 'S.No,Student Name,Payment Type,Amount,Number of Subjects,Subjects,Payment Period,Advanced,Time Period,Remarks,Last Payment Text,Last Payment Amount,Created Date\n';
        
        let totalPayments = 0;
        let processedStudents = 0;
        const allRows = [];
        
        // Helper function to process a single student
        const processStudent = async (studentDoc) => {
            const studentData = studentDoc.data();
            const studentName = studentData.name || 'Unknown';
            const studentId = studentDoc.id;
            const rows = [];
            
            try {
                const payments = await getStudentPayments(studentId);
                
                payments.forEach(payment => {
                    const createdDate = payment.createdAt?.toDate ? payment.createdAt.toDate() : null;
                    const createdTimestamp = createdDate ? createdDate.getTime() : 0;
                    const createdDateStr = createdDate ? `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}` : 'N/A';
                    
                    let paymentType = payment.paymentType || 'N/A';
                    let amount = '';
                    let numberOfSubjects = '';
                    let subjectsList = '';
                    let paymentPeriod = '';
                    let advanced = '';
                    let timePeriod = '';
                    let sortingDate = createdDate; // Default to created date
                    
                    if (payment.paymentType === 'monthly') {
                        paymentType = 'Monthly Recurring';
                        amount = payment.amount || payment.monthlyFee || 0;
                        paymentPeriod = payment.dateFrom ? `${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}` : '';
                        advanced = payment.advanced || 0;
                        // Use dateFrom for sorting if available
                        if (payment.dateFrom) {
                            sortingDate = new Date(payment.dateFrom);
                        }
                    } else if (payment.paymentType === 'perClass') {
                        paymentType = 'Per Class';
                        amount = payment.totalAmount || 0;
                        numberOfSubjects = payment.numberOfSubjects || 0;
                        if (payment.subjects && Array.isArray(payment.subjects)) {
                            subjectsList = payment.subjects.map(s => `${s.name} (₹${s.fee})`).join('; ');
                        } else {
                            subjectsList = payment.subjectsList || '';
                        }
                    } else if (payment.paymentType === 'lumpSum') {
                        paymentType = 'Lump Sum';
                        amount = payment.totalAmount || 0;
                        timePeriod = payment.timePeriod || '';
                    } else if (payment.paymentType === 'custom') {
                        paymentType = 'Custom';
                        amount = payment.amount || 0;
                        timePeriod = payment.timePeriod || '';
                    }
                    
                    // Store as object with timestamp for later sorting
                    rows.push({
                        studentName,
                        paymentType,
                        amount,
                        numberOfSubjects,
                        subjectsList,
                        paymentPeriod,
                        advanced,
                        timePeriod,
                        remarks: payment.remarks || '',
                        lastPaymentText: payment.lastPaymentText || '',
                        lastPaymentAmount: payment.lastPaymentAmount || '',
                        createdDateStr,
                        createdTimestamp,
                        sortingTimestamp: sortingDate ? sortingDate.getTime() : createdTimestamp
                    });
                });
            } catch (error) {
                console.error(`Error fetching payments for ${studentName}:`, error);
            }
            
            return rows;
        };
        
        // Process students in batches of 20 for optimal performance
        const batchSize = 20;
        const studentDocs = studentsSnapshot.docs;
        
        for (let i = 0; i < studentDocs.length; i += batchSize) {
            const batch = studentDocs.slice(i, i + batchSize);
            const batchPromises = batch.map(doc => processStudent(doc));
            const batchResults = await Promise.all(batchPromises);
            
            // Flatten and add to all rows
            batchResults.forEach(rows => {
                allRows.push(...rows);
                totalPayments += rows.length;
            });
            
            processedStudents += batch.length;
            document.getElementById('exportProgress').textContent = `Processing ${processedStudents} of ${studentsSnapshot.size} students...`;
        }
        
        // Sort ALL rows chronologically (oldest to newest)
        // For monthly payments, use payment period start date
        // For other payments, use creation date
        allRows.sort((a, b) => a.sortingTimestamp - b.sortingTimestamp);
        
        // Build CSV from sorted rows with serial numbers
        allRows.forEach((rowData, index) => {
            const serialNo = index + 1;
            const row = [
                serialNo,
                `"${rowData.studentName.replace(/"/g, '""')}"`,
                rowData.paymentType,
                rowData.amount,
                rowData.numberOfSubjects,
                `"${(rowData.subjectsList || '').replace(/"/g, '""')}"`,
                `"${rowData.paymentPeriod}"`,
                rowData.advanced,
                `"${rowData.timePeriod}"`,
                `"${(rowData.remarks || '').replace(/"/g, '""')}"`,
                `"${(rowData.lastPaymentText || '').replace(/"/g, '""')}"`,
                rowData.lastPaymentAmount,
                rowData.createdDateStr
            ];
            csv += row.join(',') + '\n';
        });
        
        document.getElementById('exportProgress').textContent = 'Generating file...';
        
        if (totalPayments === 0) {
            let loadingMsgEl = document.getElementById('exportLoadingMsg');
            if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
            window.isExportingAllPayments = false;
            alert('No payment records found for any student');
            return;
        }
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `All_Payments_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Remove loading message
        let loadingMsgEl = document.getElementById('exportLoadingMsg');
        if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
        
        console.log(`Exported ${totalPayments} payment records for ${studentsSnapshot.size} students:`, fileName);
        alert(`Exported ${totalPayments} payment records from ${studentsSnapshot.size} students successfully!`);
        
    } catch (error) {
        console.error('Error exporting all payments:', error);
        
        // Remove loading message
        let loadingMsgEl = document.getElementById('exportLoadingMsg');
        if (loadingMsgEl) document.body.removeChild(loadingMsgEl);
        
        alert('Error exporting payments: ' + error.message);
    } finally {
        window.isExportingAllPayments = false;
    }
}

// Export payment history to Excel
window.exportPaymentHistoryExcel = async function() {
    const studentId = document.getElementById('selectedPaymentStudentId')?.value;
    const studentName = document.getElementById('selectedPaymentStudentName')?.value;
    
    if (!studentId || !studentName) {
        alert('Please select a student first');
        return;
    }
    
    try {
        const payments = await getStudentPayments(studentId);
        
        if (payments.length === 0) {
            alert('No payment history found for this student');
            return;
        }
        
        // Sort payments chronologically (oldest to newest)
        payments.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateA - dateB;
        });
        
        // Create CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += `Payment History - ${studentName}\n`;
        csv += `Generated on: ${new Date().toLocaleDateString('en-IN')}\n\n`;
        csv += 'S.No,Payment Type,Amount,Number of Subjects,Subjects,Payment Period,Advanced,Time Period,Remarks,Last Payment Text,Last Payment Amount,Created Date\n';
        
        payments.forEach((payment, index) => {
            const serialNo = index + 1;
            const createdDate = payment.createdAt?.toDate ? payment.createdAt.toDate() : null;
            const createdDateStr = createdDate ? `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}` : 'N/A';
            
            let paymentType = payment.paymentType || 'N/A';
            let amount = '';
            let numberOfSubjects = '';
            let subjectsList = '';
            let paymentPeriod = '';
            let advanced = '';
            let timePeriod = '';
            
            if (payment.paymentType === 'monthly') {
                paymentType = 'Monthly Recurring';
                amount = payment.amount || payment.monthlyFee || 0;
                paymentPeriod = payment.dateFrom ? `${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}` : '';
                advanced = payment.advanced || 0;
            } else if (payment.paymentType === 'perClass') {
                paymentType = 'Per Class';
                amount = payment.totalAmount || 0;
                numberOfSubjects = payment.numberOfSubjects || 0;
                if (payment.subjects && Array.isArray(payment.subjects)) {
                    subjectsList = payment.subjects.map(s => `${s.name} (₹${s.fee})`).join('; ');
                } else {
                    subjectsList = payment.subjectsList || '';
                }
            } else if (payment.paymentType === 'lumpSum') {
                paymentType = 'Lump Sum';
                amount = payment.totalAmount || 0;
                timePeriod = payment.timePeriod || '';
            } else if (payment.paymentType === 'custom') {
                paymentType = 'Custom';
                amount = payment.amount || 0;
                timePeriod = payment.timePeriod || '';
            }
            
            const row = [
                serialNo,
                paymentType,
                amount,
                numberOfSubjects,
                `"${(subjectsList || '').replace(/"/g, '""')}"`,
                `"${paymentPeriod}"`,
                advanced,
                `"${timePeriod}"`,
                `"${(payment.remarks || '').replace(/"/g, '""')}"`,
                `"${(payment.lastPaymentText || '').replace(/"/g, '""')}"`,
                payment.lastPaymentAmount || '',
                createdDateStr
            ];
            csv += row.join(',') + '\n';
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Payment_History_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('Payment history exported:', fileName);
        
    } catch (error) {
        console.error('Error exporting payment history:', error);
        alert('Error exporting payment history: ' + error.message);
    }
}

// Print payment structure from Payment Gateway tab
window.printPaymentFromGateway = async function() {
    const studentId = document.getElementById('selectedPaymentStudentId')?.value;
    const studentName = document.getElementById('selectedPaymentStudentName')?.value;
    
    if (!studentId || !studentName) {
        alert('Please select a student first');
        return;
    }
    
    // Call the main print function
    await printPaymentStructure(studentId, studentName);
}

// Print payment structure for a specific student
window.printPaymentStructure = async function(studentId, studentName) {
    if (!studentId) {
        alert('Student ID not found');
        return;
    }
    
    try {
        const payments = await getStudentPayments(studentId);
        
        if (payments.length === 0) {
            alert('No payment structure found for this student');
            return;
        }
        
        // Sort payments chronologically (oldest to newest)
        payments.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateA - dateB;
        });
        
        // Calculate total amount from all payments
        let totalAmount = 0;
        payments.forEach(payment => {
            if (payment.paymentType === 'monthly') {
                totalAmount += parseFloat(payment.amount || payment.monthlyFee || 0);
            } else if (payment.paymentType === 'perClass') {
                totalAmount += parseFloat(payment.totalAmount || 0);
            } else if (payment.paymentType === 'lumpSum') {
                totalAmount += parseFloat(payment.totalAmount || 0);
            } else if (payment.paymentType === 'custom') {
                totalAmount += parseFloat(payment.amount || 0);
            }
        });
        
        // Store data for PDF generation
        window.paymentPDFData = {
            studentId,
            studentName,
            payments,
            calculatedTotal: totalAmount
        };
        
        // Open GST confirmation modal
        const baseAmountInput = document.getElementById('paymentBaseAmount');
        const gstModal = document.getElementById('paymentGSTModal');
        
        if (!baseAmountInput || !gstModal) {
            console.error('Modal elements not found');
            alert('Error: Payment modal not found. Please refresh the page.');
            return;
        }
        
        baseAmountInput.value = totalAmount.toFixed(0);
        gstModal.style.display = 'block';
        
        // Reset GST option to "without"
        const gstWithout = document.getElementById('gstWithout');
        const gstPercentageDiv = document.getElementById('gstPercentageDiv');
        const gstBreakdown = document.getElementById('gstBreakdown');
        
        if (gstWithout) gstWithout.checked = true;
        if (gstPercentageDiv) gstPercentageDiv.style.display = 'none';
        if (gstBreakdown) gstBreakdown.style.display = 'none';
        
    } catch (error) {
        console.error('Error printing payment structure:', error);
        alert('Error loading payment structure: ' + error.message);
    }
}

// Toggle GST option
window.toggleGSTOption = function(withGST) {
    const gstPercentageDiv = document.getElementById('gstPercentageDiv');
    const gstBreakdown = document.getElementById('gstBreakdown');
    
    if (withGST) {
        gstPercentageDiv.style.display = 'block';
        gstBreakdown.style.display = 'block';
        calculateTotalWithGST();
    } else {
        gstPercentageDiv.style.display = 'none';
        gstBreakdown.style.display = 'none';
    }
}

// Calculate total with GST
window.calculateTotalWithGST = function() {
    const baseAmount = parseFloat(document.getElementById('paymentBaseAmount').value || 0);
    const gstPercent = parseFloat(document.getElementById('gstPercentage').value || 0);
    
    const gstAmount = (baseAmount * gstPercent) / 100;
    const totalAmount = baseAmount + gstAmount;
    
    document.getElementById('displayBaseAmount').textContent = baseAmount.toFixed(0);
    document.getElementById('displayGSTPercent').textContent = gstPercent.toFixed(1);
    document.getElementById('displayGSTAmount').textContent = gstAmount.toFixed(0);
    document.getElementById('displayTotalAmount').textContent = totalAmount.toFixed(0);
}

// Close payment GST modal
window.closePaymentGSTModal = function() {
    document.getElementById('paymentGSTModal').style.display = 'none';
    // Don't clear the data immediately - keep it in case user wants to reopen
    // window.isIndividualPaymentMode = false;
    // window.individualPaymentPDFData = null;
}

// Generate payment PDF with GST
window.generatePaymentPDFWithGST = async function() {
    const baseAmount = parseFloat(document.getElementById('paymentBaseAmount').value || 0);
    const withGST = document.getElementById('gstWith').checked;
    
    if (baseAmount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    let finalAmount = baseAmount;
    let gstAmount = 0;
    let gstPercent = 0;
    
    if (withGST) {
        gstPercent = parseFloat(document.getElementById('gstPercentage').value || 0);
        gstAmount = (baseAmount * gstPercent) / 100;
        finalAmount = baseAmount + gstAmount;
    }
    
    // Check if this is individual payment mode BEFORE closing modal
    if (window.isIndividualPaymentMode) {
        console.log('[Payment PDF] Individual payment mode detected');
        closePaymentGSTModal();
        await generateIndividualPaymentPDFWithGST(baseAmount, finalAmount, gstAmount, gstPercent, withGST);
        window.isIndividualPaymentMode = false;
        window.individualPaymentPDFData = null; // Clear after successful generation
        return;
    }
    
    // Close modal
    closePaymentGSTModal();
    
    // Get stored payment data for full payment structure
    const data = window.paymentPDFData;
    if (!data) {
        alert('Payment data not found');
        return;
    }
    
    // Build content for PDF template
    let content = `
        <div class="doc-title">Student Payment Structure</div>
        
        <div class="info-block">
            <div class="info-row">
                <div class="info-label">Student Name:</div>
                <div class="info-value">${data.studentName}</div>
            </div>
    `;
    
    if (withGST) {
        content += `
            <div class="info-row">
                <div class="info-label">Base Amount:</div>
                <div class="info-value">₹${baseAmount.toFixed(0)}</div>
            </div>
            <div class="info-row">
                <div class="info-label">GST (${gstPercent}%):</div>
                <div class="info-value">₹${gstAmount.toFixed(0)}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Total Amount (with GST):</div>
                <div class="info-value">₹${finalAmount.toFixed(0)}</div>
            </div>
        `;
    } else {
        content += `
            <div class="info-row">
                <div class="info-label">Total Amount:</div>
                <div class="info-value">₹${finalAmount.toFixed(0)}</div>
            </div>
        `;
    }
    
    content += `
            <div class="info-row">
                <div class="info-label">Total Payment Plans:</div>
                <div class="info-value">${data.payments.length}</div>
            </div>
        </div>
        
        <div class="section-heading">Payment Plans</div>
    `;
    
    data.payments.forEach(payment => {
        let typeName = 'Payment';
        let details = '';
        
        if (payment.paymentType === 'monthly') {
            typeName = 'Monthly Recurring Payment';
            details = `
                <div><strong>Amount:</strong> ₹${payment.amount || payment.monthlyFee || 0}</div>
                ${payment.dateFrom ? `<div><strong>Payment Period:</strong> ${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}</div>` : ''}
                ${payment.advanced > 0 ? `<div><strong>Advanced Payment:</strong> ₹${payment.advanced}</div>` : ''}
                ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
            `;
        } else if (payment.paymentType === 'perClass') {
            typeName = 'Per Class Payment';
            let subjectsHTML = '';
            if (payment.subjects && Array.isArray(payment.subjects)) {
                subjectsHTML = '<div><strong>Subjects with Fees:</strong></div><ul style="margin: 8px 0; padding-left: 20px;">';
                payment.subjects.forEach(subject => {
                    subjectsHTML += `<li>${subject.name}: ₹${subject.fee}</li>`;
                });
                subjectsHTML += '</ul>';
            } else if (payment.subjectsList) {
                subjectsHTML = `<div><strong>Subjects:</strong> ${payment.subjectsList}</div>`;
            }
            details = `
                <div><strong>Number of Subjects:</strong> ${payment.numberOfSubjects || 0}</div>
                <div><strong>Total Amount:</strong> ₹${payment.totalAmount || 0}</div>
                ${subjectsHTML}
                ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
            `;
        } else if (payment.paymentType === 'lumpSum') {
            typeName = 'Lump Sum Payment';
            details = `
                <div><strong>Total Amount:</strong> ₹${payment.totalAmount || 0}</div>
                <div><strong>Time Period:</strong> ${payment.timePeriod || 'N/A'}</div>
                ${payment.validFrom || payment.validTo ? `<div><strong>Validity:</strong> ${payment.validFrom || 'N/A'} to ${payment.validTo || 'N/A'}</div>` : ''}
                ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
            `;
        } else if (payment.paymentType === 'custom') {
            typeName = 'Custom Payment';
            details = `
                <div><strong>Amount:</strong> ₹${payment.amount || 0}</div>
                <div><strong>Time Period:</strong> ${payment.timePeriod || 'N/A'}</div>
                ${payment.validFrom || payment.validTo ? `<div><strong>Validity:</strong> ${payment.validFrom || 'N/A'} to ${payment.validTo || 'N/A'}</div>` : ''}
                ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
            `;
        }
        
        const createdDate = payment.createdAt?.toDate ? formatDateDDMMYYYY(payment.createdAt.toDate()) : 'N/A';
        
        content += `
            <div class="payment-card">
                <h3>${typeName}</h3>
                <div class="payment-details" style="font-size: 14px; line-height: 1.8; color: #333;">
                    ${details}
                    <div><strong>Created On:</strong> ${createdDate}</div>
                </div>
        `;
        
        if (payment.lastPaymentText || payment.lastPaymentAmount) {
            content += `
                <div style="background: #e8f8e8; padding: 12px; border-radius: 6px; margin-top: 15px; border-left: 3px solid #28a745;">
                    <strong style="color: #155724;">Last Payment Details:</strong><br>
                    ${payment.lastPaymentText ? `<div style="margin-top: 5px;">${payment.lastPaymentText}</div>` : ''}
                    ${payment.lastPaymentAmount ? `<div style="margin-top: 5px;"><strong>Amount:</strong> ₹${payment.lastPaymentAmount}</div>` : ''}
                </div>
            `;
        }
        
        content += `
            </div>
        `;
    });
    
    // Generate PDF using the standardized template with ZIEL branding
    const printContent = generatePDFTemplate('Payment Structure', content);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Generate individual payment PDF with GST
async function generateIndividualPaymentPDFWithGST(baseAmount, finalAmount, gstAmount, gstPercent, withGST) {
    const data = window.individualPaymentPDFData;
    
    console.log('[PDF Generation] Checking payment data:', data);
    console.log('[PDF Generation] isIndividualPaymentMode:', window.isIndividualPaymentMode);
    
    if (!data) {
        console.error('[PDF Generation] Payment data not found in window.individualPaymentPDFData');
        alert('Payment data not found. Please close this dialog and try printing the payment again.');
        return;
    }
    
    const { studentName, payment } = data;
    
    // Build payment details
    let typeName = 'Payment';
    let details = '';
    
    if (payment.paymentType === 'monthly') {
        typeName = 'Monthly Recurring Payment';
        details = `
            <div><strong>Amount:</strong> ₹${payment.amount || payment.monthlyFee || 0}</div>
            ${payment.dateFrom ? `<div><strong>Payment Period:</strong> ${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}</div>` : ''}
            ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
        `;
    } else if (payment.paymentType === 'perClass') {
        typeName = 'Per Class Payment';
        let subjectsHTML = '';
        if (payment.subjects && Array.isArray(payment.subjects)) {
            subjectsHTML = '<div style="margin-top: 10px;"><strong>Subjects with Fees:</strong></div><table style="margin-top: 10px;"><thead><tr><th>Subject</th><th>Fee</th></tr></thead><tbody>';
            payment.subjects.forEach(subject => {
                subjectsHTML += `<tr><td>${subject.name}</td><td>₹${subject.fee}</td></tr>`;
            });
            subjectsHTML += '</tbody></table>';
        } else if (payment.subjectsList) {
            subjectsHTML = `<div><strong>Subjects:</strong> ${payment.subjectsList}</div>`;
        }
        details = `
            <div><strong>Number of Subjects:</strong> ${payment.numberOfSubjects || 0}</div>
            ${subjectsHTML}
            ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
        `;
    } else if (payment.paymentType === 'lumpSum') {
        typeName = 'Lump Sum Payment';
        details = `
            <div><strong>Time Period:</strong> ${payment.timePeriod || 'N/A'}</div>
            ${payment.validFrom || payment.validTo ? `<div><strong>Validity:</strong> ${payment.validFrom || 'N/A'} to ${payment.validTo || 'N/A'}</div>` : ''}
            ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
        `;
    } else if (payment.paymentType === 'custom') {
        typeName = 'Custom Payment';
        details = `
            <div><strong>Time Period:</strong> ${payment.timePeriod || 'N/A'}</div>
            ${payment.validFrom || payment.validTo ? `<div><strong>Validity:</strong> ${payment.validFrom || 'N/A'} to ${payment.validTo || 'N/A'}</div>` : ''}
            ${payment.remarks ? `<div><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
        `;
    }
    
    const createdDate = payment.createdAt?.toDate ? formatDateDDMMYYYY(payment.createdAt.toDate()) : 'N/A';
    
    // Add last payment info if exists
    let lastPaymentSection = '';
    if (payment.lastPaymentText || payment.lastPaymentAmount) {
        lastPaymentSection = `
            <div class="payment-card" style="background: #d4edda; border-left: 4px solid #28a745;">
                <h3 style="color: #155724;">Last Payment Details</h3>
                <div style="display: grid; gap: 10px; font-size: 14px; color: #155724;">
                    ${payment.lastPaymentText ? `<div><strong>Payment Text:</strong> ${payment.lastPaymentText}</div>` : ''}
                    ${payment.lastPaymentAmount ? `<div><strong>Amount Paid:</strong> ₹${payment.lastPaymentAmount}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Build amount section based on GST
    let amountSection = '';
    if (withGST) {
        amountSection = `
            <div class="info-block">
                <div class="info-row">
                    <div class="info-label">Base Amount:</div>
                    <div class="info-value">₹${baseAmount.toFixed(0)}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">GST (${gstPercent}%):</div>
                    <div class="info-value">₹${gstAmount.toFixed(0)}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Amount (with GST):</div>
                    <div class="info-value">₹${finalAmount.toFixed(0)}</div>
                </div>
            </div>
        `;
    } else {
        amountSection = `
            <div class="info-block">
                <div class="info-row">
                    <div class="info-label">Total Amount:</div>
                    <div class="info-value">₹${finalAmount.toFixed(0)}</div>
                </div>
            </div>
        `;
    }
    
    // Build content for PDF template
    const content = `
        <div class="doc-title">Payment Structure</div>
        
        <div class="info-block">
            <div class="info-row">
                <div class="info-label">Student Name:</div>
                <div class="info-value">${studentName}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Payment Type:</div>
                <div class="info-value">${typeName}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Created On:</div>
                <div class="info-value">${createdDate}</div>
            </div>
        </div>
        
        ${amountSection}
        
        <div class="section-heading">Payment Details</div>
        
        <div class="payment-card">
            <div class="payment-details" style="font-size: 14px; line-height: 1.8; color: #333;">
                ${details}
            </div>
        </div>
        
        ${lastPaymentSection}
    `;
    
    // Generate PDF using template
    const pdfHTML = generatePDFTemplate('Payment Structure', content);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfHTML);
    printWindow.document.close();
}

// Load payment history for a student
async function loadPaymentHistory(studentId) {
    try {
        const paymentsRef = collection(db, 'students', studentId, 'payments');
        const paymentsQuery = query(paymentsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(paymentsQuery);
        
        const historySection = document.getElementById('paymentHistorySection');
        const historyContent = document.getElementById('paymentHistoryContent');
        
        if (snapshot.empty) {
            historySection.style.display = 'none';
            return;
        }
        
        historySection.style.display = 'block';
        
        let html = '<div style="display: grid; gap: 16px;">';
        
        snapshot.forEach(doc => {
            const payment = doc.data();
            const createdDate = payment.createdAt?.toDate ? formatDateTimeDDMMYYYY(payment.createdAt.toDate()) : 'N/A';
            
            let typeIcon = '📅';
            let typeName = 'Monthly';
            let details = '';
            
            if (payment.paymentType === 'monthly') {
                typeIcon = '📅';
                typeName = 'Monthly Recurring';
                details = `<div><strong>Amount:</strong> ₹${payment.amount || payment.monthlyFee || 0}</div>
                          ${payment.dateFrom ? `<div><strong>Payment Period:</strong> ${payment.dateFrom} to ${payment.dateTo || 'Ongoing'}</div>` : ''}
                          ${payment.advanced > 0 ? `<div><strong>Advanced:</strong> ₹${payment.advanced}</div>` : ''}`;
            } else if (payment.paymentType === 'perClass') {
                typeIcon = '📚';
                typeName = 'Per Class';
                let subjectsHTML = '';
                if (payment.subjects && Array.isArray(payment.subjects)) {
                    subjectsHTML = '<div style="margin-top: 8px;"><strong>Subjects with Fees:</strong><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">';
                    payment.subjects.forEach(subject => {
                        subjectsHTML += `<span style="padding: 4px 10px; background: #f0f4ff; border-radius: 4px; font-size: 12px; border: 1px solid #667eea20;">${subject.name}: ₹${subject.fee}</span>`;
                    });
                    subjectsHTML += '</div></div>';
                } else if (payment.subjectsList) {
                    subjectsHTML = `<div><strong>Subjects:</strong> ${payment.subjectsList}</div>`;
                }
                details = `<div><strong>Number of Subjects:</strong> ${payment.numberOfSubjects || 0}</div>
                          <div><strong>Total Amount:</strong> ₹${payment.totalAmount || 0}</div>
                          ${subjectsHTML}`;
            } else if (payment.paymentType === 'lumpSum') {
                typeIcon = '💰';
                typeName = 'Lump Sum';
                details = `<div><strong>Amount:</strong> ₹${payment.totalAmount || 0}</div>
                          <div><strong>Period:</strong> ${payment.timePeriod || 'N/A'}</div>
                          ${payment.validFrom || payment.validTo ? `<div><strong>Validity:</strong> ${payment.validFrom || 'N/A'} to ${payment.validTo || 'N/A'}</div>` : ''}`;
            } else if (payment.paymentType === 'custom') {
                typeIcon = '⚙️';
                typeName = 'Custom';
                details = `<div><strong>Amount:</strong> ₹${payment.amount || 0}</div>
                          <div><strong>Period:</strong> ${payment.timePeriod || 'N/A'}</div>
                          ${payment.validFrom || payment.validTo ? `<div><strong>Validity:</strong> ${payment.validFrom || 'N/A'} to ${payment.validTo || 'N/A'}</div>` : ''}`;
            }
            
            html += `
                <div style="padding: 16px; background: white; border: 1px solid #e0e0e0; border-radius: 8px; border-left: 4px solid #667eea;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 18px; font-weight: 600; color: #2c2c2c; margin-bottom: 4px;">
                                ${typeIcon} ${typeName}
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Created: ${createdDate}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="printIndividualPayment('${studentId}', '${doc.id}')" style="padding: 6px 14px; background: #8BC34A; color: white; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 500; font-family: 'Roboto', sans-serif; transition: background 0.3s;">Print</button>
                            <button onclick="deletePayment('${studentId}', '${doc.id}')" style="padding: 6px 14px; background: #d93025; color: white; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 500; font-family: 'Roboto', sans-serif; transition: background 0.3s;">Delete</button>
                        </div>
                    </div>
                    <div style="display: grid; gap: 8px; font-size: 14px; color: #444; margin-bottom: 12px;">
                        ${details}
                    </div>
                    ${payment.remarks ? `<div style="padding: 8px 12px; background: #f8f9fa; border-radius: 4px; font-size: 13px; color: #666; margin-bottom: 8px;"><strong>Remarks:</strong> ${payment.remarks}</div>` : ''}
                    ${payment.lastPaymentText || payment.lastPaymentAmount ? `
                    <div style="padding: 8px 12px; background: linear-gradient(135deg, #d4edda, #c3e6cb); border-radius: 4px; font-size: 13px; color: #155724; border-left: 3px solid #28a745;">
                        <strong>Last Payment:</strong> ${payment.lastPaymentText || 'N/A'} 
                        ${payment.lastPaymentAmount ? `- <strong>₹${payment.lastPaymentAmount}</strong>` : ''}
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        historyContent.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading payment history:', error);
    }
}

// Print individual payment
window.printIndividualPayment = async function(studentId, paymentId) {
    try {
        // Get student info
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
            alert('Student not found');
            return;
        }
        const studentName = studentDoc.data().name;
        
        // Get payment info
        const paymentDoc = await getDoc(doc(db, 'students', studentId, 'payments', paymentId));
        if (!paymentDoc.exists()) {
            alert('Payment not found');
            return;
        }
        const payment = paymentDoc.data();
        
        // Calculate base amount from payment
        let baseAmount = 0;
        if (payment.paymentType === 'monthly') {
            baseAmount = parseFloat(payment.amount || payment.monthlyFee || 0);
        } else if (payment.paymentType === 'perClass') {
            // For per-class payments, calculate total from subjects array
            if (payment.subjects && Array.isArray(payment.subjects)) {
                baseAmount = payment.subjects.reduce((sum, subject) => sum + (parseFloat(subject.fee) || 0), 0);
            } else {
                baseAmount = parseFloat(payment.totalAmount || 0);
            }
        } else if (payment.paymentType === 'lumpSum') {
            baseAmount = parseFloat(payment.totalAmount || 0);
        } else if (payment.paymentType === 'custom') {
            baseAmount = parseFloat(payment.amount || 0);
        }
        
        // Store data for PDF generation
        window.individualPaymentPDFData = {
            studentName,
            payment,
            baseAmount
        };
        
        console.log('[Print Payment] Stored payment data:', window.individualPaymentPDFData);
        console.log('[Print Payment] Payment type:', payment.paymentType);
        console.log('[Print Payment] Base amount:', baseAmount);
        
        // Open GST confirmation modal
        const baseAmountInput = document.getElementById('paymentBaseAmount');
        const gstModal = document.getElementById('paymentGSTModal');
        
        if (!baseAmountInput || !gstModal) {
            console.error('Modal elements not found');
            alert('Error: Payment modal not found. Please refresh the page.');
            return;
        }
        
        baseAmountInput.value = baseAmount.toFixed(0);
        gstModal.style.display = 'block';
        
        // Reset GST option to "without"
        const gstWithout = document.getElementById('gstWithout');
        const gstPercentageDiv = document.getElementById('gstPercentageDiv');
        const gstBreakdown = document.getElementById('gstBreakdown');
        
        if (gstWithout) gstWithout.checked = true;
        if (gstPercentageDiv) gstPercentageDiv.style.display = 'none';
        if (gstBreakdown) gstBreakdown.style.display = 'none';
        
        // Mark that this is individual payment mode
        window.isIndividualPaymentMode = true;
        
    } catch (error) {
        console.error('Error printing individual payment:', error);
        alert('Error printing payment: ' + error.message);
    }
}

// Delete payment record
window.deletePayment = async function(studentId, paymentId) {
    if (!confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) {
        return;
    }
    
    try {
        const paymentRef = doc(db, 'students', studentId, 'payments', paymentId);
        await deleteDoc(paymentRef);
        
        alert('Payment record deleted successfully');
        
        // Reload payment history
        await loadPaymentHistory(studentId);
        
    } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment record: ' + error.message);
    }
}

// Get student payments for report generation
async function getStudentPayments(studentId) {
    try {
        const paymentsRef = collection(db, 'students', studentId, 'payments');
        const paymentsQuery = query(paymentsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(paymentsQuery);
        
        const payments = [];
        snapshot.forEach(doc => {
            payments.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return payments;
    } catch (error) {
        console.error('Error getting student payments:', error);
        return [];
    }
}

// Expose payment functions
window.loadPaymentStudents = loadPaymentStudents;
window.getStudentPayments = getStudentPayments;

// ===== AUTOMATED BACKUP SYSTEM =====

// Check if backup should run (once per day for teacher, once per month for admin)
function shouldRunBackup(backupType) {
    const lastBackupKey = `lastBackup_${backupType}`;
    const lastBackup = localStorage.getItem(lastBackupKey);
    const now = new Date();
    const nowDateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!lastBackup) {
        // No previous backup - don't run on first check, set timestamp for future checks
        localStorage.setItem(lastBackupKey, nowDateStr);
        return false;
    }
    
    const lastBackupDate = new Date(lastBackup);
    const daysDiff = Math.floor((now - lastBackupDate) / (1000 * 60 * 60 * 24));
    
    // For admin, check if 30 days have passed
    if (backupType === 'admin') {
        return daysDiff >= 30;
    }
    
    // For teacher, check if 7 days have passed
    if (backupType === 'teacher') {
        return daysDiff >= 7;
    }
    
    return false;
}

// Auto backup for teachers (weekly - 7 days)
async function autoBackupTeacher() {
    if (!shouldRunBackup('teacher')) {
        console.log('[Auto Backup] Teacher backup not due yet (runs once every 7 days)');
        return;
    }
    
    try {
        console.log('[Auto Backup] Starting teacher weekly backup...');
        const teacherName = localStorage.getItem('teacherName');
        if (!teacherName) return;
        
        // Get last 7 days of data
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        
        // Fetch entries for this teacher
        const entriesQuery = query(
            collection(db, "entries"),
            where("teacherName", "==", teacherName)
        );
        const snapshot = await getDocs(entriesQuery);
        
        let entries = [];
        snapshot.forEach(doc => {
            const entry = doc.data();
            let entryDate = null;
            
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
            if (!entryDate && entry.createdAt && typeof entry.createdAt.toDate === 'function') {
                entryDate = entry.createdAt.toDate();
            }
            
            if (entryDate && entryDate >= startDate && entryDate <= endDate) {
                entries.push({
                    id: doc.id,
                    ...entry
                });
            }
        });
        
        if (entries.length === 0) {
            console.log('[Auto Backup] No entries in last 7 days');
            return;
        }
        
        // Generate CSV
        let csv = '\uFEFF'; // UTF-8 BOM
        csv += `Weekly Backup - ${teacherName}\n`;
        csv += `Generated: ${formatDateTimeDDMMYYYY(new Date())}\n`;
        csv += `Period: Last 7 Days (${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)})\n`;
        csv += `Total Entries: ${entries.length}\n\n`;
        
        csv += 'Date,Day,Student,Time From,Time To,Classes,Sheet Made,Homework Given,Topic,Payment\n';
        
        entries.forEach(entry => {
            const row = [
                entry.date || '',
                entry.dayOfWeek || '',
                `"${entry.studentName || entry.student || ''}"`,
                entry.timeFrom || '',
                entry.timeTo || '',
                entry.classCount || 0,
                entry.sheetMade || '',
                entry.homeworkGiven || '',
                `"${(entry.topic || '').replace(/"/g, '""')}"`,
                `"${entry.payment || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Auto download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Weekly_Backup_${teacherName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('[Auto Backup] Teacher weekly backup completed:', fileName);
        
        // Update last backup timestamp after successful backup
        localStorage.setItem('lastBackup_teacher', new Date().toISOString().split('T')[0]);
    } catch (error) {
        console.error('[Auto Backup] Error in teacher backup:', error);
    }
}

// Auto backup for admin (monthly - 30 days)
async function autoBackupAdmin() {
    if (!shouldRunBackup('admin')) {
        console.log('[Auto Backup] Admin backup not due yet (runs once every 30 days)');
        return;
    }
    
    try {
        console.log('[Auto Backup] Starting admin monthly backup...');
        
        // Get last 30 days of data
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Fetch all entries
        const snapshot = await getDocs(collection(db, 'entries'));
        
        let entries = [];
        snapshot.forEach(doc => {
            const entry = doc.data();
            let entryDate = null;
            
            if (entry.date) {
                const parts = ('' + entry.date).split('-').map(Number);
                if (parts.length >= 3) entryDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
            if (!entryDate && entry.createdAt && typeof entry.createdAt.toDate === 'function') {
                entryDate = entry.createdAt.toDate();
            }
            
            if (entryDate && entryDate >= startDate && entryDate <= endDate) {
                entries.push({
                    id: doc.id,
                    ...entry
                });
            }
        });
        
        if (entries.length === 0) {
            console.log('[Auto Backup] No entries in last 30 days');
            return;
        }
        
        // Generate CSV
        let csv = '\uFEFF'; // UTF-8 BOM
        csv += `Monthly Backup - Admin\n`;
        csv += `Generated: ${formatDateTimeDDMMYYYY(new Date())}\n`;
        csv += `Period: Last 30 Days (${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)})\n`;
        csv += `Total Entries: ${entries.length}\n\n`;
        
        csv += 'Date,Day,Teacher,Student,Time From,Time To,Classes,Sheet Made,Payment,Homework Given,Topic,Created At\n';
        
        entries.forEach(entry => {
            const createdAt = entry.createdAt && typeof entry.createdAt.toDate === 'function' 
                ? formatDateTimeDDMMYYYY(entry.createdAt.toDate())
                : '';
            
            const row = [
                entry.date || '',
                entry.dayOfWeek || '',
                `"${entry.teacherName || ''}"`,
                `"${entry.studentName || entry.student || ''}"`,
                entry.timeFrom || '',
                entry.timeTo || '',
                entry.classCount || 0,
                entry.sheetMade || '',
                `"${entry.payment || ''}"`,
                entry.homeworkGiven || '',
                `"${(entry.topic || '').replace(/"/g, '""')}"`,
                `"${createdAt}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Auto download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Monthly_Backup_Admin_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('[Auto Backup] Admin monthly backup completed:', fileName);
        
        // Update last backup timestamp after successful backup
        localStorage.setItem('lastBackup_admin', new Date().toISOString().split('T')[0]);
    } catch (error) {
        console.error('[Auto Backup] Error in admin backup:', error);
    }
}

// Custom backup all data for admin (on-demand)
window.customBackupAllData = async function() {
    try {
        console.log('[Custom Backup] Starting full data backup...');
        
        // Show loading message
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'backupLoading';
        loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;text-align:center;font-family:Roboto,sans-serif;';
        loadingDiv.innerHTML = '<div style="font-size:18px;font-weight:600;margin-bottom:12px;">Creating Complete Backup...</div><div style="color:#666;">Please wait, this may take a moment...</div>';
        document.body.appendChild(loadingDiv);
        
        // Fetch all data
        const [entriesSnap, studentsSnap, teachersSnap] = await Promise.all([
            getDocs(collection(db, 'entries')),
            getDocs(collection(db, 'students')),
            getDocs(collection(db, 'teachers'))
        ]);
        
        // Process Entries
        const entries = [];
        entriesSnap.forEach(doc => {
            const entry = doc.data();
            const createdAt = entry.createdAt && typeof entry.createdAt.toDate === 'function' 
                ? formatDateTimeDDMMYYYY(entry.createdAt.toDate())
                : '';
            entries.push({
                id: doc.id,
                date: entry.date || '',
                dayOfWeek: entry.dayOfWeek || '',
                teacherName: entry.teacherName || '',
                studentName: entry.studentName || entry.student || '',
                timeFrom: entry.timeFrom || '',
                timeTo: entry.timeTo || '',
                classCount: entry.classCount || 0,
                sheetMade: entry.sheetMade || '',
                payment: entry.payment || '',
                homeworkGiven: entry.homeworkGiven || '',
                topic: (entry.topic || '').replace(/"/g, '""'),
                createdAt
            });
        });
        
        // Process Students
        const students = [];
        for (const doc of studentsSnap.docs) {
            const student = doc.data();
            const createdAt = student.createdAt && typeof student.createdAt.toDate === 'function'
                ? formatDateTimeDDMMYYYY(student.createdAt.toDate())
                : '';
            
            // Get payment records for this student
            const paymentsSnap = await getDocs(collection(db, 'students', doc.id, 'payments'));
            const paymentCount = paymentsSnap.size;
            
            students.push({
                id: doc.id,
                name: student.name || '',
                email: student.email || '',
                phone: student.phone || '',
                status: student.status || '',
                paymentRecords: paymentCount,
                createdAt
            });
        }
        
        // Process Teachers
        const teachers = [];
        teachersSnap.forEach(doc => {
            const teacher = doc.data();
            const createdAt = teacher.createdAt && typeof teacher.createdAt.toDate === 'function'
                ? formatDateTimeDDMMYYYY(teacher.createdAt.toDate())
                : '';
            teachers.push({
                id: doc.id,
                name: teacher.name || '',
                email: teacher.email || '',
                phone: teacher.phone || '',
                status: teacher.status || '',
                createdAt
            });
        });
        
        // Generate comprehensive CSV
        let csv = '\uFEFF'; // UTF-8 BOM
        csv += `Complete Data Backup\n`;
        csv += `Generated: ${formatDateTimeDDMMYYYY(new Date())}\n`;
        csv += `Total Entries: ${entries.length}\n`;
        csv += `Total Students: ${students.length}\n`;
        csv += `Total Teachers: ${teachers.length}\n\n`;
        
        // Entries Section
        csv += `=== CLASS ENTRIES ===\n`;
        csv += 'Entry ID,Date,Day,Teacher,Student,Time From,Time To,Classes,Sheet Made,Payment,Homework,Topic,Created At\n';
        entries.forEach(e => {
            csv += `"${e.id}",${e.date},${e.dayOfWeek},"${e.teacherName}","${e.studentName}",${e.timeFrom},${e.timeTo},${e.classCount},${e.sheetMade},"${e.payment}",${e.homeworkGiven},"${e.topic}","${e.createdAt}"\n`;
        });
        
        csv += `\n=== STUDENTS ===\n`;
        csv += 'Student ID,Name,Email,Phone,Status,Payment Records,Created At\n';
        students.forEach(s => {
            csv += `"${s.id}","${s.name}","${s.email}","${s.phone}",${s.status},${s.paymentRecords},"${s.createdAt}"\n`;
        });
        
        csv += `\n=== TEACHERS ===\n`;
        csv += 'Teacher ID,Name,Email,Phone,Status,Created At\n';
        teachers.forEach(t => {
            csv += `"${t.id}","${t.name}","${t.email}","${t.phone}",${t.status},"${t.createdAt}"\n`;
        });
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `Complete_Backup_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Remove loading message
        document.body.removeChild(loadingDiv);
        
        alert(`✅ Complete backup downloaded successfully!\n\nFile: ${fileName}\n\nEntries: ${entries.length}\nStudents: ${students.length}\nTeachers: ${teachers.length}`);
        
        console.log('[Custom Backup] Complete backup successful:', fileName);
    } catch (error) {
        console.error('[Custom Backup] Error:', error);
        const loadingDiv = document.getElementById('backupLoading');
        if (loadingDiv) document.body.removeChild(loadingDiv);
        alert('Error creating backup: ' + error.message);
    }
}

// Initialize auto backups based on user role
window.initAutoBackup = function() {
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('teacher.html')) {
        // Teacher page - weekly backup
        setTimeout(() => autoBackupTeacher(), 2000); // Delay 2s to let page load
    } else if (currentPage.includes('admin.html')) {
        // Admin page - monthly backup
        setTimeout(() => autoBackupAdmin(), 2000); // Delay 2s to let page load
    }
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
    initAutoBackup();
}

// ============================================
// SEARCH, FILTER, AND DOWNLOAD FUNCTIONALITY
// ============================================

// Global variable to store all entries for filtering
let allEntriesCache = [];

// Enhanced loadRecentEntries to support search and filter
const originalLoadRecentEntries = window.loadRecentEntries;
window.loadRecentEntries = async function(filterOptions = {}) {
    const teacherId = localStorage.getItem("teacherId");
    const role = localStorage.getItem("role");
    const div = document.getElementById("recentEntries");
    
    if (!div) return;

    // Check if teacher has valid ID
    if (role === "teacher" && !teacherId) {
        div.innerHTML = "<p class='error'>Teacher ID not found. Please <a href='index.html'>login again</a>.</p>";
        return;
    }

    div.innerHTML = "<p>Loading...</p>";

    try {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        
        let entriesQuery;
        if (role === "admin") {
            // Admin sees all entries - fetch all and filter by date in JS
            entriesQuery = query(collection(db, "entries"));
        } else {
            // Teachers see only their entries
            entriesQuery = query(
                collection(db, "entries"),
                where("teacherId", "==", teacherId)
            );
        }

        const snapshot = await getDocs(entriesQuery);

        // Filter by date in JavaScript and cache all entries
        allEntriesCache = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date(0);
            
            // Only include entries from last 60 days
            if (createdAt >= sixtyDaysAgo) {
                allEntriesCache.push({
                    id: docSnap.id,
                    ...data
                });
            }
        });

        // Apply filters if provided
        let filteredEntries = [...allEntriesCache];
        
        // Filter by student name (not teacher name)
        if (filterOptions.studentName) {
            const searchTerm = filterOptions.studentName.toLowerCase();
            filteredEntries = filteredEntries.filter(e => {
                const studentName = (e.studentName || e.student || '').toLowerCase();
                return studentName.includes(searchTerm);
            });
        }
        
        // Filter by date range
        if (filterOptions.dateFrom || filterOptions.dateTo) {
            filteredEntries = filteredEntries.filter(e => {
                if (!e.date) return false;
                
                const entryDate = new Date(e.date + 'T00:00:00');
                
                if (filterOptions.dateFrom && filterOptions.dateTo) {
                    const fromDate = new Date(filterOptions.dateFrom + 'T00:00:00');
                    const toDate = new Date(filterOptions.dateTo + 'T23:59:59');
                    return entryDate >= fromDate && entryDate <= toDate;
                } else if (filterOptions.dateFrom) {
                    const fromDate = new Date(filterOptions.dateFrom + 'T00:00:00');
                    return entryDate >= fromDate;
                } else if (filterOptions.dateTo) {
                    const toDate = new Date(filterOptions.dateTo + 'T23:59:59');
                    return entryDate <= toDate;
                }
                
                return true;
            });
        }

        // Update results count
        const resultsCountDiv = document.getElementById('resultsCount');
        if (resultsCountDiv) {
            if (filterOptions.studentName || filterOptions.dateFrom || filterOptions.dateTo) {
                resultsCountDiv.textContent = `Showing ${filteredEntries.length} of ${allEntriesCache.length} entries`;
            } else {
                resultsCountDiv.textContent = `Showing ${filteredEntries.length} entries (last 60 days)`;
            }
        }

        if (filteredEntries.length === 0) {
            div.innerHTML = "<p style='text-align: center; color: #666; padding: 20px;'>No records found</p>";
            return;
        }

        // Sort entries by createdAt in JavaScript (newest first)
        filteredEntries.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // Descending order (newest first)
        });

        div.innerHTML = "";
        filteredEntries.forEach(e => {
            const paymentText = e.payment ? `${e.payment}` : 'No payment';
            const sheetText = e.sheetMade === 'yes' ? 'Yes' : 'No';
            const homeworkText = e.homeworkGiven === 'yes' ? 'Yes' : e.homeworkGiven === 'no' ? 'No' : 'N/A';
            const studentName = e.studentName || e.student || 'N/A';
            const canEdit = true; // Teachers can edit anytime without restrictions
            
            div.innerHTML += `
                <div class="entry-item">
                    <div class="entry-header">
                        <div>
                            <span class="entry-date">${e.date || 'N/A'}</span>
                            <span class="entry-day">${e.dayOfWeek || ''}</span>
                        </div>
                    </div>
                    <div class="entry-details">
                        <div class="entry-detail"><strong>Student:</strong> ${studentName}</div>
                        <div class="entry-detail"><strong>Time:</strong> ${e.timeFrom || e.startTime || 'N/A'} - ${e.timeTo || e.endTime || 'N/A'}</div>
                        <div class="entry-detail"><strong>Classes:</strong> ${e.classCount || 'N/A'}</div>
                        <div class="entry-detail"><strong>Sheet:</strong> ${sheetText}</div>
                        <div class="entry-detail"><strong>Homework:</strong> ${homeworkText}</div>
                        <div class="entry-detail"><strong>Subject:</strong> ${e.subject || '-'}</div>
                    </div>
                    <div class="entry-detail" style="margin-top: 8px;">
                        <strong>Topic:</strong> ${e.topic || '-'}
                    </div>
                    <div class="entry-actions">
                        ${canEdit ? `<button class="btn-edit" onclick="editEntry('${e.id}')">Edit</button>` : '<button class="btn-edit" disabled>Edit</button>'}
                        ${canEdit ? `<button class="btn-delete" onclick="deleteEntry('${e.id}')">Delete</button>` : '<button class="btn-delete" disabled>Delete</button>'}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error loading entries:", error);
        div.innerHTML = "<p style='color: red;'>❌ Error loading entries. Check console.</p>";
    }
}

// Get unique student names for autocomplete
window.getUniqueStudentNames = function() {
    const names = new Set();
    allEntriesCache.forEach(entry => {
        const studentName = entry.studentName || entry.student;
        if (studentName) {
            names.add(studentName);
        }
    });
    return Array.from(names).sort();
}

// Setup search listeners
window.setupSearchListeners = function() {
    const searchStudentInput = document.getElementById('searchStudentName');
    const searchDateFromInput = document.getElementById('searchDateFrom');
    const searchDateToInput = document.getElementById('searchDateTo');
    const suggestionsDiv = document.getElementById('studentNameSuggestions');
    
    if (!searchStudentInput) return;
    
    // Student name search with autocomplete
    searchStudentInput.addEventListener('input', function() {
        const searchValue = this.value.toLowerCase();
        
        if (searchValue.length === 0) {
            if (suggestionsDiv) {
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.remove('show');
            }
            // Apply filter without student name
            const dateFrom = searchDateFromInput?.value;
            const dateTo = searchDateToInput?.value;
            window.loadRecentEntries({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            });
            return;
        }
        
        // Get matching names
        const allNames = getUniqueStudentNames();
        const matches = allNames.filter(name => 
            name.toLowerCase().includes(searchValue)
        );
        
        // Show suggestions
        if (suggestionsDiv) {
            if (matches.length > 0) {
                suggestionsDiv.innerHTML = matches.map(name => {
                    const regex = new RegExp(`(${searchValue})`, 'gi');
                    const highlighted = name.replace(regex, '<span class="autocomplete-highlight">$1</span>');
                    return `<div class="autocomplete-item" onclick="selectStudentName('${name.replace(/'/g, "\\'")}')">${highlighted}</div>`;
                }).join('');
                suggestionsDiv.classList.add('show');
            } else {
                suggestionsDiv.innerHTML = '<div class="autocomplete-item" style="color: #999; cursor: default;">No matches found</div>';
                suggestionsDiv.classList.add('show');
            }
        }
        
        // Apply filter immediately
        const dateFrom = searchDateFromInput?.value;
        const dateTo = searchDateToInput?.value;
        window.loadRecentEntries({
            studentName: searchValue,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined
        });
    });
    
    // Date range filters
    if (searchDateFromInput) {
        searchDateFromInput.addEventListener('change', function() {
            const dateFrom = this.value;
            const dateTo = searchDateToInput?.value;
            const studentName = searchStudentInput?.value;
            
            window.loadRecentEntries({
                studentName: studentName || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            });
        });
    }
    
    if (searchDateToInput) {
        searchDateToInput.addEventListener('change', function() {
            const dateTo = this.value;
            const dateFrom = searchDateFromInput?.value;
            const studentName = searchStudentInput?.value;
            
            window.loadRecentEntries({
                studentName: studentName || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            });
        });
    }
    
    // Click outside to close suggestions
    document.addEventListener('click', function(e) {
        if (searchStudentInput && suggestionsDiv) {
            if (!searchStudentInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                suggestionsDiv.classList.remove('show');
            }
        }
    });
}

// Select student name from suggestions
window.selectStudentName = function(name) {
    const searchStudentInput = document.getElementById('searchStudentName');
    const suggestionsDiv = document.getElementById('studentNameSuggestions');
    const searchDateFromInput = document.getElementById('searchDateFrom');
    const searchDateToInput = document.getElementById('searchDateTo');
    
    if (searchStudentInput) searchStudentInput.value = name;
    if (suggestionsDiv) suggestionsDiv.classList.remove('show');
    
    // Apply filter
    const dateFrom = searchDateFromInput?.value;
    const dateTo = searchDateToInput?.value;
    window.loadRecentEntries({
        studentName: name,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
    });
}

// Clear all filters
window.clearFilters = function() {
    const searchStudentInput = document.getElementById('searchStudentName');
    const searchDateFromInput = document.getElementById('searchDateFrom');
    const searchDateToInput = document.getElementById('searchDateTo');
    const suggestionsDiv = document.getElementById('studentNameSuggestions');
    
    if (searchStudentInput) searchStudentInput.value = '';
    if (searchDateFromInput) searchDateFromInput.value = '';
    if (searchDateToInput) searchDateToInput.value = '';
    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.remove('show');
    }
    
    // Reload without filters
    window.loadRecentEntries();
}

// Get selected fields for download
function getSelectedFields() {
    const checkboxes = document.querySelectorAll('.download-field:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Get filtered data for download
function getFilteredData() {
    const searchStudentInput = document.getElementById('searchStudentName');
    const searchDateFromInput = document.getElementById('searchDateFrom');
    const searchDateToInput = document.getElementById('searchDateTo');
    
    let data = [...allEntriesCache];
    
    // Apply student name filter
    if (searchStudentInput && searchStudentInput.value) {
        const searchTerm = searchStudentInput.value.toLowerCase();
        data = data.filter(e => {
            const studentName = (e.studentName || e.student || '').toLowerCase();
            return studentName.includes(searchTerm);
        });
    }
    
    // Apply date range filter
    if (searchDateFromInput?.value || searchDateToInput?.value) {
        data = data.filter(e => {
            if (!e.date) return false;
            
            const entryDate = new Date(e.date + 'T00:00:00');
            
            if (searchDateFromInput?.value && searchDateToInput?.value) {
                const fromDate = new Date(searchDateFromInput.value + 'T00:00:00');
                const toDate = new Date(searchDateToInput.value + 'T23:59:59');
                return entryDate >= fromDate && entryDate <= toDate;
            } else if (searchDateFromInput?.value) {
                const fromDate = new Date(searchDateFromInput.value + 'T00:00:00');
                return entryDate >= fromDate;
            } else if (searchDateToInput?.value) {
                const toDate = new Date(searchDateToInput.value + 'T23:59:59');
                return entryDate <= toDate;
            }
            
            return true;
        });
    }
    
    return data;
}

// Download as PDF
window.downloadPDF = function() {
    const selectedFields = getSelectedFields();
    const data = getFilteredData();
    
    if (data.length === 0) {
        alert('No data to download. Please adjust your filters.');
        return;
    }
    
    if (selectedFields.length === 0) {
        alert('Please select at least one field to include in the download.');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Title
        doc.setFontSize(16);
        doc.text('Teacher Activity Report', 14, 15);
        
        // Date range info
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDateDDMMYYYY(new Date())}`, 14, 22);
        doc.text(`Total Records: ${data.length}`, 14, 28);
        
        // Prepare table data
        const headers = [];
        const fieldMapping = {
            'studentName': 'Student',
            'date': 'Date',
            'subject': 'Topic',
            'time': 'Time',
            'classCount': 'Classes',
            'sheetMade': 'Sheet',
            'homeworkGiven': 'Homework',
            'remarks': 'Remarks'
        };
        
        selectedFields.forEach(field => {
            headers.push(fieldMapping[field] || field);
        });
        
        const rows = data.map(entry => {
            const row = [];
            selectedFields.forEach(field => {
                switch(field) {
                    case 'studentName':
                        row.push(entry.studentName || entry.student || 'N/A');
                        break;
                    case 'date':
                        row.push(entry.date || 'N/A');
                        break;
                    case 'subject':
                        row.push(entry.topic || 'N/A');
                        break;
                    case 'time':
                        row.push(`${entry.timeFrom || 'N/A'} - ${entry.timeTo || 'N/A'}`);
                        break;
                    case 'classCount':
                        row.push(entry.classCount || 'N/A');
                        break;
                    case 'sheetMade':
                        row.push(entry.sheetMade === 'yes' ? 'Yes' : 'No');
                        break;
                    case 'homeworkGiven':
                        row.push(entry.homeworkGiven === 'yes' ? 'Yes' : 'No');
                        break;
                    case 'remarks':
                        row.push(entry.remarks || '-');
                        break;
                    default:
                        row.push('');
                }
            });
            return row;
        });
        
        // Add table
        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [212, 175, 55] }
        });
        
        // Save PDF
        const fileName = `Teacher_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        alert(`✅ PDF downloaded successfully!\n${data.length} records exported.`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please make sure the libraries are loaded.');
    }
}

// Download as Excel
window.downloadExcel = function() {
    const selectedFields = getSelectedFields();
    const data = getFilteredData();
    
    if (data.length === 0) {
        alert('No data to download. Please adjust your filters.');
        return;
    }
    
    if (selectedFields.length === 0) {
        alert('Please select at least one field to include in the download.');
        return;
    }
    
    try {
        const fieldMapping = {
            'studentName': 'Student Name',
            'date': 'Date',
            'subject': 'Topic/Subject',
            'time': 'Time',
            'classCount': 'Class Count',
            'sheetMade': 'Sheet Made',
            'homeworkGiven': 'Homework Given',
            'remarks': 'Remarks'
        };
        
        // Prepare worksheet data
        const wsData = data.map(entry => {
            const row = {};
            selectedFields.forEach(field => {
                const header = fieldMapping[field] || field;
                switch(field) {
                    case 'studentName':
                        row[header] = entry.studentName || entry.student || 'N/A';
                        break;
                    case 'date':
                        row[header] = entry.date || 'N/A';
                        break;
                    case 'subject':
                        row[header] = entry.topic || 'N/A';
                        break;
                    case 'time':
                        row[header] = `${entry.timeFrom || 'N/A'} - ${entry.timeTo || 'N/A'}`;
                        break;
                    case 'classCount':
                        row[header] = entry.classCount || 'N/A';
                        break;
                    case 'sheetMade':
                        row[header] = entry.sheetMade === 'yes' ? 'Yes' : 'No';
                        break;
                    case 'homeworkGiven':
                        row[header] = entry.homeworkGiven === 'yes' ? 'Yes' : 'No';
                        break;
                    case 'remarks':
                        row[header] = entry.remarks || '-';
                        break;
                }
            });
            return row;
        });
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Teacher Data');
        
        // Save file
        const fileName = `Teacher_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        alert(`✅ Excel file downloaded successfully!\n${data.length} records exported.`);
    } catch (error) {
        console.error('Error generating Excel:', error);
        alert('Error generating Excel file. Please make sure the libraries are loaded.');
    }
}

// Download weekly data
window.downloadWeeklyData = function() {
    const selectedFields = getSelectedFields();
    
    if (selectedFields.length === 0) {
        alert('Please select at least one field to include in the download.');
        return;
    }
    
    try {
        // Get all data (not just filtered)
        const allData = [...allEntriesCache];
        
        if (allData.length === 0) {
            alert('No data available for weekly download.');
            return;
        }
        
        // Group data by week
        const weekGroups = {};
        allData.forEach(entry => {
            if (!entry.date) return;
            
            const entryDate = new Date(entry.date + 'T00:00:00');
            const weekStart = new Date(entryDate);
            weekStart.setDate(entryDate.getDate() - entryDate.getDay()); // Start of week (Sunday)
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
            
            const weekKey = `${formatDateDDMMYYYY(weekStart)} - ${formatDateDDMMYYYY(weekEnd)}`;
            
            if (!weekGroups[weekKey]) {
                weekGroups[weekKey] = [];
            }
            weekGroups[weekKey].push(entry);
        });
        
        // Create Excel workbook with multiple sheets (one per week)
        const wb = XLSX.utils.book_new();
        
        const fieldMapping = {
            'studentName': 'Student Name',
            'date': 'Date',
            'subject': 'Topic/Subject',
            'time': 'Time',
            'classCount': 'Class Count',
            'sheetMade': 'Sheet Made',
            'homeworkGiven': 'Homework Given',
            'remarks': 'Remarks'
        };
        
        Object.keys(weekGroups).sort().forEach((weekRange, index) => {
            const weekData = weekGroups[weekRange];
            
            const wsData = weekData.map(entry => {
                const row = {};
                selectedFields.forEach(field => {
                    const header = fieldMapping[field] || field;
                    switch(field) {
                        case 'studentName':
                            row[header] = entry.studentName || entry.student || 'N/A';
                            break;
                        case 'date':
                            row[header] = entry.date || 'N/A';
                            break;
                        case 'subject':
                            row[header] = entry.topic || 'N/A';
                            break;
                        case 'time':
                            row[header] = `${entry.timeFrom || 'N/A'} - ${entry.timeTo || 'N/A'}`;
                            break;
                        case 'classCount':
                            row[header] = entry.classCount || 'N/A';
                            break;
                        case 'sheetMade':
                            row[header] = entry.sheetMade === 'yes' ? 'Yes' : 'No';
                            break;
                        case 'homeworkGiven':
                            row[header] = entry.homeworkGiven === 'yes' ? 'Yes' : 'No';
                            break;
                        case 'remarks':
                            row[header] = entry.remarks || '-';
                            break;
                    }
                });
                return row;
            });
            
            const ws = XLSX.utils.json_to_sheet(wsData);
            const sheetName = `Week ${index + 1}`;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
        
        // Save file
        const fileName = `Weekly_Teacher_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        alert(`✅ Weekly data downloaded successfully!\n${Object.keys(weekGroups).length} weeks exported with ${allData.length} total records.`);
    } catch (error) {
        console.error('Error generating weekly data:', error);
        alert('Error generating weekly data. Please make sure the libraries are loaded.');
    }
}

// Auto-download weekly data for teachers
window.checkAutoDownloadTeacher = function() {
    const role = localStorage.getItem('role');
    if (role !== 'teacher') return;
    
    const lastDownload = localStorage.getItem('lastAutoDownloadTeacher');
    const now = new Date();
    
    // Check if it's Sunday (day 0) or if a week has passed since last download
    const isNewWeek = !lastDownload || (now - new Date(lastDownload)) > (7 * 24 * 60 * 60 * 1000);
    
    if (isNewWeek) {
        const teacherName = localStorage.getItem('teacherName');
        console.log(`Auto-downloading weekly data for ${teacherName}...`);
        
        // Set last download timestamp
        localStorage.setItem('lastAutoDownloadTeacher', now.toISOString());
        
        // Trigger download after a delay to ensure data is loaded
        setTimeout(() => {
            if (typeof window.downloadWeeklyData === 'function') {
                window.downloadWeeklyData();
            }
        }, 3000);
    }
}

// Auto-download monthly data for admin
window.checkAutoDownloadAdmin = async function() {
    const role = localStorage.getItem('role');
    if (role !== 'admin') return;
    
    const lastDownload = localStorage.getItem('lastAutoDownloadAdmin');
    const now = new Date();
    
    // Check if a month has passed since last download
    const isNewMonth = !lastDownload || (now - new Date(lastDownload)) > (30 * 24 * 60 * 60 * 1000);
    
    if (isNewMonth) {
        console.log('Auto-downloading monthly admin data...');
        
        // Set last download timestamp
        localStorage.setItem('lastAutoDownloadAdmin', now.toISOString());
        
        // Trigger download after a delay to ensure data is loaded
        setTimeout(async () => {
            try {
                // Check if XLSX library is loaded
                if (typeof XLSX === 'undefined') {
                    console.log('XLSX library not loaded yet. Skipping auto-download.');
                    return;
                }
                
                // Get all entries for all teachers
                const entriesSnapshot = await getDocs(collection(db, "entries"));
                const allData = [];
                
                entriesSnapshot.forEach(doc => {
                    const data = doc.data();
                    allData.push({
                        id: doc.id,
                        ...data,
                        date: data.date || 'N/A',
                        teacherName: data.teacherName || 'N/A',
                        studentName: data.studentName || data.student || 'N/A',
                        topic: data.topic || '-',
                        timeFrom: data.timeFrom || 'N/A',
                        timeTo: data.timeTo || 'N/A',
                        classCount: data.classCount || 'N/A',
                        sheetMade: data.sheetMade === 'yes' ? 'Yes' : 'No',
                        homeworkGiven: data.homeworkGiven === 'yes' ? 'Yes' : 'No',
                        payment: data.payment || '-',
                        remarks: data.remarks || '-'
                    });
                });
                
                if (allData.length === 0) {
                    console.log('No data available for monthly download.');
                    return;
                }
                
                // Create Excel workbook
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(allData.map(entry => ({
                    'Date': entry.date,
                    'Teacher': entry.teacherName,
                    'Student': entry.studentName,
                    'Subject/Topic': entry.topic,
                    'Time From': entry.timeFrom,
                    'Time To': entry.timeTo,
                    'Classes': entry.classCount,
                    'Sheet Made': entry.sheetMade,
                    'Homework': entry.homeworkGiven,
                    'Payment': entry.payment,
                    'Remarks': entry.remarks
                })));
                
                XLSX.utils.book_append_sheet(wb, ws, 'All Entries');
                
                // Save file
                const fileName = `Admin_Monthly_Report_${now.toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);
                
                console.log(`✅ Monthly admin data auto-downloaded: ${allData.length} records.`);
            } catch (error) {
                console.error('Error auto-downloading monthly data:', error);
            }
        }, 3000);
    }
}

// Initialize search listeners on page load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Delay to ensure DOM is fully loaded
        setTimeout(() => {
            setupSearchListeners();
        }, 500);
    });
}

// ==================== CLASSES DATA TAB ====================

let allClassesData = [];
let allClassesDataArray = [];

// Load classes data master sheet
window.loadClassesData = async function() {
    try {
        const tableBody = document.getElementById("classesDataTableBody");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="padding: 48px; text-align: center; color: #666666;">Loading classes data...</td></tr>';
        
        // Get all active students
        const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        allClassesData = [];
        const studentDataPromises = [];
        
        // For each student, get their entries
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            allClassesData.push(student);
            
            // Get entries for this student
            const promise = getDocs(query(collection(db, "entries"), where("studentId", "==", doc.id)))
                .then(entriesSnapshot => {
                    const entries = [];
                    const teachers = new Set();
                    const subjects = new Set();
                    
                    entriesSnapshot.forEach(entryDoc => {
                        const entry = entryDoc.data();
                        entries.push(entry);
                        if (entry.teacherName) teachers.add(entry.teacherName);
                        if (entry.subject) subjects.add(entry.subject);
                    });
                    
                    // Calculate classes since last payment
                    const paymentHistory = student.paymentHistory || [];
                    let classesSinceLastPayment = 0;
                    let lastPaymentDate = null;
                    let lastPaymentSubject = '-';
                    let lastPaymentType = '-';
                    let lastPaymentAmount = '-';
                    
                    if (paymentHistory.length > 0) {
                        // Get most recent payment
                        const lastPayment = paymentHistory.reduce((latest, p) => {
                            const pDate = new Date(p.date);
                            const latestDate = new Date(latest.date);
                            return pDate > latestDate ? p : latest;
                        });
                        
                        lastPaymentDate = new Date(lastPayment.date);
                        lastPaymentSubject = lastPayment.subject || '-';
                        lastPaymentType = lastPayment.paymentType || '-';
                        lastPaymentAmount = lastPayment.amount ? `₹${lastPayment.amount}` : '-';
                        
                        classesSinceLastPayment = entries.filter(e => new Date(e.date) > lastPaymentDate)
                            .reduce((sum, e) => sum + (e.classCount || 1), 0);
                    } else {
                        classesSinceLastPayment = entries.reduce((sum, e) => sum + (e.classCount || 1), 0);
                    }
                    
                    // Format date as dd/mm/yy
                    let formattedDate = '-';
                    if (lastPaymentDate) {
                        const d = lastPaymentDate.getDate().toString().padStart(2, '0');
                        const m = (lastPaymentDate.getMonth() + 1).toString().padStart(2, '0');
                        const y = lastPaymentDate.getFullYear().toString().slice(-2);
                        formattedDate = `${d}/${m}/${y}`;
                    }
                    
                    return {
                        student,
                        teachers: Array.from(teachers),
                        subjects: Array.from(subjects),
                        totalClasses: entries.reduce((sum, e) => sum + (e.classCount || 1), 0),
                        classesSinceLastPayment,
                        lastPaymentDate: formattedDate,
                        lastPaymentSubject,
                        lastPaymentType,
                        lastPaymentAmount,
                        totalPayments: paymentHistory.length,
                        entries
                    };
                });
            
            studentDataPromises.push(promise);
        });
        
        // Wait for all data
        const studentDataArray = await Promise.all(studentDataPromises);
        
        // Store globally for filtering
        allClassesDataArray = studentDataArray;
        
        // Display master sheet
        displayClassesDataMasterSheet(studentDataArray);
        
    } catch (error) {
        console.error("Error loading classes data:", error);
        alert("Error loading data. Check console.");
    }
}

// Display master sheet table
function displayClassesDataMasterSheet(dataArray) {
    const tableBody = document.getElementById("classesDataTableBody");
    if (!tableBody) return;
    
    if (dataArray.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" style="padding: 32px; text-align: center; color: #999; font-size: 13px;">No active students found.</td></tr>';
        return;
    }
    
    let html = '';
    
    dataArray.forEach((data, index) => {
        const { student, teachers, subjects, totalClasses: studentClasses, classesSinceLastPayment, lastPaymentDate, lastPaymentSubject, lastPaymentType, lastPaymentAmount, totalPayments } = data;
        
        const rowColor = index % 2 === 0 ? '#ffffff' : '#f1f8f4';
        const teachersList = teachers.length > 0 ? teachers.join(', ') : '-';
        const subjectsList = subjects.length > 0 ? subjects.join(', ') : '-';
        const remarks = student.remarks || '-';
        
        html += `
            <tr class="classes-data-row" data-student-name="${student.name.toLowerCase()}" style="background: ${rowColor}; border-bottom: 1px solid #e0e0e0; transition: background 0.2s;" onmouseover="this.style.background='#e8f5e9'" onmouseout="this.style.background='${rowColor}'">
                <td style="padding: 10px 12px; font-weight: 600; color: #2c2c2c; font-size: 13px;">${student.name}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #555;">${teachersList}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #555;">${subjectsList}</td>
                <td style="padding: 10px 12px; text-align: center; font-weight: 700; font-size: 14px; color: #66bb6a;">${studentClasses}</td>
                <td style="padding: 10px 12px; text-align: center; font-weight: 700; font-size: 14px; color: ${classesSinceLastPayment > 0 ? '#ef5350' : '#66bb6a'};">${classesSinceLastPayment}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #555;">${lastPaymentDate}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #555;">${lastPaymentSubject}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #555;">${lastPaymentType}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #66bb6a; font-weight: 600;">${lastPaymentAmount}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 13px; font-weight: 600; color: #4caf50;">${totalPayments}</td>
                <td style="padding: 10px 12px; font-size: 11px; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${remarks}">${remarks}</td>
                <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
                    <button onclick="viewStudentDetails('${student.id}')" style="padding: 6px 10px; background: linear-gradient(135deg, #81c784, #66bb6a); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; margin-right: 4px; display: inline-block;">View</button>
                    <button onclick="openAddPaymentModalForStudent('${student.id}')" style="padding: 6px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; margin-right: 4px; display: inline-block;">+ Pay</button>
                    <button onclick="editStudentRemarks('${student.id}', \`${student.name.replace(/`/g, '')}\`)" style="padding: 6px 10px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-block;">Edit</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Filter classes data by student name
window.filterClassesData = function() {
    const searchInput = document.getElementById('searchStudentInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        // Show all data
        displayClassesDataMasterSheet(allClassesDataArray);
        return;
    }
    
    // Filter data
    const filteredData = allClassesDataArray.filter(data => 
        data.student.name.toLowerCase().includes(searchTerm)
    );
    
    displayClassesDataMasterSheet(filteredData);
}

// Edit student remarks
window.editStudentRemarks = async function(studentId, studentName) {
    try {
        const studentData = allClassesData.find(s => s.id === studentId);
        const currentRemarks = studentData?.remarks || '';
        
        const newRemarks = prompt(`Edit remarks for ${studentName}:`, currentRemarks);
        
        if (newRemarks === null) return; // User cancelled
        
        // Update in Firestore
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            remarks: newRemarks.trim()
        });
        
        alert('✅ Remarks updated successfully!');
        
        // Reload classes data
        loadClassesData();
        
    } catch (error) {
        console.error('Error updating remarks:', error);
        alert('❌ Error updating remarks. Check console.');
    }
}

// Update stats (kept for compatibility but not displayed)
function updateClassesDataStats(students, classes, unpaid) {
    // Stats removed from UI, function kept for compatibility
    if (classesEl) classesEl.textContent = classes;
    if (unpaidEl) unpaidEl.textContent = unpaid;
}

// View student details in modal
window.viewStudentDetails = async function(studentId) {
    const data = allClassesData.find(s => s.id === studentId);
    if (!data) {
        alert('Student data not found');
        return;
    }
    
    // Get entries
    const entriesSnapshot = await getDocs(query(collection(db, "entries"), where("studentId", "==", studentId)));
    const entries = [];
    const teachers = new Set();
    const subjectCounts = {};
    
    entriesSnapshot.forEach(doc => {
        const entry = doc.data();
        entries.push(entry);
        if (entry.teacherName) teachers.add(entry.teacherName);
        const subject = entry.subject || "Unknown";
        subjectCounts[subject] = (subjectCounts[subject] || 0) + (entry.classCount || 1);
    });
    
    const paymentHistory = data.paymentHistory || [];
    
    // Calculate classes since last payment
    let classesSinceLastPayment = 0;
    if (paymentHistory.length > 0) {
        const lastPaymentDate = new Date(Math.max(...paymentHistory.map(p => new Date(p.date))));
        classesSinceLastPayment = entries.filter(e => new Date(e.date) > lastPaymentDate)
            .reduce((sum, e) => sum + (e.classCount || 1), 0);
    } else {
        classesSinceLastPayment = entries.length;
    }
    
    // Build modal content
    let teachersList = Array.from(teachers).map(t => `<span style="background: #e3f2fd; padding: 4px 10px; border-radius: 4px; margin: 4px; display: inline-block; font-size: 13px;">${t}</span>`).join('');
    if (teachersList === '') teachersList = '<span style="color: #999;">No teachers yet</span>';
    
    let subjectsList = Object.entries(subjectCounts).map(([subject, count]) => 
        `<div style="background: #fff3cd; padding: 8px 12px; border-radius: 6px; margin: 6px 0; border-left: 3px solid #ffc107;">
            <strong style="color: #2c2c2c;">${subject}:</strong> <span style="font-size: 18px; font-weight: 600; color: #f5576c;">${count}</span> classes
        </div>`
    ).join('');
    if (subjectsList === '') subjectsList = '<span style="color: #999;">No subjects yet</span>';
    
    let paymentHistoryHTML = '';
    if (paymentHistory.length === 0) {
        paymentHistoryHTML = '<div style="text-align: center; padding: 20px; color: #999;">No payment history yet.</div>';
    } else {
        paymentHistory.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((payment, index) => {
            const subject = payment.subject || "General";
            const paymentType = payment.paymentType || "-";
            const paymentDate = new Date(payment.date);
            
            const classesSince = entries.filter(e => {
                if (payment.subject && e.subject !== payment.subject) return false;
                return new Date(e.date) > paymentDate;
            }).reduce((sum, e) => sum + (e.classCount || 1), 0);
            
            paymentHistoryHTML += `
                <div style="background: ${index % 2 === 0 ? '#f8f9fa' : 'white'}; padding: 16px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid #f5576c;">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px;">
                            <div style="font-weight: 600; font-size: 15px; color: #2c2c2c; margin-bottom: 6px;">
                                <span style="background: #f093fb; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">${subject}</span>
                                ${paymentType}
                            </div>
                            <div style="color: #666; font-size: 13px;">
                                <strong>Date:</strong> ${payment.date}
                                ${payment.amount ? ` | <strong>Amount:</strong> ₹${payment.amount}` : ''}
                            </div>
                            ${payment.remarks ? `<div style="color: #888; font-size: 12px; margin-top: 4px; font-style: italic;">${payment.remarks}</div>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 24px; font-weight: 700; color: ${classesSince > 0 ? '#f5576c' : '#4CAF50'};">${classesSince}</div>
                            <div style="font-size: 11px; color: #666;">classes since</div>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    const modalHTML = `
        <div id="studentDetailsModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 20px;" onclick="if(event.target.id==='studentDetailsModal') closeStudentDetailsModal()">
            <div style="background: white; max-width: 900px; width: 100%; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                <div style="position: sticky; top: 0; background: linear-gradient(135deg, #f093fb, #f5576c); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; z-index: 1;">
                    <h3 style="margin: 0; font-size: 20px;">${data.name} - Details</h3>
                    <button onclick="closeStudentDetailsModal()" style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 16px; font-weight: 600;">×</button>
                </div>
                
                <div style="padding: 24px;">
                    <!-- Overview -->
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin: 0 0 16px 0; color: #2c2c2c; font-size: 16px; font-weight: 600; border-bottom: 2px solid #f5576c; padding-bottom: 8px;">Student Overview</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 16px;">
                            <div>
                                <h5 style="margin: 0 0 12px 0; color: #555; font-size: 14px; text-transform: uppercase;">Teachers</h5>
                                <div>${teachersList}</div>
                            </div>
                            <div>
                                <h5 style="margin: 0 0 12px 0; color: #555; font-size: 14px; text-transform: uppercase;">Total Entries</h5>
                                <div style="font-size: 32px; font-weight: 700; color: #f5576c;">${entries.length}</div>
                            </div>
                            <div>
                                <h5 style="margin: 0 0 12px 0; color: #555; font-size: 14px; text-transform: uppercase;">Classes After Last Payment</h5>
                                <div style="font-size: 32px; font-weight: 700; color: ${classesSinceLastPayment > 0 ? '#e74c3c' : '#4CAF50'};">${classesSinceLastPayment}</div>
                            </div>
                        </div>
                        <div>
                            <h5 style="margin: 0 0 12px 0; color: #555; font-size: 14px; text-transform: uppercase;">Subject-wise Classes</h5>
                            ${subjectsList}
                        </div>
                    </div>
                    
                    <!-- Payment History -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="margin: 0; color: #2c2c2c; font-size: 16px; font-weight: 600; border-bottom: 2px solid #f5576c; padding-bottom: 8px; flex: 1;">Payment History</h4>
                            <button onclick="closeStudentDetailsModal(); openAddPaymentModalForStudent('${studentId}')" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; margin-left: 16px;">+ Add Payment</button>
                        </div>
                        ${paymentHistoryHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close student details modal
window.closeStudentDetailsModal = function() {
    const modal = document.getElementById('studentDetailsModal');
    if (modal) modal.remove();
}

// Open add payment modal for a specific student (from table button)
window.openAddPaymentModalForStudent = async function(studentId) {
    console.log('openAddPaymentModalForStudent called with studentId:', studentId);
    
    if (!studentId) {
        alert('Error: No student ID provided');
        return;
    }
    
    const student = allClassesData.find(s => s.id === studentId);
    if (!student) {
        console.error('Student not found in allClassesData with ID:', studentId);
        alert('Student not found');
        return;
    }
    
    console.log('Student found:', student.name, 'ID:', student.id);
    
    // Get student's classes attendance
    const entriesSnapshot = await getDocs(query(collection(db, "entries"), where("studentId", "==", studentId)));
    const subjects = new Set();
    const classesAttended = [];
    
    entriesSnapshot.forEach(doc => {
        const data = doc.data();
        const subject = data.subject || "Unknown";
        subjects.add(subject);
        
        // Format class attendance info - handle both Timestamp and string dates
        let classDate = 'Unknown Date';
        let timestamp = 0;
        
        if (data.date) {
            if (data.date.seconds) {
                // Firestore Timestamp
                classDate = new Date(data.date.seconds * 1000).toLocaleDateString('en-GB');
                timestamp = data.date.seconds;
            } else if (typeof data.date === 'string') {
                // String date
                const dateObj = new Date(data.date);
                if (!isNaN(dateObj.getTime())) {
                    classDate = dateObj.toLocaleDateString('en-GB');
                    timestamp = dateObj.getTime() / 1000;
                }
            }
        }
        
        const startTime = data.timeFrom || data.startTime || 'N/A';
        const endTime = data.timeTo || data.endTime || 'N/A';
        
        classesAttended.push({
            date: classDate,
            subject: subject,
            time: `${startTime} - ${endTime}`,
            timestamp: timestamp
        });
    });
    
    // Sort classes by date (most recent first)
    classesAttended.sort((a, b) => b.timestamp - a.timestamp);
    
    // Build classes list HTML
    let classesListHTML = '';
    if (classesAttended.length > 0) {
        classesListHTML = `
            <div style="margin-bottom: 20px; padding: 16px; background: #f0f9ff; border: 1px solid #81c784; border-radius: 8px;">
                <h4 style="margin: 0 0 12px 0; color: #2c2c2c; font-size: 14px; font-weight: 600; display: flex; align-items: center;">
                    <span style="background: #81c784; color: white; padding: 4px 10px; border-radius: 6px; margin-right: 10px; font-size: 12px;">${classesAttended.length}</span>
                    Classes Attended
                </h4>
                <div style="max-height: 200px; overflow-y: auto; background: white; border-radius: 6px; padding: 8px;">
                    ${classesAttended.slice(0, 20).map((cls, idx) => `
                        <div style="padding: 8px 10px; border-bottom: 1px solid #e8f5e9; font-size: 12px; display: flex; justify-content: space-between; ${idx % 2 === 0 ? 'background: #fafafa;' : ''}">
                            <div style="flex: 1;">
                                <span style="font-weight: 600; color: #2c2c2c;">${cls.subject}</span>
                                <span style="color: #666; margin-left: 8px;">• ${cls.time}</span>
                            </div>
                            <span style="color: #81c784; font-weight: 500; margin-left: 10px;">${cls.date}</span>
                        </div>
                    `).join('')}
                    ${classesAttended.length > 20 ? `<div style="padding: 8px; text-align: center; color: #666; font-size: 11px;">+ ${classesAttended.length - 20} more classes</div>` : ''}
                </div>
            </div>
        `;
    } else {
        classesListHTML = `
            <div style="margin-bottom: 20px; padding: 16px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; text-align: center; color: #856404; font-size: 13px;">
                No classes attended yet
            </div>
        `;
    }
    
    const modalHTML = `
        <div id="addPaymentModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000; display: flex; align-items: center; justify-content: center;" onclick="if(event.target.id==='addPaymentModal') closeAddPaymentModalForStudent()">
            <div style="background: white; max-width: 550px; width: 90%; border-radius: 12px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); max-height: 85vh; overflow-y: auto;" onclick="event.stopPropagation()">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f5576c; padding-bottom: 12px;">
                    <h3 style="margin: 0; color: #2c3e50;">Add Payment - ${student.name}</h3>
                    <button onclick="closeAddPaymentModalForStudent()" style="background: #e74c3c; color: white; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 14px; font-weight: 600;">×</button>
                </div>
                
                ${classesListHTML}
                
                <div style="margin-bottom: 16px; position: relative;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #2c2c2c;">Subject</label>
                    <input type="text" id="paymentSubjectInput" placeholder="Type to search subjects..." autocomplete="off" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: 'Roboto', sans-serif;">
                    <div id="paymentSubjectDropdown" class="autocomplete-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #81c784; border-top: 1px solid #ddd; border-radius: 0 0 8px 8px; max-height: 200px; overflow-y: auto; z-index: 9999; box-shadow: 0 8px 16px rgba(0,0,0,0.2); display: none; margin-top: 2px;"></div>
                    <input type="hidden" id="paymentSubject">
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #2c2c2c;">Payment Type</label>
                    <select id="paymentType" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: 'Roboto', sans-serif;">
                        <option value="Monthly">Monthly</option>
                        <option value="Per Class">Per Class</option>
                        <option value="Lump Sum">Lump Sum</option>
                        <option value="Custom">Custom</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #2c2c2c;">Payment Date</label>
                    <input type="date" id="paymentDate" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: 'Roboto', sans-serif;">
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #2c2c2c;">Amount (Optional)</label>
                    <input type="number" id="paymentAmount" placeholder="Enter amount" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: 'Roboto', sans-serif;">
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #2c2c2c;">Remarks (Optional)</label>
                    <textarea id="paymentRemarks" placeholder="Add any notes..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: 'Roboto', sans-serif; resize: vertical; min-height: 60px;"></textarea>
                </div>
                
                <button onclick="saveNewPaymentForStudent('${studentId}')" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #f093fb, #f5576c); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Save Payment</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Set today's date as default
    document.getElementById('paymentDate').valueAsDate = new Date();
    
    // Initialize subject autocomplete
    initPaymentSubjectSearch();
}

// Initialize subject autocomplete for payment modal
function initPaymentSubjectSearch() {
    const searchInput = document.getElementById("paymentSubjectInput");
    const dropdown = document.getElementById("paymentSubjectDropdown");
    const hiddenInput = document.getElementById("paymentSubject");

    if (!searchInput || !dropdown) return;

    let selectedIndex = -1;

    searchInput.addEventListener("input", function() {
        const search = this.value.trim();
        selectedIndex = -1;
        
        if (!search) {
            dropdown.innerHTML = '';
            dropdown.style.display = 'none';
            hiddenInput.value = '';
            return;
        }
        
        // Filter subjects that start with the typed text
        const matches = SUBJECT_LIST.filter(subject => 
            subject.toLowerCase().startsWith(search.toLowerCase())
        );
        
        // Build dropdown
        dropdown.innerHTML = '';
        
        if (matches.length === 0) {
            // Show option to add new subject
            const addItem = document.createElement('div');
            addItem.className = 'autocomplete-item';
            addItem.style.color = '#4285f4';
            addItem.style.fontWeight = '500';
            addItem.style.padding = '12px 16px';
            addItem.style.cursor = 'pointer';
            addItem.innerHTML = `➕ Add "${search}" as new subject`;
            
            addItem.addEventListener('click', async () => {
                const confirmed = confirm(`Add "${search}" to the subject list?`);
                if (confirmed) {
                    const saved = await saveCustomSubject(search);
                    if (saved) {
                        searchInput.value = search;
                        hiddenInput.value = search;
                        dropdown.innerHTML = '';
                        dropdown.style.display = 'none';
                        alert(`✅ "${search}" has been added to the subject list!`);
                    } else {
                        searchInput.value = search;
                        hiddenInput.value = search;
                        dropdown.innerHTML = '';
                        dropdown.style.display = 'none';
                    }
                }
            });
            
            dropdown.appendChild(addItem);
            dropdown.style.display = 'block';
            return;
        }
        
        matches.forEach((subject) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.style.padding = '12px 16px';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid #f0f0f0';
            item.style.transition = 'background 0.2s';
            
            // Highlight matching text
            const regex = new RegExp(`(${search})`, 'gi');
            const highlightedName = subject.replace(regex, '<span style="font-weight: 700; color: #81c784; background: #e8f5e9; padding: 2px 4px; border-radius: 3px;">$1</span>');
            
            item.innerHTML = highlightedName;
            
            item.addEventListener('mouseover', () => {
                item.style.background = '#e8f5e9';
            });
            
            item.addEventListener('mouseout', () => {
                item.style.background = 'white';
            });
            
            item.addEventListener('click', () => {
                searchInput.value = subject;
                hiddenInput.value = subject;
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
            });
            
            dropdown.appendChild(item);
        });
        
        dropdown.style.display = 'block';
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex]?.click();
        }
    });

    function updateSelection(items) {
        items.forEach((item, i) => {
            if (i === selectedIndex) {
                item.style.background = '#e8f5e9';
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.style.background = 'white';
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.innerHTML = '';
            dropdown.style.display = 'none';
        }
    });
}

// Close add payment modal
window.closeAddPaymentModalForStudent = function() {
    const modal = document.getElementById('addPaymentModal');
    if (modal) modal.remove();
}

// Save new payment for student
window.saveNewPaymentForStudent = async function(studentId) {
    try {
        console.log('saveNewPaymentForStudent called with studentId:', studentId);
        
        if (!studentId) {
            alert('Error: Invalid student ID. Please close this window and try again.');
            return;
        }
        
        const subjectEl = document.getElementById('paymentSubject');
        const paymentTypeEl = document.getElementById('paymentType');
        const dateEl = document.getElementById('paymentDate');
        const amountEl = document.getElementById('paymentAmount');
        const remarksEl = document.getElementById('paymentRemarks');
        
        const subject = subjectEl ? subjectEl.value : '';
        const paymentType = paymentTypeEl ? paymentTypeEl.value : 'Monthly';
        const date = dateEl ? dateEl.value : '';
        const amount = amountEl ? amountEl.value : '';
        const remarks = remarksEl ? remarksEl.value.trim() : '';
        
        if (!date) {
            alert('Please select a payment date');
            return;
        }
        
        const student = allClassesData.find(s => s.id === studentId);
        if (!student) {
            console.error('Student not found in allClassesData with ID:', studentId);
            alert('Student not found. Please refresh the page and try again.');
            return;
        }
        
        const paymentHistory = student.paymentHistory || [];
        
        paymentHistory.push({
            subject: subject || null,
            paymentType: paymentType,
            date: date,
            amount: amount ? parseFloat(amount) : null,
            remarks: remarks || null,
            addedAt: new Date().toISOString()
        });
        
        const docRef = doc(db, "students", studentId);
        await updateDoc(docRef, {
            paymentHistory: paymentHistory
        });
        
        closeAddPaymentModalForStudent();
        alert('✅ Payment added successfully!');
        await loadClassesData(); // Reload master sheet
        
    } catch (error) {
        console.error('Error saving payment:', error);
        alert('❌ Error saving payment: ' + error.message);
    }
}

// Export classes data to Excel
window.exportClassesDataExcel = async function() {
    try {
        if (!window.XLSX) {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const exportData = [];
        
        // Get all student data with entries
        for (const student of allClassesData) {
            const entriesSnapshot = await getDocs(query(collection(db, "entries"), where("studentId", "==", student.id)));
            
            const teachers = new Set();
            const subjects = new Set();
            let totalClasses = 0;
            
            entriesSnapshot.forEach(doc => {
                const entry = doc.data();
                if (entry.teacherName) teachers.add(entry.teacherName);
                if (entry.subject) subjects.add(entry.subject);
                totalClasses += entry.classCount || 1;
            });
            
            const paymentHistory = student.paymentHistory || [];
            let classesSinceLastPayment = 0;
            let lastPaymentDate = '-';
            
            if (paymentHistory.length > 0) {
                const lastDate = new Date(Math.max(...paymentHistory.map(p => new Date(p.date))));
                lastPaymentDate = lastDate.toISOString().split('T')[0];
                
                entriesSnapshot.forEach(doc => {
                    const entry = doc.data();
                    if (new Date(entry.date) > lastDate) {
                        classesSinceLastPayment += entry.classCount || 1;
                    }
                });
            } else {
                classesSinceLastPayment = totalClasses;
            }
            
            exportData.push({
                'Student Name': student.name,
                'Teachers': Array.from(teachers).join(', ') || '-',
                'Subjects': Array.from(subjects).join(', ') || '-',
                'Total Classes': totalClasses,
                'Classes After Last Payment': classesSinceLastPayment,
                'Last Payment Date': lastPaymentDate,
                'Total Payments': paymentHistory.length,
                'Pay Structure': student.payType || '-',
                'Mode': student.mode || '-',
                'Status': student.status || '-'
            });
        }
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Classes Data");
        
        const fileName = `Classes_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Error exporting data. Check console.');
    }
}
// ========== DOUBT/DEMO SESSIONS FUNCTIONS ==========

// Handle doubt session form submission
window.addEventListener('DOMContentLoaded', function() {
    const doubtForm = document.getElementById('doubtSessionForm');
    if (doubtForm) {
        doubtForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const studentName = document.getElementById('doubtStudentName').value.trim();
            const studentClass = document.getElementById('doubtClass').value.trim();
            const subject = document.getElementById('doubtSubject').value.trim();
            const sessionDate = document.getElementById('doubtDate').value;
            const sessionType = document.getElementById('doubtSessionType').value;
            const remarks = document.getElementById('doubtRemarks').value.trim();
            
            const teacherId = localStorage.getItem('teacherId');
            const teacherName = localStorage.getItem('teacherName');
            const teacherEmail = localStorage.getItem('teacherEmail');
            
            if (!teacherId || !teacherName) {
                alert('Please login again.');
                return;
            }
            
            try {
                await addDoc(collection(db, 'doubt_sessions'), {
                    studentName,
                    studentClass,
                    subject,
                    sessionDate,
                    sessionType,
                    remarks,
                    teacherId,
                    teacherName,
                    teacherEmail,
                    createdAt: serverTimestamp()
                });
                
                alert('✅ Session saved successfully!');
                
                // Reset form
                doubtForm.reset();
                
                // Set today's date as default
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('doubtDate').value = today;
                
                // Reload sessions list
                loadDoubtSessions();
                
            } catch (error) {
                console.error('Error saving doubt session:', error);
                alert('❌ Error saving session. Please try again.');
            }
        });
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('doubtDate').value = today;
    }
});

// Load doubt sessions for teacher
window.loadDoubtSessions = async function() {
    const div = document.getElementById('doubtSessionsList');
    if (!div) return;
    
    const teacherId = localStorage.getItem('teacherId');
    const role = localStorage.getItem('role');
    
    if (!teacherId) {
        div.innerHTML = '<p class="empty-state">Please login again.</p>';
        return;
    }
    
    div.innerHTML = '<p class="empty-state">Loading sessions...</p>';
    
    try {
        let sessionsQuery;
        
        // Admin can see all sessions, teachers see only their own
        if (role === 'admin') {
            sessionsQuery = query(
                collection(db, 'doubt_sessions'),
                orderBy('createdAt', 'desc')
            );
        } else {
            sessionsQuery = query(
                collection(db, 'doubt_sessions'),
                where('teacherId', '==', teacherId),
                orderBy('createdAt', 'desc')
            );
        }
        
        const snapshot = await getDocs(sessionsQuery);
        
        if (snapshot.empty) {
            div.innerHTML = '<p class="empty-state">No doubt/demo sessions recorded yet.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const session = doc.data();
            const sessionTypeLabel = session.sessionType === 'doubt' ? 'Doubt Clearing Session' : 'Demo Session';
            const sessionTypeColor = session.sessionType === 'doubt' ? '#1a73e8' : '#90ee90';
            const formattedDate = session.sessionDate ? formatDateDDMMYYYY(new Date(session.sessionDate + 'T00:00:00')) : 'N/A';
            
            html += `
                <div style="background: rgba(255, 255, 255, 0.95); border-left: 4px solid ${sessionTypeColor}; padding: 16px; border-radius: 4px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(44, 44, 44, 0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 600; color: #2c2c2c; font-size: 15px; font-family: 'Roboto', sans-serif;">${session.studentName}</div>
                            <div style="color: #666; font-size: 13px; margin-top: 4px; font-family: 'Roboto', sans-serif;">
                                <span style="background: ${sessionTypeColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${sessionTypeLabel}</span>
                                <span style="margin-left: 8px;">Date: ${formattedDate}</span>
                            </div>
                        </div>
                        ${role === 'admin' ? `<div style="font-size: 12px; color: #666; font-family: 'Roboto', sans-serif;">Teacher: ${session.teacherName || 'N/A'}</div>` : ''}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 13px; color: #666666; font-family: 'Roboto', sans-serif;">
                        <div><strong style="color: #2c2c2c;">Class:</strong> ${session.studentClass || 'N/A'}</div>
                        <div><strong style="color: #2c2c2c;">Subject:</strong> ${session.subject || 'N/A'}</div>
                    </div>
                    ${session.remarks ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed; font-size: 13px; color: #666; font-family: 'Roboto', sans-serif;"><strong style="color: #2c2c2c;">Remarks:</strong> ${session.remarks}</div>` : ''}
                </div>
            `;
        });
        
        div.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading doubt sessions:', error);
        div.innerHTML = '<p style="color: red;">❌ Error loading sessions. Check console.</p>';
    }
}

// Load all doubt sessions for admin
window.loadAdminDoubtSessions = async function() {
    const div = document.getElementById('adminDoubtSessionsList');
    if (!div) return;
    
    div.innerHTML = '<p class="empty-state" style="text-align: center; padding: 48px; color: #666;">Loading sessions...</p>';
    
    try {
        const sessionsQuery = query(
            collection(db, 'doubt_sessions'),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(sessionsQuery);
        
        if (snapshot.empty) {
            div.innerHTML = '<p class="empty-state" style="text-align: center; padding: 48px; color: #666;">No doubt/demo sessions recorded yet.</p>';
            return;
        }
        
        let html = '<div style="display: grid; gap: 16px;">';
        snapshot.forEach(doc => {
            const session = doc.data();
            const sessionTypeLabel = session.sessionType === 'doubt' ? 'Doubt Clearing Session' : 'Demo Session';
            const sessionTypeColor = session.sessionType === 'doubt' ? '#1a73e8' : '#90ee90';
            const formattedDate = session.sessionDate ? formatDateDDMMYYYY(new Date(session.sessionDate + 'T00:00:00')) : 'N/A';
            const createdDate = session.createdAt?.toDate ? formatDateDDMMYYYY(session.createdAt.toDate()) : 'N/A';
            
            html += `
                <div style="background: rgba(255, 255, 255, 0.95); border-left: 4px solid ${sessionTypeColor}; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(44, 44, 44, 0.1);">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; margin-bottom: 16px;">
                        <div>
                            <div style="font-weight: 600; color: #2c2c2c; font-size: 16px; font-family: 'Roboto', sans-serif; margin-bottom: 8px;">${session.studentName}</div>
                            <div style="color: #666; font-size: 13px; font-family: 'Roboto', sans-serif; margin-bottom: 6px;">
                                <span style="background: ${sessionTypeColor}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">${sessionTypeLabel}</span>
                                <span style="margin-left: 12px;"><strong>Session Date:</strong> ${formattedDate}</span>
                            </div>
                            <div style="color: #999; font-size: 12px; font-family: 'Roboto', sans-serif;">
                                Logged on: ${createdDate}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 13px; color: #1a73e8; font-weight: 600; font-family: 'Roboto', sans-serif;">${session.teacherName || 'N/A'}</div>
                            <div style="font-size: 12px; color: #666; font-family: 'Roboto', sans-serif; margin-top: 4px;">${session.teacherEmail || ''}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px; color: #666666; font-family: 'Roboto', sans-serif; padding: 16px; background: #f8f9fa; border-radius: 6px;">
                        <div><strong style="color: #2c2c2c;">Class:</strong> ${session.studentClass || 'N/A'}</div>
                        <div><strong style="color: #2c2c2c;">Subject:</strong> ${session.subject || 'N/A'}</div>
                    </div>
                    ${session.remarks ? `<div style="margin-top: 16px; padding: 12px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 4px; font-size: 13px; color: #856404; font-family: 'Roboto', sans-serif;"><strong>Remarks:</strong> ${session.remarks}</div>` : ''}
                </div>
            `;
        });
        
        div.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading admin doubt sessions:', error);
        div.innerHTML = '<p style="color: red; text-align: center; padding: 48px;">❌ Error loading sessions. Check console.</p>';
    }
}
// ========== SESSION REPORTS & ANALYTICS ==========

let allSessionReports = [];
let filteredSessionReports = [];

// Load session reports
window.loadSessionReports = async function() {
    try {
        const snapshot = await getDocs(collection(db, 'doubt_sessions'));
        
        allSessionReports = [];
        snapshot.forEach(doc => {
            allSessionReports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by createdAt descending
        allSessionReports.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });
        
        // Populate filter dropdowns
        populateSessionReportFilters();
        
        // Show all initially
        filteredSessionReports = [...allSessionReports];
        displaySessionReports();
        
    } catch (error) {
        console.error('Error loading session reports:', error);
        const tbody = document.getElementById('sessionReportTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 48px; text-align: center; color: red;">? Error loading sessions. Check console.</td></tr>';
        }
    }
};

// Populate filter dropdowns
function populateSessionReportFilters() {
    const teacherMap = new Map();
    const students = new Set();
    const courses = new Set();
    
    allSessionReports.forEach(session => {
        if (session.teacherName) {
            teacherMap.set(session.teacherName, session.teacherEmail || '');
        }
        if (session.studentName) {
            students.add(session.studentName);
        }
        if (session.subject) {
            courses.add(session.subject);
        }
    });
    
    // Teacher filter
    const teacherFilter = document.getElementById('sessionReportTeacherFilter');
    if (teacherFilter) {
        const currentValue = teacherFilter.value;
        teacherFilter.innerHTML = '<option value="">All Teachers</option>';
        Array.from(teacherMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([name, email]) => {
                const displayText = email ? `${name} (${email})` : name;
                teacherFilter.innerHTML += `<option value="${name}" ${name === currentValue ? 'selected' : ''}>${displayText}</option>`;
            });
    }
    
    // Student filter
    const studentFilter = document.getElementById('sessionReportStudentFilter');
    if (studentFilter) {
        const currentValue = studentFilter.value;
        studentFilter.innerHTML = '<option value="">All Students</option>';
        Array.from(students)
            .sort()
            .forEach(student => {
                studentFilter.innerHTML += `<option value="${student}" ${student === currentValue ? 'selected' : ''}>${student}</option>`;
            });
    }
    
    // Course filter
    const courseFilter = document.getElementById('sessionReportCourseFilter');
    if (courseFilter) {
        const currentValue = courseFilter.value;
        courseFilter.innerHTML = '<option value="">All Courses</option>';
        Array.from(courses)
            .sort()
            .forEach(course => {
                courseFilter.innerHTML += `<option value="${course}" ${course === currentValue ? 'selected' : ''}>${course}</option>`;
            });
    }
}

// Apply filters
window.applySessionReportFilters = function() {
    const teacher = document.getElementById('sessionReportTeacherFilter')?.value;
    const student = document.getElementById('sessionReportStudentFilter')?.value;
    const course = document.getElementById('sessionReportCourseFilter')?.value;
    const dateFrom = document.getElementById('sessionReportDateFrom')?.value;
    const dateTo = document.getElementById('sessionReportDateTo')?.value;
    
    filteredSessionReports = allSessionReports.filter(session => {
        // Teacher filter
        if (teacher && session.teacherName !== teacher) return false;
        
        // Student filter
        if (student && session.studentName !== student) return false;
        
        // Course filter
        if (course && session.subject !== course) return false;
        
        // Date range filter
        if (dateFrom && session.sessionDate < dateFrom) return false;
        if (dateTo && session.sessionDate > dateTo) return false;
        
        return true;
    });
    
    displaySessionReports();
};

// Reset filters
window.resetSessionReportFilters = function() {
    document.getElementById('sessionReportTeacherFilter').value = '';
    document.getElementById('sessionReportStudentFilter').value = '';
    document.getElementById('sessionReportCourseFilter').value = '';
    document.getElementById('sessionReportDateFrom').value = '';
    document.getElementById('sessionReportDateTo').value = '';
    
    filteredSessionReports = [...allSessionReports];
    displaySessionReports();
};

// Display session reports
function displaySessionReports() {
    const div = document.getElementById('adminDoubtSessionsList');
    if (!div) return;
    
    // Update total count
    const totalCount = filteredSessionReports.length;
    const countElement = document.getElementById('sessionReportTotalCount');
    if (countElement) {
        countElement.textContent = `${totalCount} ${totalCount === 1 ? 'session' : 'sessions'}`;
    }
    
    // Display sessions
    if (filteredSessionReports.length === 0) {
        div.innerHTML = '<p class="empty-state" style="text-align: center; padding: 48px; color: #7f8c8d;">📭 No sessions match your filters</p>';
        return;
    }
    
    // Create table view
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead><tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Date</th>';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Student Name</th>';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Teacher</th>';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Class</th>';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Subject</th>';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Type</th>';
    html += '<th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #2c2c2c; font-size: 14px;">Remarks</th>';
    html += '</tr></thead><tbody>';
    
    filteredSessionReports.forEach((session, index) => {
        const sessionTypeLabel = session.sessionType === 'doubt' ? 'Doubt' : 'Demo';
        const sessionTypeColor = session.sessionType === 'doubt' ? '#1a73e8' : '#28a745';
        const formattedDate = session.sessionDate ? formatDateDDMMYYYY(new Date(session.sessionDate + 'T00:00:00')) : 'N/A';
        const sessionTime = session.sessionTime || 'N/A';
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        
        // Create a unique session identifier for the onclick
        const sessionDataJson = JSON.stringify({
            dateTime: `${formattedDate} ${sessionTime}`,
            studentName: session.studentName || 'N/A',
            teacherName: session.teacherName || 'N/A',
            class: session.studentClass || 'N/A',
            subject: session.subject || 'N/A',
            remarks: session.remarks || ''
        }).replace(/"/g, '&quot;');
        
        html += `
            <tr style="background: ${rowBg}; border-bottom: 1px solid #dee2e6; cursor: pointer; transition: background 0.2s;" 
                onclick='openSessionDetailModal(${sessionDataJson})'
                onmouseover="this.style.background='#e3f2fd'" 
                onmouseout="this.style.background='${rowBg}'">
                <td style="padding: 14px 12px; color: #2c2c2c; font-size: 14px; font-weight: 500;">${formattedDate}</td>
                <td style="padding: 14px 12px; color: #2c2c2c; font-size: 14px; font-weight: 500;">${session.studentName || 'N/A'}</td>
                <td style="padding: 14px 12px; color: #2c2c2c; font-size: 14px;">
                    <div style="font-weight: 500;">${session.teacherName || 'N/A'}</div>
                    ${session.teacherEmail ? `<div style="font-size: 12px; color: #666; margin-top: 2px;">${session.teacherEmail}</div>` : ''}
                </td>
                <td style="padding: 14px 12px; color: #2c2c2c; font-size: 14px;">${session.studentClass || 'N/A'}</td>
                <td style="padding: 14px 12px; color: #2c2c2c; font-size: 14px;">${session.subject || 'N/A'}</td>
                <td style="padding: 14px 12px;">
                    <span style="background: ${sessionTypeColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${sessionTypeLabel}</span>
                </td>
                <td style="padding: 14px 12px; color: #666; font-size: 13px;">${session.remarks || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    div.innerHTML = html;
}
// Open session detail modal
window.openSessionDetailModal = function(sessionData) {
    const modal = document.getElementById('sessionDetailModal');
    if (!modal) return;
    
    // Populate modal fields
    document.getElementById('modalSessionDateTime').textContent = sessionData.dateTime || 'N/A';
    document.getElementById('modalStudentName').textContent = sessionData.studentName || 'N/A';
    document.getElementById('modalTeacherName').textContent = sessionData.teacherName || 'N/A';
    document.getElementById('modalClass').textContent = sessionData.class || 'N/A';
    document.getElementById('modalSubject').textContent = sessionData.subject || 'N/A';
    
    // Handle remarks
    const remarksContainer = document.getElementById('modalRemarksContainer');
    const remarksText = document.getElementById('modalRemarks');
    if (sessionData.remarks && sessionData.remarks.trim()) {
        remarksText.textContent = sessionData.remarks;
        remarksContainer.style.display = 'block';
    } else {
        remarksContainer.style.display = 'none';
    }
    
    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

// Close session detail modal
window.closeSessionDetailModal = function() {
    const modal = document.getElementById('sessionDetailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.unlockAllBeforeMidnight = async function() {
    const { hour } = getKolkataTimeParts();
    if (hour === 0) {
        alert('It is already 12 AM or later. Use individual unlock if needed.');
        return;
    }

    try {
        const lockedQuery = query(
            collection(db, 'teachers'),
            where('status', '==', 'active'),
            where('isLocked', '==', true)
        );
        const snap = await getDocs(lockedQuery);

        if (snap.empty) {
            alert('No locked teachers found right now.');
            return;
        }

        const batch = writeBatch(db);
        snap.forEach((teacherDoc) => {
            batch.update(teacherDoc.ref, {
                isLocked: false,
                lockDate: null,
                unlockedByAdmin: true,
                lastAdminUnlockAt: serverTimestamp()
            });
        });

        await batch.commit();
        alert(`Unlocked ${snap.size} teacher(s). They can continue till 12 AM.`);
    } catch (error) {
        console.error('Bulk unlock failed:', error);
        alert('Failed to unlock all teachers. Please try again.');
    }
};

window.triggerTestReminder = async function() {
    if (!('Notification' in window)) {
        alert('This browser does not support notifications.');
        return;
    }

    if (Notification.permission !== 'granted') {
        alert('Please tap Enable Alerts first and allow notifications.');
        return;
    }

    const shown = await showAppNotification('ZIEL Test Reminder', {
        body: 'Test notification delivered successfully.',
        tag: 'ziel-test-reminder'
    });

    if (!shown) {
        alert('Test alert failed to display. Please re-enable alerts and try again.');
        return;
    }

    alert('Test alert sent. Check your phone notification tray.');
};