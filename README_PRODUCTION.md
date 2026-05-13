# Kitapİzi Üretim / 10 Bin Üye Altyapısı

Bu v9 paketi iki yapıyı birlikte içerir:

1. **Mevcut demo sistem:** `node server.js` ile JSON dosyadan çalışır.
2. **Üretim altyapısı:** PostgreSQL + Prisma şeması + Docker + JSON verilerini veritabanına aktarma scripti.

## Neden PostgreSQL?

JSON dosya sistemi 10 binlerce kullanıcı için uygun değildir. Çünkü her işlemde dosya okuma/yazma yapılır. Bu da aynı anda çok kullanıcı geldiğinde yavaşlama ve veri bozulması riski doğurur.

PostgreSQL ile:
- kullanıcılar,
- kitaplar,
- yorumlar,
- alıntılar,
- kitap tahlilleri,
- başvurular,
- davetiyeler,
- banlar,
- istatistikler

ayrı tablolarda tutulur.

## Yerel Kurulum

### 1. Paketleri kur

```bash
npm install
```

### 2. `.env.example` dosyasını kopyala

Windows CMD:

```bash
copy .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. PostgreSQL ve Redis'i Docker ile aç

Docker Desktop kuruluysa:

```bash
docker compose up -d
```

### 4. Prisma tablolarını oluştur

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Eski JSON verilerini PostgreSQL'e aktar

```bash
npm run db:seed-from-json
```

### 6. Veritabanını görsel yönetmek için

```bash
npm run prisma:studio
```

Tarayıcıda Prisma Studio açılır.

## Önemli Not

Bu paket üretim altyapısını hazırlar; mevcut `server.js` hâlâ JSON ile çalışır. Bir sonraki adımda `server.js` içindeki JSON okuma/yazma işlemleri Prisma sorgularına çevrilmelidir.

Bunu yaptığımızda site gerçek anlamda:
- 1.000 kullanıcıyı rahat,
- 5.000 kullanıcıyı iyi sunucuyla,
- 10.000+ kullanıcıyı optimizasyonla

taşıyabilecek yapıya geçer.

## Yayın İçin Önerilen Sunucu

Başlangıç:
- 2 vCPU
- 4 GB RAM
- PostgreSQL managed database
- Redis
- günlük yedekleme

10 bin+ aktif üye hedefinde:
- 4 vCPU
- 8 GB RAM
- ayrı PostgreSQL sunucusu
- Redis cache/session
- CDN
- görseller için S3/R2 benzeri depolama

## Sonraki Geliştirme Adımı

Bir sonraki sürümde yapılacak iş:

`server.js` → `server-prisma.js`

Yani tüm şu işlemler Prisma'ya taşınacak:

- giriş/kayıt
- kitap listeleme
- yorum ekleme
- alıntı onayı
- moderatör paneli
- tahlil oluşturma
- tahlil başvuruları
- istatistikler
