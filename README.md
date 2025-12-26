
# 📦 Local Share (Appwrite Cloud)
Temporary, fast, privacy-friendly file sharing — **no login, no history, auto-delete after 1 minute.**

<p align="center">
  <!-- Platform -->
  <a href="https://vercel.com/">
    <img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel">
  </a>
  <a href="https://appwrite.io/">
    <img src="https://img.shields.io/badge/Backend-Appwrite-F02E65?style=for-the-badge&logo=appwrite&logoColor=white">
  </a>

  <!-- Code Review -->
  <a href="https://github.com/Abel-Ajish/filesend/pulls">
    <img src="https://img.shields.io/coderabbit/prs/github/Abel-Ajish/filesend?style=for-the-badge" alt="CodeRabbit Reviews">
  </a>

  <!-- Activity -->
  <a href="https://github.com/Abel-Ajish/filesend/commits/main">
    <img src="https://img.shields.io/github/last-commit/Abel-Ajish/filesend?style=for-the-badge" alt="Last Commit">
  </a>
  <a href="https://github.com/Abel-Ajish/filesend">
    <img src="https://img.shields.io/github/commit-activity/m/Abel-Ajish/filesend?style=for-the-badge" alt="Commit Activity">
  </a>

  <!-- Repo Info -->
  <a href="https://github.com/Abel-Ajish/filesend">
    <img src="https://img.shields.io/github/repo-size/Abel-Ajish/filesend?style=for-the-badge" alt="Repo Size">
  </a>
  <a href="https://github.com/Abel-Ajish/filesend">
    <img src="https://img.shields.io/github/languages/top/Abel-Ajish/filesend?style=for-the-badge" alt="Top Language">
  </a>

  <!-- License -->
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge">
  </a>
</p>




---

# 🌐 Overview
**Local Share** is a minimal send/receive file-sharing web app built on **Next.js** with **Appwrite Cloud** as storage.  
Just upload → get a 6-character share code → recipient downloads → file auto-deletes after **60 seconds**.

- ⚡ Fast temporary sharing  
- 🔒 Auto-delete (60 sec lifecycle)  
- 🧪 P2P local transfers supported  
- 📱 QR code sending/receiving  
- 🎨 Material-You inspired UI  
- 🎯 No user accounts required  
- 🌑 Theme persistence  

---

# ✨ Features
### 🚀 Instant Upload + Share Code
Clean 6-character codes (excluding confusing characters like `0` and `o`).

### ⏳ Auto-Deletion (1 Minute)
Background deletion timer removes files after 60 seconds.

### 🔄 P2P + Server Fallback
Local peer-to-peer transfers using WebRTC; uploads to Appwrite if fallback is needed.

### 📱 QR Code Mode
Share instantly across devices on the same network.

### 🎨 Modern Material-You UI
Animations, smooth interactions, and theme saving.

---

# 🛠️ Tech Stack
- Next.js 14+ (App Router)  
- React  
- TypeScript  
- Appwrite Cloud Storage  
- Vercel  
- WebRTC for P2P  

---

# 📥 Installation & Setup

## Prerequisites
- Node.js **18+**  
- Appwrite Cloud account (free)

## Local Development
```bash
npm install
cp .env.example .env.local
# fill in Appwrite credentials
npm run dev
```

---

# 🔧 Setting up Appwrite Cloud
1. Create account: https://cloud.appwrite.io  
2. Create project (e.g., "Local Share")  
3. Create bucket:
   - Storage → Create Bucket  
   - Name: **Shared Files**  
   - Bucket ID: `files`
4. Create API key:
   - Scopes: `files.read`, `files.write`  
   - Copy the key once shown
5. Configure environment:

```env
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_BUCKET_ID=files
```

---

# 🚀 Deploy to Vercel
```bash
vercel init
vercel --prod
```

Add environment variables to:
- Production  
- Preview  
- Development  

---

# 🧩 Architecture
### **Frontend (Next.js)**
- Single-page workflow  
- Material-You UI components  
- App Router (`app/page.tsx`)

### **Backend (Appwrite)**
- Public temporary storage  
- File uploads/downloads  
- API routes:
  - `POST /api/files`  
  - `DELETE /api/files/[filename]`  
  - `GET /api/code/[code]`

### **Lifecycle**
1. File uploaded  
2. Public URL returned  
3. 6-character code generated  
4. 60s deletion timer scheduled  
5. File expires automatically  

---

# 💸 Free Tier — Appwrite Cloud
- **2 GB storage**  
- **5 GB bandwidth/month**  
- **No credit card needed**  

---

# 🔐 Security
- No authentication  
- All files are public  
- For trusted use only  

---

# 📝 Change Log
## **v1.2.0**
- Added file transfer animations  
- Fixed remove file button visibility  
- Resolved `npm run dev` errors  

## **v1.1.0**
- Added P2P file transfer  
- TURN server research  
- Local hosting fixes  

## **v1.0.0**
- Theme persistence  
- Improved code generation  
- QR code UI redesign  
- Build fixes  
- Responsiveness improvements  

---

# 📄 License
MIT License.
