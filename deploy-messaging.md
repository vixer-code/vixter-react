# Deployment Guide for Enhanced Messaging System

This guide will help you deploy all the Firebase backend components needed for the messaging system.

## 🚀 Prerequisites

1. **Firebase CLI** installed and authenticated
```bash
npm install -g firebase-tools
firebase login
```

2. **Make sure you're in the correct directory**
```bash
cd vixter-react
```

3. **Verify your Firebase project**
```bash
firebase projects:list
firebase use vixter-451b3  # or your project ID
```

## 📋 Deployment Steps

### Step 1: Deploy Firestore Rules & Indexes
```bash
# Deploy Firestore security rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes (if needed)
firebase deploy --only firestore:indexes
```

### Step 2: Deploy Realtime Database Rules
```bash
# Deploy Realtime Database security rules
firebase deploy --only database
```

### Step 3: Deploy Storage Rules
```bash
# Deploy Storage security rules
firebase deploy --only storage
```

### Step 4: Deploy Cloud Functions
```bash
# Install function dependencies (if not already done)
cd functions
npm install
cd ..

# Deploy all functions
firebase deploy --only functions
```

### Step 5: Deploy All at Once (Alternative)
```bash
# Deploy everything together
firebase deploy
```

## 🔧 Individual Component Deployment

If you need to deploy specific components only:

### Firestore Rules Only
```bash
firebase deploy --only firestore:rules
```

### Specific Functions Only
```bash
# Deploy only messaging-related functions
firebase deploy --only functions:createServiceOrder,functions:acceptServiceOrder,functions:declineServiceOrder,functions:markServiceDelivered,functions:confirmServiceDelivery,functions:autoReleaseServicePayments,functions:createConversation
```

### Storage Rules Only
```bash
firebase deploy --only storage
```

### Realtime Database Rules Only
```bash
firebase deploy --only database
```

## 🧪 Testing the Deployment

### 1. Test Firestore Rules
```bash
# Check if rules are working
firebase firestore:rules:release
```

### 2. Test Functions
```bash
# Check function logs
firebase functions:log

# Test a specific function
firebase functions:shell
```

### 3. Test Realtime Database
- Go to Firebase Console → Realtime Database
- Try creating a test conversation
- Verify permissions work correctly

### 4. Test Storage Rules
- Go to Firebase Console → Storage
- Try uploading a test file to `/messages/image/test-conversation/test.jpg`
- Verify permissions work correctly

## 🚨 Common Issues & Solutions

### Issue: "Permission denied" during deployment
**Solution:**
```bash
# Re-authenticate with Firebase
firebase login --reauth

# Make sure you have the correct permissions for the project
firebase projects:list
```

### Issue: Function deployment fails
**Solution:**
```bash
# Check for syntax errors
cd functions
npm run lint

# Check function logs
firebase functions:log --limit 10
```

### Issue: Rules deployment fails
**Solution:**
```bash
# Validate Firestore rules
firebase firestore:rules:validate

# Check for syntax errors in database.rules.json
```

### Issue: Storage rules fail
**Solution:**
- Verify the storage.rules file syntax
- Check if the bucket exists
- Ensure you have Storage Admin permissions

## 📱 Enable Required APIs

Make sure these APIs are enabled in your Google Cloud Console:

1. **Cloud Functions API**
2. **Cloud Firestore API**
3. **Firebase Realtime Database API**
4. **Cloud Storage API**
5. **Identity and Access Management (IAM) API**

```bash
# Enable APIs via gcloud CLI (optional)
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable storage.googleapis.com
```

## 🔐 Security Configuration

### Admin UIDs (Important!)
Update the admin UIDs in both `firestore.rules` and `storage.rules`:

1. Open `firestore.rules`
2. Find line: `return request.auth.uid in ['admin_uid_1', 'admin_uid_2'];`
3. Replace with your actual admin user IDs

### Stripe Secrets
Ensure your Stripe secrets are configured:

```bash
# Set Stripe secrets (if not already done)
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

## 📊 Monitoring & Logs

### View Function Logs
```bash
# Real-time logs
firebase functions:log --follow

# Specific function logs
firebase functions:log --only createServiceOrder

# Error logs only
firebase functions:log --filter "ERROR"
```

### Monitor Database Activity
- Firebase Console → Realtime Database → Usage tab
- Monitor read/write operations
- Check for any unusual activity

### Monitor Storage Usage
- Firebase Console → Storage → Usage tab
- Monitor file uploads and bandwidth
- Check for any large files or unusual activity

## ✅ Post-Deployment Checklist

- [ ] Firestore rules deployed successfully
- [ ] Realtime Database rules deployed successfully  
- [ ] Storage rules deployed successfully
- [ ] All Cloud Functions deployed successfully
- [ ] Admin UIDs updated in security rules
- [ ] Stripe secrets configured
- [ ] APIs enabled in Google Cloud Console
- [ ] Test messaging functionality in the app
- [ ] Test service order workflow
- [ ] Test media uploads
- [ ] Monitor function logs for errors

## 🎯 Next Steps

After successful deployment:

1. **Test the messaging system** in your React app
2. **Create test service orders** to verify the workflow
3. **Upload test media files** to verify storage rules
4. **Monitor performance** and adjust function memory/timeout if needed
5. **Set up monitoring alerts** for function errors
6. **Consider setting up CI/CD** for future deployments

## 📞 Support

If you encounter issues during deployment:

1. Check the [Firebase documentation](https://firebase.google.com/docs)
2. Review function logs: `firebase functions:log`
3. Check Firebase Console for detailed error messages
4. Verify all prerequisites are met
5. Ensure you have the necessary permissions for the Firebase project

Your enhanced messaging system should now be fully deployed and ready to use! 🚀
