require("dotenv").config();

const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcryptjs");
const path = require("path");
const { v4: uuid } = require("uuid");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "kitapizi-prisma-secret-change-me",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function nowISO() {
  return new Date().toISOString();
}
function dateFromAnalysis(a) {
  return new Date(`${a.date}T${a.time}:00`);
}
function analysisState(analysis) {
  const start = dateFromAnalysis(analysis);
  const totalMinutes = analysis.totalDuration || ((analysis.tables?.length || 1) * (analysis.durationPerTable || 5));
  const end = new Date(start.getTime() + totalMinutes * 60 * 1000);
  const now = new Date();
  if (now < start) return "WAITING";
  if (now > end) return "FINISHED";
  return "LIVE";
}
function activeTableIndex(analysis) {
  const start = dateFromAnalysis(analysis);
  const diffMin = Math.floor((Date.now() - start.getTime()) / 60000);
  const tableMinutes = analysis.durationPerTable || Math.max(1, Math.floor((analysis.totalDuration || 5) / Math.max(1, analysis.tables?.length || 1)));
  return Math.min((analysis.tables?.length || 1) - 1, Math.max(0, Math.floor(diffMin / tableMinutes)));
}
function isMuted(user) {
  return user?.mutedUntil && new Date(user.mutedUntil).getTime() > Date.now();
}
function isBanned(user) {
  return user?.status === "BANNED" || !!user?.banReason;
}
function canManage(user) {
  return user && ["SUPER_ADMIN", "MODERATOR"].includes(user.role);
}
function canModeratorApprove(user) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return user.role === "MODERATOR" &&
    user.moderatorCanApprove &&
    (user.moderatorUsedQuota || 0) < (user.moderatorMonthlyQuota || 0);
}
function userTaskProgress(user) {
  const commentsTarget = user?.taskCommentsTarget ?? 10;
  const quotesTarget = user?.taskQuotesTarget ?? 5;
  const readsTarget = user?.taskReadsTarget ?? 3;
  const commentsOk = (user?.commentCount || 0) >= commentsTarget;
  const quotesOk = (user?.quoteCount || 0) >= quotesTarget;
  const readsOk = (user?.readCount || 0) >= readsTarget;
  return { commentsOk, quotesOk, readsOk, completed: commentsOk && quotesOk && readsOk, commentsTarget, quotesTarget, readsTarget };
}
function canUserSelfJoinAnalysis(analysis, user) {
  if (!user) return false;
  if (approvedForAnalysis(analysis, user)) return true;
  const progress = userTaskProgress(user);
  if (!progress.completed) return false;
  const approvedCount = (analysis.applications || []).filter(a => a.status === "APPROVED").length;
  return approvedCount < analysis.normalCapacity;
}
function approvedForAnalysis(analysis, user) {
  if (!user) return false;
  if (["SUPER_ADMIN", "MODERATOR"].includes(user.role)) return true;
  return (analysis.applications || []).some(a => a.userId === user.id && a.status === "APPROVED") ||
    (analysis.invites || []).some(i => i.userId === user.id && i.status === "INVITED") ||
    (analysis.rewards || analysis.rewardAccess || []).some(r => r.userId === user.id && r.status === "ACTIVE");
}
function isBadText(text) {
  const bannedWords = ["küfür", "hakaret", "orospu", "amk", "aq", "siktir"];
  const clean = (text || "").toLowerCase();
  return bannedWords.some(w => clean.includes(w));
}
function getBadges(user) {
  const badges = new Set(user?.badges || []);
  if ((user?.readCount || 0) >= 10) badges.add("Yeni Okur");
  if ((user?.readCount || 0) >= 25) badges.add("Sayfa Yolcusu");
  if ((user?.readCount || 0) >= 50) badges.add("Kitap Kurdu");
  if ((user?.readCount || 0) >= 100) badges.add("Raf Ustası");
  if ((user?.commentCount || 0) >= 100) badges.add("Yorum Üstadı");
  if ((user?.quoteCount || 0) >= 100) badges.add("Alıntı Avcısı");
  return [...badges];
}
function mapBook(book) {
  if (!book) return null;
  return {
    ...book,
    stats: { read: book.readCount || 0, reading: book.readingCount || 0, want: book.wantCount || 0 }
  };
}
function mapAnalysis(a) {
  if (!a) return null;
  return {
    ...a,
    book: a.book ? mapBook(a.book) : a.book,
    rewardAccess: a.rewards || a.rewardAccess || [],
    tables: (a.tables || []).sort((x, y) => (x.orderNo || 0) - (y.orderNo || 0))
  };
}
async function getCurrentUser(req) {
  if (!req.session.userId) return null;
  return prisma.user.findUnique({ where: { id: req.session.userId } });
}
async function getSettings() {
  return prisma.siteSetting.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" }
  });
}
async function getSiteStats() {
  const today = todayKey();
  const stat = await prisma.siteStat.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", lastVisitDate: today }
  });
  if (stat.lastVisitDate !== today) {
    return prisma.siteStat.update({
      where: { id: "main" },
      data: { todayVisits: 0, lastVisitDate: today }
    });
  }
  return stat;
}
async function recordVisit(req) {
  const isStatic = req.path.startsWith("/css") || req.path.startsWith("/js") || req.path.startsWith("/uploads");
  if (isStatic) return getSiteStats();
  const today = todayKey();
  let stat = await getSiteStats();
  stat = await prisma.siteStat.update({
    where: { id: "main" },
    data: { totalVisits: { increment: 1 }, todayVisits: { increment: 1 }, lastVisitDate: today }
  });
  return stat;
}
async function pickDailyQuote() {
  const today = todayKey();
  let stat = await getSiteStats();
  if (stat.dailyQuoteDate !== today || !stat.dailyQuoteId) {
    const count = await prisma.quote.count({ where: { status: "APPROVED" } });
    if (count > 0) {
      const index = parseInt(today.replaceAll("-", ""), 10) % count;
      const quote = await prisma.quote.findFirst({ where: { status: "APPROVED" }, skip: index, include: { book: true } });
      if (quote) {
        stat = await prisma.siteStat.update({
          where: { id: "main" },
          data: { dailyQuoteId: quote.id, dailyQuoteDate: today }
        });
        return quote;
      }
    }
  }
  return prisma.quote.findFirst({ where: { id: stat.dailyQuoteId, status: "APPROVED" }, include: { book: true } }) ||
    prisma.quote.findFirst({ where: { status: "APPROVED" }, include: { book: true } });
}
async function buildDbShape() {
  const [users, rawBooks, comments, quotes, analyses, settings, siteStats] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.book.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.comment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.quote.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.analysis.findMany({
      orderBy: { createdAt: "asc" },
      include: { tables: true, applications: true, invites: true, rewards: true, responses: true, book: true }
    }),
    getSettings(),
    getSiteStats()
  ]);
  const books = rawBooks.map(mapBook);
  return { users, books, comments, quotes, analyses: analyses.map(mapAnalysis), settings, siteStats };
}
function findInDb(db, type, id) {
  return (db[type] || []).find(x => x.id === id);
}
async function requireLogin(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) {
    req.flash("error", "Bu işlem için giriş yapmalısınız.");
    return res.redirect("/login");
  }
  if (isBanned(user)) {
    req.session.destroy(() => {});
    return res.render("banned", { user });
  }
  req.currentUser = user;
  next();
}
function requireRole(roles) {
  return async (req, res, next) => {
    const user = req.currentUser || await getCurrentUser(req);
    if (!user || !roles.includes(user.role)) {
      req.flash("error", "Bu alana giriş yetkiniz yok.");
      return res.redirect("/");
    }
    req.currentUser = user;
    next();
  };
}

app.use(async (req, res, next) => {
  try {
    const [user, settings, siteStats, dailyQuote] = await Promise.all([
      getCurrentUser(req),
      getSettings(),
      recordVisit(req),
      pickDailyQuote()
    ]);
    res.locals.currentUser = user;
    res.locals.settings = settings || {};
    res.locals.siteStats = siteStats || {};
    res.locals.dailyQuote = dailyQuote ? { ...dailyQuote, bookId: dailyQuote.bookId } : null;
    res.locals.flashError = req.flash("error");
    res.locals.flashSuccess = req.flash("success");
    res.locals.path = req.path;
    res.locals.getBadges = getBadges;
    res.locals.analysisState = analysisState;
    res.locals.userTaskProgress = userTaskProgress;
    res.locals.canUserSelfJoinAnalysis = canUserSelfJoinAnalysis;
    res.locals.canModeratorApprove = canModeratorApprove;
    res.locals.visibleQuotes = (db, bookId = null) => (db.quotes || []).filter(q => q.status === "APPROVED" && (!bookId || q.bookId === bookId));
    res.locals.getBook = (id) => null;
    res.locals.getUser = (id) => null;
    next();
  } catch (err) {
    next(err);
  }
});

app.get("/", async (req, res) => {
  const db = await buildDbShape();
  res.locals.getBook = (id) => findInDb(db, "books", id);
  res.locals.getUser = (id) => findInDb(db, "users", id);
  res.render("index", { db });
});

app.get("/books", async (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const cat = req.query.category || "";
  const where = {
    isActive: true,
    ...(cat ? { category: cat } : {}),
    ...(q ? { OR: [
      { title: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } }
    ] } : {})
  };
  const [rawBooks, categoriesRows] = await Promise.all([
    prisma.book.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.book.findMany({ where: { isActive: true }, select: { category: true }, distinct: ["category"] })
  ]);
  const books = rawBooks.map(mapBook);
  const categories = categoriesRows.map(r => r.category);
  res.render("books/list", { books, categories, q, cat });
});

app.get("/books/:id", async (req, res) => {
  const today = todayKey();
  await prisma.bookPageView.upsert({
    where: { bookId_dateKey: { bookId: req.params.id, dateKey: today } },
    update: { count: { increment: 1 } },
    create: { bookId: req.params.id, dateKey: today, count: 1 }
  }).catch(() => {});
  const rawBook = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!rawBook) return res.status(404).send("Kitap bulunamadı.");
  const book = mapBook(rawBook);
  const [comments, quotes, analyses, users] = await Promise.all([
    prisma.comment.findMany({ where: { bookId: book.id }, orderBy: { createdAt: "desc" } }),
    prisma.quote.findMany({ where: { bookId: book.id, status: "APPROVED" }, orderBy: { createdAt: "desc" } }),
    prisma.analysis.findMany({ where: { bookId: book.id }, include: { tables: true, applications: true, invites: true, rewards: true, responses: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany()
  ]);
  const db = { users, books: [book], comments, quotes, analyses: analyses.map(mapAnalysis) };
  res.locals.getBook = (id) => id === book.id ? book : null;
  res.locals.getUser = (id) => users.find(u => u.id === id);
  res.render("books/detail", { db, book, comments, quotes, analyses: analyses.map(mapAnalysis) });
});

app.post("/books/:id/comment", requireLogin, async (req, res) => {
  const user = req.currentUser;
  if (isMuted(user)) {
    req.flash("error", "Sessizde olduğunuz için yorum yapamazsınız.");
    return res.redirect("/books/" + req.params.id);
  }
  await prisma.comment.create({ data: { bookId: req.params.id, userId: user.id, text: req.body.text } });
  await prisma.user.update({ where: { id: user.id }, data: { commentCount: { increment: 1 } } });
  res.redirect("/books/" + req.params.id);
});

app.post("/books/:id/quote", requireLogin, async (req, res) => {
  const user = req.currentUser;
  if (isMuted(user)) {
    req.flash("error", "Sessizde olduğunuz için alıntı paylaşamazsınız.");
    return res.redirect("/books/" + req.params.id);
  }
  const directApprove = canManage(user);
  const suspected = isBadText(req.body.text);
  await prisma.quote.create({
    data: {
      bookId: req.params.id,
      userId: user.id,
      text: req.body.text,
      status: directApprove && !suspected ? "APPROVED" : "PENDING",
      moderationNote: suspected ? "Yasaklı kelime şüphesi" : null,
      reviewedBy: directApprove && !suspected ? user.id : null,
      reviewedAt: directApprove && !suspected ? new Date() : null
    }
  });
  await prisma.user.update({ where: { id: user.id }, data: { quoteCount: { increment: 1 } } });
  await prisma.auditLog.create({ data: { text: `${user.name} yeni alıntı gönderdi.`, actorId: user.id } }).catch(() => {});
  req.flash("success", directApprove && !suspected ? "Alıntı yayınlandı." : "Alıntınız moderatör onayına gönderildi.");
  res.redirect("/books/" + req.params.id);
});

app.post("/books/:id/read-status", requireLogin, async (req, res) => {
  const status = req.body.status;
  const data = {};
  if (status === "read") data.readCount = { increment: 1 };
  if (status === "reading") data.readingCount = { increment: 1 };
  if (status === "want") data.wantCount = { increment: 1 };
  if (Object.keys(data).length) await prisma.book.update({ where: { id: req.params.id }, data });
  if (status === "read") await prisma.user.update({ where: { id: req.currentUser.id }, data: { readCount: { increment: 1 } } });
  res.redirect("/books/" + req.params.id);
});

app.get("/quotes", async (req, res) => {
  const [quotes, users, rawBooks] = await Promise.all([
    prisma.quote.findMany({ where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany(),
    prisma.book.findMany()
  ]);
  const books = rawBooks.map(mapBook);
  const db = { quotes, users, books };
  res.locals.getBook = (id) => books.find(b => b.id === id);
  res.locals.getUser = (id) => users.find(u => u.id === id);
  res.render("quotes", { db, quotes });
});

app.get("/community", async (req, res) => {
  const db = await buildDbShape();
  res.locals.getBook = (id) => findInDb(db, "books", id);
  res.locals.getUser = (id) => findInDb(db, "users", id);
  res.render("community", { db });
});

app.get("/profile", requireLogin, async (req, res) => {
  const user = req.currentUser;
  const [comments, quotes, rawBooks] = await Promise.all([
    prisma.comment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.quote.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.book.findMany({ where: { isActive: true }, take: 5 })
  ]);
  const books = rawBooks.map(mapBook);
  const db = { books, comments, quotes, users: [user] };
  res.render("profile", { db, user, comments, quotes });
});

app.get("/analysis", async (req, res) => {
  const analyses = await prisma.analysis.findMany({
    include: { book: true, tables: true, applications: true, invites: true, rewards: true, responses: true },
    orderBy: [{ date: "asc" }, { time: "asc" }]
  });
  const mapped = analyses.map(mapAnalysis);
  const db = { analyses: mapped, books: analyses.map(a => mapBook(a.book)).filter(Boolean) };
  res.locals.getBook = (id) => db.books.find(b => b.id === id);
  res.render("analysis/list", { db, analyses: mapped });
});

app.get("/analysis/:id", async (req, res) => {
  const today = todayKey();
  await prisma.analysisPageView.upsert({
    where: { analysisId_dateKey: { analysisId: req.params.id, dateKey: today } },
    update: { count: { increment: 1 } },
    create: { analysisId: req.params.id, dateKey: today, count: 1 }
  }).catch(() => {});
  const raw = await prisma.analysis.findUnique({
    where: { id: req.params.id },
    include: { book: true, tables: true, applications: true, invites: true, rewards: true, responses: true }
  });
  if (!raw) return res.status(404).send("Tahlil bulunamadı.");
  const analysis = mapAnalysis(raw);
  const users = await prisma.user.findMany();
  const db = { analyses: [analysis], books: [mapBook(raw.book)], users };
  const state = analysisState(analysis);
  const activeIndex = activeTableIndex(analysis);
  const user = req.session.userId ? await getCurrentUser(req) : null;
  const approved = approvedForAnalysis(analysis, user);
  res.locals.getBook = (id) => db.books.find(b => b.id === id);
  res.locals.getUser = (id) => users.find(u => u.id === id);
  res.render("analysis/detail", { db, analysis, state, activeIndex, approved });
});

app.post("/analysis/:id/apply", requireLogin, async (req, res) => {
  const analysis = await prisma.analysis.findUnique({ where: { id: req.params.id } });
  if (!analysis) return res.redirect("/analysis");
  await prisma.analysisApplication.upsert({
    where: { analysisId_userId: { analysisId: analysis.id, userId: req.currentUser.id } },
    update: {},
    create: { analysisId: analysis.id, userId: req.currentUser.id, type: "NORMAL", status: "PENDING" }
  });
  req.flash("success", "Başvurunuz onaya gönderildi.");
  res.redirect("/analysis/" + analysis.id);
});

app.post("/analysis/:id/self-join", requireLogin, async (req, res) => {
  const raw = await prisma.analysis.findUnique({
    where: { id: req.params.id },
    include: { applications: true, invites: true, rewards: true, tables: true }
  });
  if (!raw) return res.redirect("/analysis");
  const analysis = mapAnalysis(raw);
  const user = req.currentUser;
  if (!canUserSelfJoinAnalysis(analysis, user)) {
    req.flash("error", "Görev şartlarını tamamlamadan veya kontenjan doluyken doğrudan katılamazsınız.");
    return res.redirect("/analysis/" + analysis.id);
  }
  await prisma.analysisApplication.upsert({
    where: { analysisId_userId: { analysisId: analysis.id, userId: user.id } },
    update: { status: "APPROVED", type: "TASK_REWARD_SELF_JOIN" },
    create: { analysisId: analysis.id, userId: user.id, status: "APPROVED", type: "TASK_REWARD_SELF_JOIN" }
  });
  await prisma.user.update({ where: { id: user.id }, data: { earnedAnalysisAccess: true } });
  req.flash("success", "Görev hakkınızla tahlile katıldınız.");
  res.redirect("/analysis/" + analysis.id);
});

app.post("/analysis/:id/respond", requireLogin, async (req, res) => {
  const raw = await prisma.analysis.findUnique({
    where: { id: req.params.id },
    include: { applications: true, invites: true, rewards: true, tables: true }
  });
  if (!raw) return res.redirect("/analysis");
  const analysis = mapAnalysis(raw);
  const user = req.currentUser;
  if (isMuted(user)) {
    req.flash("error", "Sessizde olduğunuz için tahlil mesajı yazamazsınız.");
    return res.redirect("/analysis/" + analysis.id);
  }
  if (!approvedForAnalysis(analysis, user)) {
    req.flash("error", "Bu tahlile katılım hakkınız yok.");
    return res.redirect("/analysis/" + analysis.id);
  }
  if (analysisState(analysis) !== "LIVE") {
    req.flash("error", "Tahlil şu anda canlı değil.");
    return res.redirect("/analysis/" + analysis.id);
  }
  const idx = activeTableIndex(analysis);
  const table = analysis.tables[idx];
  await prisma.analysisResponse.create({ data: { analysisId: analysis.id, tableId: table.id, userId: user.id, text: req.body.text } });
  res.redirect("/analysis/" + analysis.id);
});

app.get("/analysis/:id/report", async (req, res) => {
  const raw = await prisma.analysis.findUnique({
    where: { id: req.params.id },
    include: { book: true, tables: true, applications: true, invites: true, rewards: true, responses: true }
  });
  if (!raw) return res.redirect("/analysis");
  const analysis = mapAnalysis(raw);
  const users = await prisma.user.findMany();
  const db = { analyses: [analysis], books: [mapBook(raw.book)], users };
  res.locals.getBook = (id) => db.books.find(b => b.id === id);
  res.locals.getUser = (id) => users.find(u => u.id === id);
  res.render("analysis/report", { db, analysis });
});

app.get("/login", (req, res) => res.render("login"));

app.post("/login", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    req.flash("error", "E-posta veya şifre hatalı.");
    return res.redirect("/login");
  }
  if (["SUPER_ADMIN", "MODERATOR"].includes(user.role)) {
    req.flash("error", "Admin ve moderatör hesapları ayrı yönetim girişinden girmelidir.");
    return res.redirect("/admin/login");
  }
  if (isBanned(user)) return res.render("banned", { user });
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/admin/login", (req, res) => res.render("admin/login"));

app.post("/admin/login", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    req.flash("error", "Yönetim e-postası veya şifre hatalı.");
    return res.redirect("/admin/login");
  }
  if (!["SUPER_ADMIN", "MODERATOR"].includes(user.role)) {
    req.flash("error", "Bu giriş sadece süper admin ve moderatör içindir.");
    return res.redirect("/admin/login");
  }
  if (isBanned(user)) return res.render("banned", { user });
  req.session.userId = user.id;
  if (user.role === "SUPER_ADMIN") return res.redirect("/admin");
  return res.redirect("/moderator");
});

app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
  const email = req.body.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    req.flash("error", "Bu e-posta zaten kayıtlı.");
    return res.redirect("/register");
  }
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  await prisma.user.create({ data: { name: req.body.name, email, passwordHash, role: "USER", avatar: "📚" } });
  req.flash("success", "Kayıt başarılı. Şimdi giriş yapabilirsiniz.");
  res.redirect("/login");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

app.get("/admin", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  const db = await buildDbShape();
  const [bookViews, analysisViews] = await Promise.all([
    prisma.bookPageView.groupBy({ by: ["bookId"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 10 }).catch(() => []),
    prisma.analysisPageView.groupBy({ by: ["analysisId"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 10 }).catch(() => [])
  ]);
  db.siteStats.bookPageViews = Object.fromEntries(bookViews.map(v => [v.bookId, v._sum.count || 0]));
  db.siteStats.analysisPageViews = Object.fromEntries(analysisViews.map(v => [v.analysisId, v._sum.count || 0]));
  res.locals.getBook = (id) => findInDb(db, "books", id);
  res.locals.getUser = (id) => findInDb(db, "users", id);
  res.render("admin/dashboard", { db });
});

app.post("/admin/settings", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.siteSetting.upsert({
    where: { id: "main" },
    update: { heroTitle: req.body.heroTitle, heroSubtitle: req.body.heroSubtitle, siteSlogan: req.body.siteSlogan || req.body.heroTitle },
    create: { id: "main", heroTitle: req.body.heroTitle, heroSubtitle: req.body.heroSubtitle, siteSlogan: req.body.siteSlogan || req.body.heroTitle }
  });
  req.flash("success", "Ana sayfa yazıları güncellendi.");
  res.redirect("/admin");
});

app.post("/admin/books", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  await prisma.book.create({
    data: {
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      year: req.body.year || null,
      pages: req.body.pages || null,
      cover: req.body.cover || "https://covers.openlibrary.org/b/id/240727-L.jpg",
      description: req.body.description || null
    }
  });
  res.redirect(req.currentUser.role === "SUPER_ADMIN" ? "/admin" : "/moderator");
});

app.post("/admin/user/:id/role", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { role: req.body.role } }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/user/:id/moderator-powers", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: {
      moderatorCanApprove: !!req.body.canApproveAnalysis,
      moderatorMonthlyQuota: parseInt(req.body.monthlyAnalysisQuota || "0", 10),
      moderatorUsedQuota: parseInt(req.body.usedAnalysisQuota || "0", 10)
    }
  }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/user/:id/ban", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { status: "BANNED", banType: req.body.type, banReason: req.body.reason, bannedAt: new Date() }
  }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/user/:id/unban", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE", banType: null, banReason: null, bannedAt: null }
  }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/user/:id/mute", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  const minutes = parseInt(req.body.minutes || "60", 10);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { status: "MUTED", mutedUntil: new Date(Date.now() + minutes * 60000) }
  }).catch(() => {});
  res.redirect(req.currentUser.role === "SUPER_ADMIN" ? "/admin" : "/moderator");
});

app.post("/admin/analysis", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  const titles = Array.isArray(req.body.tableTitle) ? req.body.tableTitle : [req.body.tableTitle];
  const questions = Array.isArray(req.body.tableQuestion) ? req.body.tableQuestion : [req.body.tableQuestion];
  const tables = titles.filter(Boolean).map((t, i) => ({ title: t, question: questions[i] || "", orderNo: i + 1 }));
  const durationPerTable = parseInt(req.body.durationPerTable || "5", 10);
  const totalDuration = parseInt(req.body.totalDuration || "0", 10) || (tables.length * durationPerTable);
  await prisma.analysis.create({
    data: {
      title: req.body.title,
      bookId: req.body.bookId,
      date: req.body.date,
      time: req.body.time,
      durationPerTable,
      totalDuration,
      autoClose: !!req.body.autoClose,
      normalCapacity: parseInt(req.body.normalCapacity || "20", 10),
      inviteCapacity: parseInt(req.body.inviteCapacity || "5", 10),
      rewardCapacity: parseInt(req.body.rewardCapacity || "5", 10),
      maxCapacity: parseInt(req.body.maxCapacity || "100", 10),
      minBadge: req.body.minBadge || null,
      minComments: parseInt(req.body.minComments || "0", 10),
      minReads: parseInt(req.body.minReads || "0", 10),
      allowApplications: !!req.body.allowApplications,
      allowInvites: !!req.body.allowInvites,
      allowRewards: !!req.body.allowRewards,
      tables: { create: tables }
    }
  });
  res.redirect("/admin");
});

app.post("/admin/analysis/:id/time-settings", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.analysis.update({
    where: { id: req.params.id },
    data: {
      date: req.body.date,
      time: req.body.time,
      durationPerTable: parseInt(req.body.durationPerTable || "5", 10),
      totalDuration: parseInt(req.body.totalDuration || "0", 10),
      autoClose: !!req.body.autoClose
    }
  }).catch(() => {});
  req.flash("success", "Tahlil süre ayarları güncellendi.");
  res.redirect("/admin");
});

app.post("/admin/analysis/:id/capacity", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.analysis.update({
    where: { id: req.params.id },
    data: {
      normalCapacity: parseInt(req.body.normalCapacity, 10),
      inviteCapacity: parseInt(req.body.inviteCapacity, 10),
      rewardCapacity: parseInt(req.body.rewardCapacity, 10)
    }
  }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/analysis/:id/application/:userId", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.analysisApplication.update({
    where: { analysisId_userId: { analysisId: req.params.id, userId: req.params.userId } },
    data: { status: req.body.status, approvedBy: req.currentUser.id }
  }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/analysis/:id/invite", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.analysisInvite.create({ data: { analysisId: req.params.id, userId: req.body.userId, note: req.body.note || "Özel davetiye" } }).catch(() => {});
  res.redirect("/admin");
});

app.post("/admin/analysis/:id/reward", requireLogin, requireRole(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.analysisRewardAccess.create({ data: { analysisId: req.params.id, userId: req.body.userId, reason: req.body.reason || "Ödül erişimi" } }).catch(() => {});
  res.redirect("/admin");
});

app.get("/moderator", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  const db = await buildDbShape();
  res.locals.getBook = (id) => findInDb(db, "books", id);
  res.locals.getUser = (id) => findInDb(db, "users", id);
  res.render("admin/moderator", { db });
});

app.post("/moderator/analysis/:id/application/:userId", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  const moderator = req.currentUser;
  if (req.body.status === "APPROVED" && !canModeratorApprove(moderator)) {
    req.flash("error", "Aylık tahlile alma kotanız dolmuş veya yetkiniz kapalı.");
    return res.redirect("/moderator");
  }
  await prisma.analysisApplication.update({
    where: { analysisId_userId: { analysisId: req.params.id, userId: req.params.userId } },
    data: { status: req.body.status, approvedBy: moderator.id }
  }).catch(() => {});
  if (req.body.status === "APPROVED" && moderator.role === "MODERATOR") {
    await prisma.user.update({ where: { id: moderator.id }, data: { moderatorUsedQuota: { increment: 1 } } });
  }
  res.redirect("/moderator");
});

app.post("/moderator/quote/:id/review", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  await prisma.quote.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status === "APPROVED" ? "APPROVED" : "REJECTED",
      moderationNote: req.body.moderationNote || null,
      reviewedBy: req.currentUser.id,
      reviewedAt: new Date()
    }
  }).catch(() => {});
  res.redirect("/moderator");
});

app.post("/moderator/quote/:id/delete", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  await prisma.quote.delete({ where: { id: req.params.id } }).catch(() => {});
  res.redirect("/moderator");
});

app.post("/moderator/comment/:id/delete", requireLogin, requireRole(["SUPER_ADMIN", "MODERATOR"]), async (req, res) => {
  await prisma.comment.delete({ where: { id: req.params.id } }).catch(() => {});
  res.redirect("/moderator");
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "P1001" || String(err.message || "").includes("Can't reach database")) {
    return res.status(500).send(`
      <h1>Veritabanına bağlanılamadı</h1>
      <p>PostgreSQL çalışmıyor olabilir.</p>
      <pre>docker compose up -d
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed-from-json
node server.js</pre>
    `);
  }
  res.status(500).send("Sunucu hatası: " + err.message);
});

app.listen(PORT, () => console.log(`Kitapİzi Prisma/PostgreSQL çalışıyor: http://localhost:${PORT}`));

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
