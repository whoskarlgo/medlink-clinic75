[README.md](https://github.com/user-attachments/files/23027424/README.md)
# MedLink Clinic Website with Admin Dashboard

A complete healthcare clinic website with Firebase backend and admin dashboard for easy content management without programming knowledge.

## 📁 File Structure

```
medlink-clinic/
├── index.html                  # Main website (updated with Firebase)
├── admin.html                  # Admin dashboard
├── xstyle.css                 # Main website styles (keep your original)
├── admin-style.css            # Admin dashboard styles
├── script-updated.js          # Main website JavaScript (Firebase integrated)
├── admin-script.js            # Admin dashboard JavaScript
├── firebase-config.js         # Firebase configuration
├── MedLinkLogo.png           # Your logo image
├── doctorillustration.png    # Your doctor illustration
└── README.md                  # This file
```

## 🚀 Setup Instructions

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Enter project name (e.g., "medlink-clinic")
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Register Web App

1. In Firebase Console, click the **Web icon** (</>)
2. Register app name: "MedLink Clinic"
3. Click "Register app"
4. **Copy the firebaseConfig object** - you'll need this!

### Step 3: Enable Firebase Services

#### A. Enable Authentication
1. In Firebase Console, go to **Build → Authentication**
2. Click "Get started"
3. Go to **Sign-in method** tab
4. Click "Email/Password"
5. **Enable** the toggle
6. Click "Save"

#### B. Enable Realtime Database
1. Go to **Build → Realtime Database**
2. Click "Create Database"
3. Choose location (closest to you)
4. Start in **Test mode** initially
5. Click "Enable"

6. Go to **Rules** tab and paste:
```json
{
  "rules": {
    "appointments": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "doctors": {
      ".read": true,
      ".write": "auth != null"
    },
    "images": {
      ".read": true,
      ".write": "auth != null"
    },
    "content": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```
7. Click "Publish"

#### C. Enable Storage
1. Go to **Build → Storage**
2. Click "Get started"
3. Start in **Test mode**
4. Click "Next" and "Done"

5. Go to **Rules** tab and paste:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```
6. Click "Publish"

### Step 4: Configure Firebase in Your Code

1. Open `firebase-config.js`
2. Replace the configuration with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com"
};

export default firebaseConfig;
```

### Step 5: Create Admin User

1. In Firebase Console, go to **Authentication → Users**
2. Click "Add user"
3. Enter:
   - Email: `admin@medlinkclinic.com` (or your preferred email)
   - Password: Choose a strong password
4. Click "Add user"
5. **Save these credentials** - you'll use them to login!

### Step 6: Initialize Default Data (Optional)

In Firebase Console → Realtime Database, click the **+** icon next to your database name and add:

```json
{
  "doctors": {
    "dr-karl": {
      "name": "Dr. Karl Go",
      "specialty": "General Medicine"
    },
    "dr-haniven": {
      "name": "Dr. Haniven Alfonso",
      "specialty": "Pediatrics"
    },
    "dr-jared": {
      "name": "Dr. Jared Vergara",
      "specialty": "Internal Medicine"
    },
    "dr-francine": {
      "name": "Dr. Francine Abayan",
      "specialty": "Family Medicine"
    }
  }
}
```

### Step 7: Upload Files to Web Server

Upload all files to your web hosting:
- index.html (your main website)
- admin.html (admin dashboard)
- All CSS files
- All JavaScript files
- Image files

**Important:** Make sure `firebase-config.js` is using ES6 module export, so your server must support modern JavaScript.

### Step 8: Test Your Website

1. Open `index.html` in browser - main website should load
2. Navigate to `admin.html` - login page should appear
3. Login with admin credentials you created
4. Test uploading images and editing content

## 🎯 Using the Admin Dashboard

### Login
- URL: `yourwebsite.com/admin.html`
- Email: Your Firebase admin email
- Password: Your Firebase admin password

### Dashboard Features

#### 1. **Dashboard Overview**
- View total appointments
- See pending appointments
- Monitor doctors and images count
- View recent appointments

#### 2. **Appointments Management**
- View all appointments
- Confirm appointments (green checkmark)
- Cancel appointments (red X)
- View full appointment details (eye icon)

#### 3. **Manage Images**
- **Logo Image**: Upload clinic logo (appears in navbar)
- **Doctor Illustration**: Upload hero section image
- Supported formats: JPG, PNG, GIF, WebP
- Max size: 5MB per image

#### 4. **Edit Content**
- **Hero Section**: 
  - Edit main heading
  - Edit description text
- **Contact Information**:
  - Update address
  - Update phone number
  - Update email

#### 5. **Manage Doctors**
- Add new doctors
- View all doctors
- Remove doctors
- Each doctor needs:
  - Full name
  - Specialty
  - Unique ID (e.g., dr-john-doe)

## 📱 Main Website Features

### For Visitors:
- View services
- Book appointments
- See doctor information
- Contact information
- Responsive design (mobile-friendly)

### Dynamic Content:
- Logo updates automatically from admin
- Hero section text from admin
- Doctor list from admin
- Contact info from admin
- All images managed through admin

## 🔒 Security Notes

1. **Never share** your Firebase configuration publicly
2. **Use strong passwords** for admin accounts
3. **Regular backups** of Firebase data
4. Update Firebase rules for production:

```json
{
  "rules": {
    "appointments": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["date", "status"]
    },
    "doctors": {
      ".read": true,
      ".write": "auth != null"
    },
    "images": {
      ".read": true,
      ".write": "auth != null"
    },
    "content": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## 🐛 Troubleshooting

### Problem: "Firebase is not defined"
**Solution:** Make sure Firebase SDKs are loaded before your scripts in HTML:
```html
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-
