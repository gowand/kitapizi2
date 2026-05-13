# Kitapİzi v10 - Prisma/PostgreSQL Çalıştırma

Bu sürümde `server.js` artık JSON dosyadan değil, PostgreSQL veritabanından çalışır.

## 1. ZIP'i çıkar

Klasörü masaüstüne çıkar.

## 2. Paketleri kur

```bash
npm install
```

## 3. `.env` oluştur

Windows CMD:

```bash
copy .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

## 4. PostgreSQL'i aç

Docker Desktop varsa:

```bash
docker compose up -d
```

Bu komut PostgreSQL ve Redis'i açar.

## 5. Veritabanı tablolarını oluştur

```bash
npx prisma generate
npx prisma migrate dev --name init
```

## 6. Eski demo verilerini veritabanına aktar

```bash
npm run db:seed-from-json
```

## 7. Siteyi çalıştır

```bash
node server.js
```

Tarayıcı:

```text
http://localhost:3000
```

## Girişler

Admin:

```text
http://localhost:3000/admin/login
admin@kitapizi.com
admin123
```

Moderatör:

```text
http://localhost:3000/admin/login
moderator@kitapizi.com
admin123
```

Üye:

```text
http://localhost:3000/login
user@kitapizi.com
admin123
```

## Prisma Studio

Veritabanını görsel görmek için:

```bash
npx prisma studio
```

## Not

Bu sürüm 10 binlerce üyeye giden doğru mimariye geçmiştir. Yine de gerçek yayında ayrıca:
- güçlü sunucu,
- managed PostgreSQL,
- Redis session,
- dosya upload depolama,
- yedekleme,
- güvenlik ayarları

gerekir.
