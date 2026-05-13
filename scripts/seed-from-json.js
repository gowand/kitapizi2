require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, "..", "data", "db.json");

function roleOf(role) {
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (role === "MODERATOR") return "MODERATOR";
  return "USER";
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error("data/db.json bulunamadı.");
    process.exit(1);
  }

  const old = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const demoHash = bcrypt.hashSync("admin123", 10);

  await prisma.siteSetting.upsert({
    where: { id: "main" },
    update: {
      heroTitle: old.settings?.heroTitle || "Her kitap, başka bir hayatın kapısını aralar.",
      heroSubtitle: old.settings?.heroSubtitle || "",
      siteSlogan: old.settings?.siteSlogan || "Her kitap, başka bir hayatın kapısını aralar.",
      defaultTheme: old.settings?.defaultTheme || "dark"
    },
    create: {
      id: "main",
      heroTitle: old.settings?.heroTitle || "Her kitap, başka bir hayatın kapısını aralar.",
      heroSubtitle: old.settings?.heroSubtitle || "",
      siteSlogan: old.settings?.siteSlogan || "Her kitap, başka bir hayatın kapısını aralar.",
      defaultTheme: old.settings?.defaultTheme || "dark"
    }
  });

  await prisma.siteStat.upsert({
    where: { id: "main" },
    update: {
      totalVisits: old.siteStats?.totalVisits || 0,
      todayVisits: old.siteStats?.todayVisits || 0,
      lastVisitDate: old.siteStats?.lastVisitDate || null,
      dailyQuoteId: old.siteStats?.dailyQuoteId || null,
      dailyQuoteDate: old.siteStats?.dailyQuoteDate || null
    },
    create: {
      id: "main",
      totalVisits: old.siteStats?.totalVisits || 0,
      todayVisits: old.siteStats?.todayVisits || 0,
      lastVisitDate: old.siteStats?.lastVisitDate || null,
      dailyQuoteId: old.siteStats?.dailyQuoteId || null,
      dailyQuoteDate: old.siteStats?.dailyQuoteDate || null
    }
  });

  for (const u of old.users || []) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash: demoHash,
        role: roleOf(u.role),
        avatar: u.avatar || "📚",
        status: u.ban?.active ? "BANNED" : (u.status === "MUTED" ? "MUTED" : "ACTIVE"),
        readCount: u.readCount || 0,
        commentCount: u.commentCount || 0,
        quoteCount: u.quoteCount || 0,
        badges: u.badges || [],
        mutedUntil: u.mutedUntil ? new Date(u.mutedUntil) : null,
        banType: u.ban?.type || null,
        banReason: u.ban?.reason || null,
        bannedAt: u.ban?.createdAt ? new Date(u.ban.createdAt) : null,
        moderatorCanApprove: !!u.moderatorPowers?.canApproveAnalysis,
        moderatorMonthlyQuota: u.moderatorPowers?.monthlyAnalysisQuota || 0,
        moderatorUsedQuota: u.moderatorPowers?.usedAnalysisQuota || 0,
        taskCommentsTarget: u.tasks?.commentsTarget || 10,
        taskQuotesTarget: u.tasks?.quotesTarget || 5,
        taskReadsTarget: u.tasks?.readsTarget || 3,
        earnedAnalysisAccess: !!u.tasks?.earnedAnalysisAccess
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash: demoHash,
        role: roleOf(u.role),
        avatar: u.avatar || "📚",
        status: u.ban?.active ? "BANNED" : (u.status === "MUTED" ? "MUTED" : "ACTIVE"),
        readCount: u.readCount || 0,
        commentCount: u.commentCount || 0,
        quoteCount: u.quoteCount || 0,
        badges: u.badges || [],
        mutedUntil: u.mutedUntil ? new Date(u.mutedUntil) : null,
        banType: u.ban?.type || null,
        banReason: u.ban?.reason || null,
        bannedAt: u.ban?.createdAt ? new Date(u.ban.createdAt) : null,
        moderatorCanApprove: !!u.moderatorPowers?.canApproveAnalysis,
        moderatorMonthlyQuota: u.moderatorPowers?.monthlyAnalysisQuota || 0,
        moderatorUsedQuota: u.moderatorPowers?.usedAnalysisQuota || 0,
        taskCommentsTarget: u.tasks?.commentsTarget || 10,
        taskQuotesTarget: u.tasks?.quotesTarget || 5,
        taskReadsTarget: u.tasks?.readsTarget || 3,
        earnedAnalysisAccess: !!u.tasks?.earnedAnalysisAccess
      }
    });
  }

  for (const b of old.books || []) {
    await prisma.book.upsert({
      where: { id: b.id },
      update: {
        title: b.title,
        author: b.author,
        category: b.category,
        year: b.year,
        pages: b.pages,
        cover: b.cover,
        description: b.description,
        readCount: b.stats?.read || 0,
        readingCount: b.stats?.reading || 0,
        wantCount: b.stats?.want || 0
      },
      create: {
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        year: b.year,
        pages: b.pages,
        cover: b.cover,
        description: b.description,
        readCount: b.stats?.read || 0,
        readingCount: b.stats?.reading || 0,
        wantCount: b.stats?.want || 0
      }
    });
  }

  for (const c of old.comments || []) {
    await prisma.comment.upsert({
      where: { id: c.id },
      update: { text: c.text, bookId: c.bookId, userId: c.userId },
      create: { id: c.id, text: c.text, bookId: c.bookId, userId: c.userId, createdAt: c.createdAt ? new Date(c.createdAt) : new Date() }
    });
  }

  for (const q of old.quotes || []) {
    await prisma.quote.upsert({
      where: { id: q.id },
      update: {
        text: q.text,
        bookId: q.bookId,
        userId: q.userId,
        likes: q.likes || 0,
        status: q.status || "APPROVED",
        moderationNote: q.moderationNote || null,
        reviewedBy: q.reviewedBy || null,
        reviewedAt: q.reviewedAt ? new Date(q.reviewedAt) : null
      },
      create: {
        id: q.id,
        text: q.text,
        bookId: q.bookId,
        userId: q.userId,
        likes: q.likes || 0,
        status: q.status || "APPROVED",
        moderationNote: q.moderationNote || null,
        reviewedBy: q.reviewedBy || null,
        reviewedAt: q.reviewedAt ? new Date(q.reviewedAt) : null,
        createdAt: q.createdAt ? new Date(q.createdAt) : new Date()
      }
    });
  }

  for (const a of old.analyses || []) {
    await prisma.analysis.upsert({
      where: { id: a.id },
      update: {
        title: a.title,
        bookId: a.bookId,
        date: a.date,
        time: a.time,
        durationPerTable: a.durationPerTable || 5,
        totalDuration: a.totalDuration || ((a.tables || []).length * (a.durationPerTable || 5)),
        autoClose: a.autoClose !== false,
        normalCapacity: a.normalCapacity || 20,
        inviteCapacity: a.inviteCapacity || 5,
        rewardCapacity: a.rewardCapacity || 5,
        maxCapacity: a.maxCapacity || 100,
        status: a.status || "SCHEDULED",
        minBadge: a.minBadge || null,
        minComments: a.minComments || 0,
        minReads: a.minReads || 0,
        allowApplications: a.allowApplications !== false,
        allowInvites: a.allowInvites !== false,
        allowRewards: a.allowRewards !== false,
        reportPublished: !!a.reportPublished
      },
      create: {
        id: a.id,
        title: a.title,
        bookId: a.bookId,
        date: a.date,
        time: a.time,
        durationPerTable: a.durationPerTable || 5,
        totalDuration: a.totalDuration || ((a.tables || []).length * (a.durationPerTable || 5)),
        autoClose: a.autoClose !== false,
        normalCapacity: a.normalCapacity || 20,
        inviteCapacity: a.inviteCapacity || 5,
        rewardCapacity: a.rewardCapacity || 5,
        maxCapacity: a.maxCapacity || 100,
        status: a.status || "SCHEDULED",
        minBadge: a.minBadge || null,
        minComments: a.minComments || 0,
        minReads: a.minReads || 0,
        allowApplications: a.allowApplications !== false,
        allowInvites: a.allowInvites !== false,
        allowRewards: a.allowRewards !== false,
        reportPublished: !!a.reportPublished
      }
    });

    for (let i = 0; i < (a.tables || []).length; i++) {
      const t = a.tables[i];
      await prisma.analysisTable.upsert({
        where: { id: t.id },
        update: { title: t.title, question: t.question || "", orderNo: i + 1, analysisId: a.id },
        create: { id: t.id, title: t.title, question: t.question || "", orderNo: i + 1, analysisId: a.id }
      });
    }

    for (const ap of a.applications || []) {
      await prisma.analysisApplication.upsert({
        where: { analysisId_userId: { analysisId: a.id, userId: ap.userId } },
        update: { type: ap.type || "NORMAL", status: ap.status || "PENDING", approvedBy: ap.approvedBy || null },
        create: { analysisId: a.id, userId: ap.userId, type: ap.type || "NORMAL", status: ap.status || "PENDING", approvedBy: ap.approvedBy || null }
      });
    }

    for (const inv of a.invites || []) {
      await prisma.analysisInvite.create({ data: { analysisId: a.id, userId: inv.userId, status: inv.status || "INVITED", note: inv.note || null } }).catch(() => {});
    }

    for (const rw of a.rewardAccess || []) {
      await prisma.analysisRewardAccess.create({ data: { analysisId: a.id, userId: rw.userId, status: rw.status || "ACTIVE", reason: rw.reason || null } }).catch(() => {});
    }

    for (const r of a.responses || []) {
      await prisma.analysisResponse.create({ data: { analysisId: a.id, tableId: r.tableId, userId: r.userId, text: r.text, createdAt: r.createdAt ? new Date(r.createdAt) : new Date() } }).catch(() => {});
    }
  }

  console.log("JSON verileri PostgreSQL/Prisma veritabanına aktarıldı.");
  console.log("Demo şifreler: admin123");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
