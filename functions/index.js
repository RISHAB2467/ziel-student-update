const functions = require("firebase-functions");
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

/**
 * Scheduled Function: Midnight Lockout Engine
 * Runs every day at 00:00 (Midnight) Asia/Kolkata time.
 * Logic:
 * 1) Fetch all active teachers.
 * 2) If hasSubmittedToday == false AND isOnLeave == false => set isLocked = true.
 * 3) Reset hasSubmittedToday and isOnLeave for everyone for the new day.
 */
exports.midnightLockout = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
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

    if (snapshot.empty) {
      console.log("No active teachers found.");
      await cycleRef.set({
        lastMidnightProcessedDate: todayKolkata,
        lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return null;
    }

    let lockedCount = 0;
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
      const submittedYesterday = submittedOnDate(data, yesterdayKolkata);
      const shouldLock = !submittedYesterday && !data.isOnLeave;

      if (shouldLock) {
        lockedCount += 1;
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
      lastProcessedTeachers: processedCount,
    }, { merge: true });

    console.log(`Midnight Sync Complete. Processed: ${processedCount}, Locked: ${lockedCount}`);
    return null;
  });

exports.escalatingNaggingReminders = functions.pubsub
  .schedule("0,30 22,23 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const now = new Date();
    const todayKolkata = getKolkataDateISO(0);
    const kolkataTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);

    const [hour, minute] = kolkataTime.split(":").map(Number);
    let title = "ZIEL: Reminder";
    let body = "Please log today's classes.";

    if (hour === 22 && minute === 30) body = "Data is missing. Please fill it now.";
    if (hour === 23 && minute === 0) {
      title = "URGENT: ZIEL";
      body = "1 hour until midnight lockout! Submit now.";
    }
    if (hour === 23 && minute === 30) {
      title = "FINAL WARNING";
      body = "LOCKOUT IN 30 MINUTES. Open the app immediately!";
    }

    const snapshot = await db.collection("teachers")
      .where("status", "==", "active")
      .get();

    const messages = [];
    snapshot.forEach((teacherDoc) => {
      const data = teacherDoc.data() || {};
      const submittedToday = submittedOnDate(data, todayKolkata);
      if (data.deviceToken && !submittedToday && !data.isOnLeave) {
        messages.push({
          token: data.deviceToken,
          notification: { title, body },
          android: { priority: "high" },
        });
      }
    });

    if (messages.length > 0) {
      await admin.messaging().sendEach(messages);
      console.log(`Escalating reminders sent: ${messages.length}`);
    } else {
      console.log("No eligible teachers with device tokens.");
    }

    return null;
  });
