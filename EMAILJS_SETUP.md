# EmailJS Setup Instructions for Admin OTP

## 🔧 Configuration Required

To enable the Admin OTP feature, you need to configure EmailJS with your account credentials.

### Step 1: Create EmailJS Account
1. Go to https://www.emailjs.com/
2. Sign up for a free account (allows 200 emails/month)
3. Verify your email address

### Step 2: Create Email Service
1. In EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail recommended):
   - **Gmail**: Connect your Google account
   - **Outlook**: Use your Microsoft account
   - Or use any other SMTP service
4. Note down your **Service ID** (e.g., `service_abc123`)

### Step 3: Create Email Template
1. Go to **Email Templates**
2. Click **Create New Template**
3. Use this template structure:

**Template Name:** Admin OTP Login

**Subject:** Your ZIEL Admin Login OTP

**Content:**
```
Hello Admin,

Your One-Time Password (OTP) for ZIEL Classes Admin Login is:

{{otp_code}}

This OTP is valid for 5 minutes.

Login Time: {{timestamp}}

If you didn't request this OTP, please ignore this email.

Best regards,
ZIEL Classes Team
```

4. Note down your **Template ID** (e.g., `template_xyz456`)

### Step 4: Get Public Key
1. Go to **Account** → **General**
2. Find your **Public Key** (e.g., `abcXYZ123_publicKey`)

### Step 5: Update Code

Open `app-firestore.js` and replace these placeholders:

```javascript
// Line ~31
emailjs.init('YOUR_PUBLIC_KEY'); // Replace with your actual public key

// Line ~42-43
await emailjs.send(
    'YOUR_SERVICE_ID',  // Replace with your service ID
    'YOUR_TEMPLATE_ID', // Replace with your template ID
    templateParams
);

// Line ~38
to_email: 'admin@zielclasses.com', // Replace with actual admin email
```

**Example after replacement:**
```javascript
emailjs.init('abcXYZ123_publicKey');

await emailjs.send(
    'service_abc123',
    'template_xyz456',
    templateParams
);

to_email: 'your-actual-admin@gmail.com',
```

### Step 6: Test the Setup
1. Open your website login page
2. Select **Admin** role
3. Enter password: `admin123`
4. Click **Login as Admin**
5. Check your admin email for the OTP
6. Enter the 6-digit OTP
7. You should be logged in successfully

## 📧 Email Template Variables

The following variables are sent to your email template:

- `{{to_email}}` - Admin email address
- `{{otp_code}}` - 6-digit OTP
- `{{timestamp}}` - Current date and time

## 🔒 Security Features

- ✅ **6-digit OTP** - Random secure code
- ✅ **5-minute expiry** - OTP expires after 5 minutes
- ✅ **Single use** - OTP invalidated after successful login
- ✅ **Password + OTP** - Two-factor verification
- ✅ **Email delivery** - Sent via secure EmailJS service

## 🚨 Troubleshooting

### OTP Email Not Received
- Check spam/junk folder
- Verify email address in code matches your admin email
- Check EmailJS dashboard for failed emails
- Ensure EmailJS service is active

### "EmailJS not loaded" Error
- Check if EmailJS script is loaded in `index.html`
- Open browser console and type `emailjs` - should show object

### Invalid Service/Template ID
- Double-check IDs in EmailJS dashboard
- Ensure no extra spaces in IDs
- IDs are case-sensitive

### Free Tier Limit Reached
- EmailJS free plan: 200 emails/month
- Upgrade plan if needed or wait for monthly reset

## 💡 Recommended Email Template (Prettier Version)

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
        .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .otp-code { font-size: 32px; font-weight: bold; color: #90EE90; text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; letter-spacing: 5px; margin: 20px 0; }
        .footer { margin-top: 20px; font-size: 12px; color: #888; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="color: #2c3e50; text-align: center;">🎓 ZIEL Classes</h2>
        <h3 style="color: #34495e;">Admin Login Verification</h3>
        <p>Your One-Time Password (OTP) for admin login is:</p>
        <div class="otp-code">{{otp_code}}</div>
        <p><strong>⏱️ Valid for 5 minutes</strong></p>
        <p>Login attempt at: {{timestamp}}</p>
        <p>If you didn't request this OTP, please ignore this email.</p>
        <div class="footer">
            <p>© 2025 ZIEL Classes - Let's Learn</p>
            <p>Kasba • Jadavpur • Nayabad • Chinar Park</p>
        </div>
    </div>
</body>
</html>
```

## ✅ Next Steps

After completing this setup:
1. Change admin password from `admin123` to something more secure
2. Test OTP flow thoroughly
3. Monitor EmailJS usage in dashboard
4. Consider upgrading EmailJS plan if needed

---

**Need Help?** Check EmailJS documentation: https://www.emailjs.com/docs/
