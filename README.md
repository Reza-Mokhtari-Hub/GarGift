# فروشگاه آنلاین گرگیفت+ (GarGift+)

فروشگاه تخصصی محصولات دیجیتال شامل **گیفت‌کارت‌ها** (Google Play, Apple, Steam, PlayStation, Xbox, Spotify, Netflix, Amazon, Roblox)، **اشتراک‌های هوش مصنوعی** (ChatGPT Plus, Claude Pro, Gemini Advanced, Cursor Pro, Midjourney, Perplexity, GitHub Copilot) و **شارژ درون‌برنامه‌ای بازی‌ها** (PUBG Mobile UC, Call of Duty CP, Free Fire Diamonds, Valorant Points, Genshin Impact, Fortnite).

---

## ویژگی‌های کلیدی معماری

1. **مستقل از سرویس‌های ابری خارجی**: اجرا روی هر سرور لینوکسی یا VPS با Node.js 22 و پایگاه داده **SQLite (حالت WAL)** بدون نیاز به Firebase یا سرویس‌های تحریمی.
2. **امنیت کامل مالی و کدها**:
   - رمزنگاری تمامی کدهای گیفت‌کارت در دیتابیس با الگوریتم **AES-256-GCM** (`CODES_ENCRYPTION_KEY`).
   - ماسک شدن کدها در پنل مدیریت (`****-****-XXXX`) و ثبت لاگ امنیتی (`audit_logs`) هنگام مشاهده کد کامل.
   - هش شدن رمز عبور با الگوریتم استاندارد `scrypt` به همراه Salt تصادفی و قفل موقت پس از تلاش‌های ناموفق.
   - نشست کاربری با توکن **JWT داخل کوکی `httpOnly`**.
   - تخصیص کد، کسر موجودی کیف پول و ثبت کوپن داخل **تراکنش اتمیک دیتابیس (`BEGIN IMMEDIATE ... COMMIT`)** همراه با کلید `idempotencyKey`.
3. **قیمت‌گذاری پویا (Dynamic Pricing)**:
   - محاسبه خودکار قیمت تومانی بر اساس قیمت دلاری واریانت، نرخ دلار سراسری/دسته/محصول، درصد سود و گرد کردن به مضرب ۱۰۰۰ تومان.
4. **پنل مدیریت ۱۷ ماژوله (`/admin`)**:
   - مدیریت کامل سفارش‌ها، محصولات، انبار کد، دسته‌ها، مشتریان، کیف پول، درگاه‌ها، نرخ دلار، کوپن‌ها، نظرات، تیکت‌ها، محتوا، تم، تنظیمات، نقش‌ها و پشتیبان‌گیری.

---

## راهنمای راه‌اندازی سریع (توسعه و تست)

```bash
# ۱. نصب وابستگی‌ها
npm install

# ۲. کپی فایل متغیرهای محیطی
cp .env.example .env

# ۳. اجرای سرور توسعه (همراه با ساخت خودکار دیتابیس و داده‌های نمونه)
npm run dev

# ۴. اجرای تست‌های واحد منطق قیمت‌گذاری و رمزنگاری
npx --yes tsx --test src/utils/format.test.ts
```

---

## راهنمای استقرار روی سرور مجازی (VPS Ubuntu + PM2 + Nginx + SSL)

### ۱. پیش‌نیازها روی سرور اوبونتو
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

### ۲. ساخت و اجرای پروژه با PM2
```bash
git clone <REPO_URL> /var/www/gargift
cd /var/www/gargift
npm ci
cp .env.example .env
# مقادیر JWT_SECRET، CODES_ENCRYPTION_KEY و ADMIN_INITIAL_PASSWORD را در فایل .env ویرایش کنید
npm run build

pm2 start npm --name "gargift-plus" -- start
pm2 save
pm2 startup
```

### ۳. تنظیم Nginx و گواهی SSL رایگان (Let's Encrypt)
فایل `/etc/nginx/sites-available/gargift` را بسازید:
```nginx
server {
    listen 80;
    server_name gargift.ir www.gargift.ir;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
سپس فعال‌سازی SSL:
```bash
sudo ln -s /etc/nginx/sites-available/gargift /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gargift.ir -d www.gargift.ir
```

---

## پشتیبان‌گیری (Backup) و بازیابی دیتابیس

- سیستم به صورت خودکار هر شب ساعت `03:00` بامداد یک کپی از فایل `data/gargift.sqlite` در پوشه `data/backups/` ذخیره کرده و ۷ نسخه آخر را نگه می‌دارد.
- همچنین از مسیر **پنل مدیریت -> ۱۷. گزارش‌ها و پشتیبان‌گیری** می‌توانید در هر لحظه نسخه پشتیبان فوری بسازید.
