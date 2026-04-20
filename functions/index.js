const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

function getKolkataDateISO(dayOffset = 0) {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kolkataMs = utcMs + (5.5 * 60 * 60 * 1000) + (dayOffset * 24 * 60 * 60 * 1000);
  const d = new Date(kolkataMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function submittedOnDate(data, isoDate) {
  if (!data) return false;
  return data.lastSubmissionDate === isoDate || data.hasSubmittedToday === true;
}

async function getSubmittedTeacherKeysForDate(dateString) {
  const snapshot = await db.collection("entries").where("date", "==", dateString).get();
  const submittedKeys = new Set();

  snapshot.forEach((entryDoc) => {
    const data = entryDoc.data() || {};
    if (data.teacherId) {
      submittedKeys.add(`id:${String(data.teacherId)}`);
    }
    if (data.teacherName) {
      submittedKeys.add(`name:${String(data.teacherName).trim().toLowerCase()}`);
    }
  });

  return submittedKeys;
}

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();

function isLockoutExempt(data) {
  if (!data) return false;
  const role = String(data.role || "").toLowerCase();
  const email = String(data.email || data.adminEmail || "").toLowerCase();

  return data.isSuperAdmin === true || role === "superadmin" || (SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL);
}

/**
 * Scheduled Function: Midnight Lockout Engine
 * Runs every day at 00:00 (Midnight) Asia/Kolkata time.
 * Logic:
 * 1) Fetch all active teachers.
 * 2) If hasSubmittedToday == false AND isOnLeave == false => set isLocked = true.
 * 3) Reset hasSubmittedToday and isOnLeave for everyone for the new day.
 */
exports.midnightLockout = onSchedule({
  schedule: "0 0 * * *",
  timeZone: "Asia/Kolkata",
}, async () => {
    const todayKolkata = getKolkataDateISO(0);
    const yesterdayKolkata = getKolkataDateISO(-1);
    const cycleRef = db.collection("settings").doc("cycle_config");
    const cycleSnap = await cycleRef.get();

    // Idempotency guard: avoid duplicate reset if scheduler retries.
    if (cycleSnap.exists && cycleSnap.data().lastMidnightProcessedDate === todayKolkata) {
      console.log(`Midnight lockout already processed for ${todayKolkata}.`);
      return null;
    }

    const teachersRef = db.collection("teachers");
    const snapshot = await teachersRef.where("status", "==", "active").get();
    const submittedYesterdayKeys = await getSubmittedTeacherKeysForDate(yesterdayKolkata);

    if (snapshot.empty) {
      console.log("No active teachers found.");
      await cycleRef.set({
        lastMidnightProcessedDate: todayKolkata,
        lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return null;
    }

    let lockedCount = 0;
    let exemptCount = 0;
    let processedCount = 0;
    let batch = db.batch();
    let opsInBatch = 0;

    async function commitBatchIfNeeded(force = false) {
      if (opsInBatch >= 400 || (force && opsInBatch > 0)) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    for (const teacherDoc of snapshot.docs) {
      const data = teacherDoc.data() || {};
      const teacherRef = teachersRef.doc(teacherDoc.id);

      if (isLockoutExempt(data)) {
        exemptCount += 1;
        batch.update(teacherRef, {
          isLocked: false,
          lockDate: null,
          lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        opsInBatch += 1;
        processedCount += 1;
        await commitBatchIfNeeded(false);
        continue;
      }

      const teacherKey = `id:${teacherDoc.id}`;
      const teacherNameKey = data.name ? `name:${String(data.name).trim().toLowerCase()}` : null;
      const submittedYesterday = submittedYesterdayKeys.has(teacherKey) || (teacherNameKey ? submittedYesterdayKeys.has(teacherNameKey) : false);
      const shouldLock = !submittedYesterday && !data.isOnLeave;

      if (shouldLock) {
        lockedCount += 1;
        // Log teacher who didn't submit - after 12 AM
        console.log(`[MIDNIGHT LOCK] Teacher not submitted: ${data.name || 'Unknown'} (ID: ${teacherDoc.id}) on ${todayKolkata}`);
      }

      batch.update(teacherRef, {
        isLocked: shouldLock,
        lockDate: shouldLock ? todayKolkata : null,
        hasSubmittedToday: false,
        isOnLeave: false,
        lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      opsInBatch += 1;
      processedCount += 1;
      await commitBatchIfNeeded(false);
    }

    await commitBatchIfNeeded(true);

    await cycleRef.set({
      lastMidnightProcessedDate: todayKolkata,
      lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLockedCount: lockedCount,
      lastExemptCount: exemptCount,
      lastProcessedTeachers: processedCount,
    }, { merge: true });

    console.log(`Midnight Sync Complete. Processed: ${processedCount}, Locked: ${lockedCount}, Exempt: ${exemptCount}`);
    return null;
});

exports.escalatingNaggingReminders = onSchedule({
  schedule: "0,30 22,23 * * *",
  timeZone: "Asia/Kolkata",
}, async () => {
    const now = new Date();
    const todayKolkata = getKolkataDateISO(0);
    const kolkataTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);

    const [hour, minute] = kolkataTime.split(":").map(Number);
    let title = "Reminder Notification";
    let body = "Fill today's class data.";

    if (hour === 22 && minute === 30) body = "Fill today's class data.";
    if (hour === 23 && minute === 0) {
      title = "Reminder Notification";
      body = "Fill today's class data.";
    }
    if (hour === 23 && minute === 30) {
      title = "Reminder Notification";
      body = "Fill today's class data.";
    }

    const snapshot = await db.collection("teachers")
      .where("status", "==", "active")
      .get();

    const messages = [];
    const tokenToTeacherRef = [];
    snapshot.forEach((teacherDoc) => {
      const data = teacherDoc.data() || {};
      if (data.deviceToken) {
        messages.push({
          token: data.deviceToken,
          notification: { title, body },
          android: { priority: "high" },
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title,
              body,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: "nagging-reminder",
              renotify: true,
            },
            fcmOptions: {
              link: "/teacher.html",
            },
          },
          data: {
            title,
            body,
            reminderType: "nagging-reminder",
            reminderDate: todayKolkata,
          },
        });
        tokenToTeacherRef.push({
          teacherRef: teacherDoc.ref,
          token: data.deviceToken,
          teacherId: teacherDoc.id,
        });
      }
    });

    if (messages.length > 0) {
      const result = await admin.messaging().sendEach(messages);
      const failedResponses = [];
      const invalidTokenIndexes = [];

      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code || "unknown";
          failedResponses.push({
            index: idx,
            code,
            message: resp.error?.message || "No error message",
            teacherId: tokenToTeacherRef[idx]?.teacherId || null,
          });

          if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
            invalidTokenIndexes.push(idx);
          }
        }
      });

      if (invalidTokenIndexes.length > 0) {
        const batch = db.batch();
        invalidTokenIndexes.forEach((idx) => {
          const entry = tokenToTeacherRef[idx];
          if (!entry?.teacherRef) return;

          batch.update(entry.teacherRef, {
            deviceToken: admin.firestore.FieldValue.delete(),
            notificationsEnabled: false,
            lastTokenError: "invalid-or-unregistered-token",
            lastTokenErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }

      console.log(`Escalating reminders summary -> activeTeachers: ${snapshot.size}, withToken: ${messages.length}, success: ${result.successCount}, failed: ${result.failureCount}, invalidTokensPruned: ${invalidTokenIndexes.length}`);
      if (failedResponses.length > 0) {
        console.log("Escalating reminders failed responses:", JSON.stringify(failedResponses));
      }
    } else {
      console.log(`No eligible teachers with device tokens. Active teachers scanned: ${snapshot.size}`);
    }

    return null;
  });
