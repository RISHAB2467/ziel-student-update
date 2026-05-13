# App Engine Cost - Quick Reference

## Current Setup Status: ✅ Optimized

### Monthly Cost: $0.10 - $0.50
- Cloud Functions: **$0.003**
- Firestore: **$0.10 - $0.50**
- Hosting: FREE
- Messaging: FREE

✅ **Essentially Free Tier**

---

## Cloud Functions Settings

### `imidnightLockout` (Scheduled Daily)
- Schedule: 00:00 Asia/Kolkata (1x/day)
- Memory: 128MB ✅
- Timeout: 60s ✅
- Execution: ~5s per run
- Cost: $0.0006/month

### `escalatingNaggingReminders` (Scheduled 3x Daily)
- Schedule: 22:30, 23:00, 23:30 (3x/day)
- Memory: 128MB ✅
- Timeout: 30s ✅
- Execution: ~6s per run
- Cost: $0.002/month

---

## View Execution Costs

```bash
firebase functions:log
```

Expected output:
```
[COST TRACKING] Execution: 4.23s | Estimated Cost: $0.00001734
```

---

## What's Included (Free)

- Firebase Hosting: 10GB/month
- Firebase Messaging: Unlimited notifications
- Firebase Auth: 50K SMS/month
- Firestore: 1GB storage + 50K reads/month

---

## Set Up Billing Alert

1. GCP Console → Billing → Budgets
2. Budget: $5/month
3. Alert at: $4 (80%)

---

## Cost Comparison

| Platform | Monthly | Setup |
|----------|---------|-------|
| ✅ Your Setup | **$0.10-0.50** | Low |
| Shared Server | $5-10 | Medium |
| VPS | $2-5 | Medium |
| Dedicated Server | $50+ | High |

---

## Prevent Cost Spikes

❌ **Don't add HTTP-triggered functions**  
✅ **Use Firestore triggers if needed**

❌ **Don't increase memory unnecessarily**  
✅ **Keep at 128MB (optimal)**

❌ **Don't remove timeout limits**  
✅ **Keep 30-60 seconds**

❌ **Don't add new features without optimization**  
✅ **Batch writes, parallel reads**

---

## Next Steps

- [ ] Monitor logs monthly: `firebase functions:log`
- [ ] Check costs in GCP Console
- [ ] Set billing alert at $5/month
- [ ] Review performance trends quarterly

---

**Status**: ✅ Optimized  
**Cost**: ~$0.003/month (Functions)  
**Last Updated**: May 2026
