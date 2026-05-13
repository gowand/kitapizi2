# Kitapİzi

Nostaljik eski kitaplık tasarımlı kitap tanıtım, alıntı, yorum, rozet, ban ve kitap tahlil platformu.

## Kurulum

```bash
npm install
node server.js
```

Tarayıcıdan aç:

```text
http://localhost:3000
```

## Demo hesaplar

```text
Süper Admin:
admin@kitapizi.com
admin123

Moderatör:
moderator@kitapizi.com
admin123

Üye:
user@kitapizi.com
admin123
```

## Özellikler

- Kitap tanıtım sayfaları
- Alıntı paylaşımı
- Yorum sistemi
- Okudum / okuyorum / okuyacağım
- Profil ve rozet sistemi
- Kitap tahlil günleri
- Tarih ve saate kadar kapalı kalan tahlil odası
- Canlı masa sistemi
- Normal kontenjan, davetiye kontenjanı, ödül kontenjanı
- Süper adminin kontenjan artırması
- Süper adminin özel davetiye ve ödül erişimi vermesi
- Moderatör paneli
- Ban ve sessize alma sistemi
- Gece / gündüz modu
- Tahlil raporu yazdırma / PDF alma

## Not

Bu sürüm prototiptir. Gerçek zamanlı canlılık için ileride Socket.IO, gerçek veritabanı için PostgreSQL/Prisma eklenebilir.

## 2. Sürüm Güncellemesi

- Admin paneli girişi ayrıldı: `/admin/login`
- Normal üyeler `/login` üzerinden girer.
- Süper admin, moderatöre kitap tahliline kişi alma yetkisi verebilir.
- Süper admin, moderatöre aylık tahlil kabul kotası tanımlayabilir.
- Moderatörler sadece kendilerine tanımlanan kota kadar kullanıcıyı tahlile kabul edebilir.
- Üyeler belirli görevleri tamamlayınca tahlile doğrudan katılım hakkı kazanabilir:
  - Belirli sayıda kitap okuma
  - Belirli sayıda yorum yapma
  - Belirli sayıda alıntı paylaşma


## 3. Sürüm Güncellemesi

- Giriş/ana sayfaya ziyaret istatistiği eklendi.
- Toplam ziyaret ve bugünkü ziyaret sayacı eklendi.
- Kitap detay sayfası görüntülenme istatistiği eklendi.
- Tahlil sayfası görüntülenme istatistiği eklendi.
- Günün alıntısı artık sabit değil; her gün otomatik değişir.
- Admin panelinde okuyucu/sayfa istatistikleri görüntülenir.


## 4. Sürüm Güncellemesi

- Ana sayfadaki büyük söz artık admin panelinden değiştirilebilir.
- Ana sayfa alt açıklaması da admin panelinden değiştirilebilir.
- `Her kitap, başka bir hayatın kapısını aralar.` yazısının kesilme sorunu düzeltildi.


## 4. Sürüm Güncellemesi

- Ana sayfadaki büyük slogan artık admin panelinden değiştirilebilir.
- Ana sayfa açıklama yazısı admin panelinden değiştirilebilir.
- Sol menüdeki küçük slogan admin panelinden değiştirilebilir.
- Slogan yazısının kesilme sorunu düzeltildi.


## 5. Sürüm Güncellemesi

- Demo hesap şifreleri başlangıçta otomatik olarak `admin123` yapılır.
- Admin, moderatör ve üye demo girişleri garanti çalışır.
- Ana sayfadaki yanıp sönen imleç kaldırıldı.


## 6. Sürüm Güncellemesi

- Üyelerin eklediği kitap alıntıları artık doğrudan yayınlanmaz.
- Alıntılar önce bekleyen durumuna düşer.
- Moderatör veya süper admin onaylarsa alıntı sitede görünür.
- Reddedilen alıntılar yayına alınmaz.
- Basit yasaklı kelime kontrolü eklendi.
- Moderatör paneline Alıntı Onay Merkezi eklendi.


## 7. Sürüm Güncellemesi

- Gece/gündüz butonu ay ve güneş simgeli şık anahtara çevrildi.
- Tahlil oluştururken toplam tahlil süresi ayarlanabilir.
- Tahlil yönetiminde tarih, saat, masa süresi ve toplam süre sonradan değiştirilebilir.
- Tahlil süresi bittiğinde otomatik kapanma seçeneği eklendi.


## 8. Sürüm Güncellemesi

- Tema anahtarında ay ve güneşin konumu düzeltildi.
- Koyu mod tarafı ay, gündüz modu tarafı güneş olacak şekilde ayarlandı.


## 9. Sürüm Güncellemesi

- 10 binlerce üyeye geçiş için PostgreSQL + Prisma altyapısı eklendi.
- `prisma/schema.prisma` oluşturuldu.
- `docker-compose.yml` ile PostgreSQL ve Redis eklendi.
- `.env.example` eklendi.
- JSON verilerini veritabanına aktarmak için `scripts/seed-from-json.js` eklendi.
- Ayrıntılı üretim rehberi `README_PRODUCTION.md` dosyasına eklendi.

Not: Mevcut demo hâlâ `node server.js` ile JSON üzerinden çalışır. Tam üretim için bir sonraki adımda server tarafı Prisma sorgularına çevrilmelidir.


## 10. Sürüm Güncellemesi

- `server.js` Prisma/PostgreSQL'e çevrildi.
- JSON dosya okuma/yazma yerine Prisma sorguları kullanılmaya başlandı.
- Giriş/kayıt, kitaplar, yorumlar, alıntılar, tahliller, admin paneli, moderatör paneli ve istatistikler veritabanına bağlandı.
- Çalıştırma rehberi: `CALISTIRMA_PRISMA.md`
