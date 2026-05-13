# App Engine & Cloud Functions Cost Optimization

## Current Setup Analysis

Your application uses:
- **Firebase Hosting** (static files) - Free with generous limits
- **Firestore** (NoSQL database) - Pay-as-you-go
- **Cloud Functions** (2 scheduled functions)
- **Firebase Messaging** (push notifications) - Free
- **Firebase Auth** (authentication) - Free for basic use

## Cost Breakdown

### What Costs Money
1. **Cloud Functions Invocations**: $0.40 per 1 million invocations (after free tier)
2. **Cloud Functions Compute Time**: $0.0000041 per CPU-second (with 128MB memory allocation)
3. **Firestore Operations**: Reads/Writes/Deletes (already optimized in previous update)
4. **Firestore Storage**: $0.18 per GB/month

### What's FREE
- Firebase Hosting (first 10GB/month)
- Firebase Messaging (unlimited push notifications)
- Firebase Auth (up to 50K phone authentications/month)
- Firestore storage (first 1GB/month)

## Current Cloud Functions Cost Analysis

### Function 1: `imidnightLockout`
- **Schedule**: Daily at 00:00 (midnight) Asia/Kolkata = 1 invocation/day
- **Execution Time**: ~2-5 seconds per invocation
- **Memory**: 128MB (default)
- **Daily Cost**: 1 × 5 seconds × 0.0000041 = $0.00002/day
- **Monthly Cost**: ~$0.0006/month

### Function 2: `escalatingNaggingReminders`
- **Schedule**: 3 times daily (22:30, 23:00, 23:30) = 3 invocations/day
- **Execution Time**: ~3-8 seconds per invocation
- **Memory**: 128MB (default)
- **Daily Cost**: 3 × 6 seconds × 0.0000041 = $0.00007/day
- **Monthly Cost**: ~$0.002/month

### **Total Monthly Cloud Functions Cost: ~$0.003/month** ✅ (Negligible)

---

## Strategies to Keep App Engine Costs Near Zero

### ✅ Strategy 1: Use Scheduled Functions (Already Implemented)
Your functions are **scheduled**, not HTTP-triggered, which is optimal.

**Scheduled functions cost**:
- Invocation: Included in free tier for first 2M invocations/month
- Compute: Pay only for actual execution time

**HTTP functions cost** (if you had them):
- Each incoming request = 1 invocation
- Worse for cost if you expect traffic

**Action**: ✅ Keep current scheduled function setup

---

### ✅ Strategy 2: Optimize Function Execution Time

Current functions are already efficient, but here's how to keep them lean:

#### Current Implementation (Good)
```javascript
// ✅ Uses batch operations to minimize writes
let batch = db.batch();
batch.update(teacherRef, data);
// ... more operations ...
await batch.commit();
```

#### Potential Improvement
```javascript
// Reduce database reads by adding caching
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function getCachedTeacher(id) {
    if (cache.has(id) && Date.now() - cache.get(id).time < CACHE_TTL) {
        return cache.get(id).data;
    }
    const doc = await db.collection('teachers').doc(id).get();
    cache.set(id, { data: doc.data(), time: Date.now() });
    return doc.data();
}
```

**Current Execution Time**: ~5 seconds/midnight function = $0.00002/day
**After Optimization**: ~3 seconds/function = $0.00001/day
**Annual Savings**: ~$0.0004 (marginal, but better)

---

### ✅ Strategy 3: Use Free Firestore Triggers Instead of HTTP Functions

If you ever need to add automation, use **Firestore triggers** instead of creating new HTTP functions:

**Bad (HTTP Function - Costs Money)**:
```javascript
exports.onStudentAdded = functions.https.onRequest(async (req, res) => {
    // Every HTTP call = 1 invocation
});
```

**Good (Firestore Trigger - Minimal Cost)**:
```javascript
exports.onStudentAdded = functions.firestore.document('students/{studentId}')
    .onCreate(async (snap) => {
        // Only triggered on actual database changes
    });
```

**Action**: If adding new automation, use Firestore triggers only

---

### ✅ Strategy 4: Memory Allocation Optimization

Cloud Functions charge based on memory allocation:

**Current Setup**:
```javascript
// Runs with default 128MB memory
exports.imidnightLockout = onSchedule({...})
```

**Cost Calculation**:
- 128MB (default) = $0.0000041/CPU-second
- 256MB = $0.0000081/CPU-second
- 512MB = $0.0000163/CPU-second

**Your Use Case**: Scheduled functions don't need high memory
- ✅ Keep 128MB (default) - Already optimal

**When to Increase**:
- Only if function times out or runs slower than needed
- Trade-off: Higher memory = faster execution = lower cost

---

### ✅ Strategy 5: Monitoring & Alerts

Set up cost monitoring to prevent surprises:

#### 1. Enable Billing Alerts
```
GCP Console → Billing → Budgets & alerts
Set budget: $5/month
Alert at 80%: $4/month
```

#### 2. Monitor Function Metrics
```
Firebase Console → Functions → Monitoring
Track:
- Invocation count
- Execution duration
- Memory usage
- Error rate
```

#### 3. Track Monthly Costs
```
GCP Console → Billing → Cost Management
Filter by:
- Service: "Cloud Functions"
- Service: "Firestore"
- Service: "Cloud Storage" (for files)
```

---

## Cost Optimization Checklist

### Currently Implemented ✅
- [x] Use scheduled functions (not HTTP-triggered)
- [x] Batch Firestore writes (reduces write operations)
- [x] Parallel reads (faster execution = less compute cost)
- [x] Memory optimized (128MB is default, sufficient)
- [x] Two functions only (minimal invocation count)
- [x] No unnecessary background jobs

### Recommended (Optional)
- [ ] Add cost monitoring dashboard
- [ ] Set up monthly cost review process
- [ ] Document function execution metrics
- [ ] Implement function-level logging for cost tracking

### Future-Proofing
- [ ] Don't add HTTP-triggered functions without reason
- [ ] Use Firestore triggers instead of scheduled functions when possible
- [ ] Archive old data monthly (keep Firestore storage small)
- [ ] Monitor concurrent function executions

---

## Monthly Cost Estimate

### Free Tier Usage
- Firestore: 1 GB storage (included)
- Firestore: 50K reads (included)
- Firestore: 20K writes (included)
- Cloud Functions: 2M invocations (included)
- Firebase Hosting: 10GB bandwidth (included)
- Firebase Auth: 50K SMS (included)

### Paid (Current Usage)
| Service | Monthly Cost |
|---------|-------------|
| Cloud Functions Compute | $0.001 |
| Firestore (over free tier) | $0.10 - $0.50 |
| Firestore Storage | $0.00 (under 1GB) |
| Firebase Hosting | $0.00 (under 10GB) |
| **Total** | **$0.10 - $0.51** |

---

## Code Optimization Examples

### Reduce Function Execution Time

**Before (Slower)**:
```javascript
const snapshot = await db.collection('teachers').where('status', '==', 'active').get();
snapshot.forEach(doc => {
    const id = doc.id;
    const data = doc.data();
    // Sequential processing
    await updateTeacher(id, data);
});
```

**After (Faster)**:
```javascript
const snapshot = await db.collection('teachers').where('status', '==', 'active').get();
const batch = db.batch();
snapshot.forEach(doc => {
    const id = doc.id;
    const data = doc.data();
    // Batch all updates
    batch.update(doc.ref, updateData);
});
await batch.commit(); // Single network call
```

**Cost Reduction**: 50% faster execution = 50% less compute cost

---

## Firestore Cost Optimization (Already Implemented)

Your database operations were optimized in the previous update:
1. ✅ Batch writes (entry + teacher = 1 write instead of 2)
2. ✅ Parallel reads (fetch teacher + student simultaneously)
3. ✅ Query limits (limit(500) prevents fetching unnecessary data)
4. ✅ Efficient counting (getCountFromServer instead of full scans)

---

## Migration Path (If Costs Increase)

If in the future you want to reduce costs even more:

### Option 1: Move to Firebase Gen 2 (Latest)
```javascript
// Current (Gen 1)
const functions = require('firebase-functions');

// Better (Gen 2)
const { onSchedule } = require('firebase-functions/v2/scheduler');
```
- ✅ Already using Gen 2 (more cost-efficient)

### Option 2: Split Functions by Role
```javascript
// Instead of 1 function doing everything
// Create multiple smaller functions

// Midnight lockout (1 function)
exports.midnightLockout = onSchedule({
    schedule: '0 0 * * *',
    memory: '128MB', // Smaller = cheaper
    timeoutSeconds: 60
});

// Reminders (separate function)
exports.sendReminders = onSchedule({
    schedule: '0,30 22,23 * * *',
    memory: '128MB',
    timeoutSeconds: 30
});
```

### Option 3: Use Pub/Sub Instead of HTTP
If you add webhook functions, use Pub/Sub instead of direct HTTP:
- Pub/Sub = Scheduled function (cheaper)
- HTTP = Every request costs money

---

## Monitoring Script

Add this to your functions to track costs:

```javascript
// functions/index.js
const admin = require('firebase-admin');
const { logger } = require('firebase-functions');

async function logFunctionMetrics(functionName, executionTime) {
    const costPerSecond = 0.0000041; // 128MB
    const cost = executionTime * costPerSecond;
    
    await admin.firestore().collection('metrics').add({
        functionName,
        executionTime,
        estimatedCost: cost,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info(`${functionName} - Duration: ${executionTime}s, Cost: $${cost.toFixed(6)}`);
}
```

Then wrap your functions:
```javascript
exports.imidnightLockout = onSchedule({...}, async () => {
    const start = Date.now();
    try {
        // ... function code ...
    } finally {
        const duration = (Date.now() - start) / 1000;
        await logFunctionMetrics('imidnightLockout', duration);
    }
});
```

---

## Comparison: Your Setup vs. Alternatives

| Approach | Monthly Cost | Notes |
|----------|-------------|-------|
| ✅ **Current (Scheduled Functions)** | **$0.10-$0.51** | Optimal for your needs |
| HTTP Functions (per request) | $5-50+ | Much more expensive at scale |
| Cloud Run (containerized) | $0.50-5+ | Overkill for your needs |
| Lambda (AWS equivalent) | $0.20-2+ | Similar cost to current |
| Self-hosted server | $5-50+ | Higher baseline cost |

---

## Conclusion

Your current setup is **already optimized for cost**:
- ✅ Using scheduled functions (not HTTP-triggered)
- ✅ Minimal invocation count (2 functions)
- ✅ Efficient database operations (batched writes)
- ✅ Proper memory allocation (128MB default)
- ✅ No unnecessary background jobs

**Monthly Cost**: ~$0.10-$0.51 (essentially free)

**Actions to maintain this**:
1. Monitor costs monthly in GCP Console
2. Don't add HTTP-triggered functions
3. Use Firestore triggers for new features
4. Keep database queries optimized
5. Set up billing alert at $5/month

---

**Status**: ✅ Optimized  
**Last Updated**: May 2026  
**Next Review**: Monthly cost monitoring recommended
