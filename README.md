# APKForge v2 — WebView APK Builder
## 100% Gratis, Tanpa Kartu Bank

Build APK Android nyata via **GitHub Actions** (Android SDK sudah tersedia gratis di runner GitHub).
Frontend deploy di **Vercel** (gratis, cukup akun GitHub).

---

## 🚀 Deploy dalam 5 menit (dari HP!)

### Step 1 — Upload ke GitHub
1. Buka **github.com** di HP
2. Buat repo baru (misal: `apkforge`)
3. Upload semua file project ini ke repo tersebut

### Step 2 — Buat Personal Access Token
1. GitHub → foto profil → **Settings**
2. Scroll ke bawah → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token (classic)**
5. Nama: `apkforge`, centang: **`repo`** + **`workflow`**
6. Copy tokennya (simpan, hanya muncul sekali!)

### Step 3 — Deploy ke Vercel
1. Buka **vercel.com** → Login dengan GitHub
2. **Add New Project** → Import repo `apkforge`
3. Klik **Environment Variables**, tambahkan:
   ```
   GH_TOKEN  = ghp_xxxxxxxxxxxx   (token tadi)
   GH_OWNER  = namauser_github_kamu
   GH_REPO   = apkforge
   ```
4. Klik **Deploy**
5. Selesai! Dapat URL seperti `apkforge.vercel.app`

---

## ✅ Cara Build APK

1. Buka URL Vercel kamu
2. Isi nama app, ikon (opsional), versi
3. Pilih sumber: **URL website** atau **upload ZIP**
4. Klik **BUILD APK**
5. Tunggu ~3-5 menit (GitHub Actions build di cloud)
6. Download APK (format ZIP, extract dulu untuk dapat .apk)

---

## 📊 Batas GitHub Actions (Free)
- **2,000 menit/bulan** untuk repo publik: **unlimited!**
- Repo privat: 2,000 menit/bulan (~400 build/bulan)
- Satu build ~3-5 menit

---

## 🛠 Tech Stack
- **Build Engine**: GitHub Actions (`ubuntu-latest` sudah ada Android SDK)
- **Backend API**: Vercel Serverless Functions (Node.js)
- **Frontend**: Vanilla HTML/CSS/JS

## 📁 Struktur File
```
apkforge/
├── .github/
│   └── workflows/
│       └── build-apk.yml    ← GitHub Actions workflow
├── api/
│   └── build.js             ← Vercel serverless function
├── public/
│   └── index.html           ← Frontend
├── vercel.json              ← Vercel config
├── package.json
└── README.md
```
