const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const cloudinary = require("../config/cloudinary");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const storage = multer.memoryStorage();
const { NotFoundError, ValidationError } = require("../lib/errors");
const { z } = require("zod");

const PostInput = z.object({
  question: z.string().min(1),
  answer: z.string().optional(),
  choices: z.union([z.string(), z.array(z.string())]).optional(),
  correctChoiceIndex: z.union([z.string(), z.number()]).optional(),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function parseChoices(rawChoices) {
  if (!rawChoices) return [];
  const choices = Array.isArray(rawChoices) ? rawChoices : [rawChoices];
  return choices.map((choice) => choice?.toString().trim()).filter(Boolean);
}

function normalizeQuestionData({ question, answer, choices, correctChoiceIndex, keywords }) {
  const parsedChoices = parseChoices(choices);
  const filteredChoices = parsedChoices.filter((choice) => choice.length > 0);
  let normalizedAnswer = typeof answer === "string" ? answer.trim() : "";

  if (filteredChoices.length > 0) {
    const index = Number(correctChoiceIndex);
    if (!Number.isInteger(index) || index < 0 || index >= filteredChoices.length) {
      throw new ValidationError("Correct choice index is required for multiple choice questions");
    }
    normalizedAnswer = filteredChoices[index];
  }

  if (!normalizedAnswer) {
    throw new ValidationError("Answer is required");
  }

  return {
    question,
    answer: normalizedAnswer,
    choices: filteredChoices.length > 0 ? filteredChoices : null,
    keywords: Array.isArray(keywords) ? keywords : keywords ? [keywords] : [],
  };
}

function formatQuestion(question, includeAnswer = false) {
  return {
    id: question.id,
    question: question.question,
    imageUrl: question.imageUrl,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,

    keywords: question.keywords?.map((k) => k.name) ?? [],
    choices: question.choices ?? [],

    userId: question.userId,
    userName: question.user ? question.user.name : null,

    attemptCount: question._count?.attempts ?? 0,
    solved: question.attempts?.some((a) => a.isCorrect) ?? false,

    ...(includeAnswer && { answer: question.answer }),
  };
}

router.use(authenticate);

//added try catch to help debug the cloudinary and for safety

//GET /api/questions/,/api/questions\keyword=geography&page=1&limit=5
router.get("/", async (req, res, next) => {
  try {
    const { keyword } = req.query;

    const where = keyword ? { keywords: { some: { name: keyword } } } : {};

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;

    const [filteredQuestions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          keywords: true,
          user: true,
          attempts: { where: { userId: req.user.userId } },
          _count: { select: { attempts: true } },
        },
        orderBy: { id: "asc" },
        skip,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    res.json({
      data: filteredQuestions.map((q) => formatQuestion(q)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

//GET /api/questions/:qId
router.get("/:qId", async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    //etsi kysymys
    const question = await prisma.question.findUnique({
      where: { id: qId },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId } },
        _count: { select: { attempts: true } },
      },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }
    const includeAnswer = question.userId === req.user.userId;

    res.json(formatQuestion(question, includeAnswer));
  } catch (err) {
    next(err);
  }
});

//POST /api/questions/
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { question, answer, choices, correctChoiceIndex, keywords } = PostInput.parse(req.body);
    const normalized = normalizeQuestionData({ question, answer, choices, correctChoiceIndex, keywords });

    const keywordsArray = Array.isArray(normalized.keywords) ? normalized.keywords : [];
    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      try {
        console.log("POST /api/questions - received file:", {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });

        const uploadedImage = await uploadToCloudinary(req.file.buffer);

        imageUrl = uploadedImage.secure_url;
        imagePublicId = uploadedImage.public_id;
      } catch (uploadErr) {
        console.error("Error uploading image in POST /api/questions", {
          message: uploadErr?.message,
          stack: uploadErr?.stack,
          file: req.file && {
            originalname: req.file.originalname,
            size: req.file.size,
          },
        });
        throw uploadErr;
      }
    }

    const newQuestion = await prisma.question.create({
      data: {
        question: normalized.question,
        answer: normalized.answer,
        choices: normalized.choices,
        imageUrl,
        imagePublicId,
        userId: req.user.userId,
        keywords: {
          connectOrCreate: keywordsArray.map((k) => ({
            where: { name: k },
            create: { name: k },
          })),
        },
      },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId } },
        _count: { select: { attempts: true } },
      },
    });

    res.status(201).json(formatQuestion(newQuestion));
  } catch (err) {
    console.error("POST /api/questions error", {
      error: err.message,
      stack: err.stack,
      body: req.body,
      file: req.file,
    });
    next(err);
  }
});

//PUT /api/questions/:qId
router.put("/:qId", isOwner, upload.single("image"), async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    const { question, answer, choices, correctChoiceIndex, keywords } = PostInput.parse(req.body);
    const normalized = normalizeQuestionData({ question, answer, choices, correctChoiceIndex, keywords });

    const q = await prisma.question.findUnique({
      where: { id: qId },
    });

    if (!q) {
      throw new NotFoundError("Question not found");
    }

    const keywordsArray = Array.isArray(normalized.keywords) ? normalized.keywords : [];
    let imageUrl = q.imageUrl;
    let imagePublicId = q.imagePublicId;

    if (req.file) {
      const uploadedImage = await uploadToCloudinary(req.file.buffer);

      imageUrl = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: qId },
      data: {
        question: normalized.question,
        answer: normalized.answer,
        choices: normalized.choices,
        keywords: {
          connectOrCreate: keywordsArray.map((k) => ({
            where: { name: k },
            create: { name: k },
          })),
        },
        imageUrl,
        imagePublicId,
      },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId } },
        _count: { select: { attempts: true } },
      },
    });
    res.json(formatQuestion(updatedQuestion));
  } catch (err) {
    next(err);
  }
});

//DELETE /api/questions/:qId
router.delete("/:qId", isOwner, async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    const question = await prisma.question.findUnique({
      where: { id: qId },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId } },
        _count: { select: { attempts: true } },
      },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }
    if (question.imagePublicId) {
      await cloudinary.uploader.destroy(question.imagePublicId);
    }

    await prisma.attempt.deleteMany({
      where: { questionId: qId },
    });

    await prisma.question.delete({
      where: { id: qId },
    });

    res.json({
      msg: "Question deleted successfully",
      question: formatQuestion(question),
    });
  } catch (err) {
    next(err);
  }
});

//POST /api/questions/:qId/attempt
router.post("/:qId/attempt", async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    //etsi kysymys
    const question = await prisma.question.findUnique({
      where: { id: qId },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }
    //yritys
    const attempt = await prisma.attempt.upsert({
      where: {
        userId_questionId: { userId: req.user.userId, questionId: qId },
      },
      update: {},
      create: { userId: req.user.userId, questionId: qId },
    });

    //yritysten määrä
    const attemptCount = await prisma.attempt.count({
      where: { questionId: qId },
    });

    res.status(201).json({
      id: attempt.id,
      questionId: qId,
      attempted: true,
      attemptCount,
      createdAt: attempt.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

//DELETE /api/questions/:qId/attempt
router.delete("/:qId/attempt", async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    const question = await prisma.question.findUnique({
      where: { id: qId },
    });
    if (!question) {
      throw new NotFoundError("Question not found");
    }

    try {
      const attempt = await prisma.attempt.delete({
        where: {
          userId_questionId: { userId: req.user.userId, questionId: qId },
        },
      });
    } catch (error) {
      if (error.code === "P2025") {
        // Record not found
        const attemptCount = await prisma.attempt.count({
          where: { questionId: qId },
        });
        return res.json({
          questionId: qId,
          attempted: false,
          attemptCount,
        });
      }
      throw error;
    }

    const attemptCount = await prisma.attempt.count({
      where: { questionId: qId },
    });

    res.json({
      questionId: qId,
      attempted: false,
      attemptCount,
    });
  } catch (err) {
    next(err);
  }
});

//POST /api/questions/:qId/play
router.post("/:qId/play", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const qId = Number(req.params.qId);
    const { answer, choiceIndex } = req.body;

    //etsi kysymys
    const question = await prisma.question.findUnique({
      where: { id: qId },
    });
    if (!question) {
      throw new NotFoundError("Question not found");
    }

    let isCorrect;
    if (question.choices && Array.isArray(question.choices) && question.choices.length > 0) {
      if (choiceIndex === undefined || choiceIndex === null || String(choiceIndex).trim() === "") {
        throw new ValidationError("Choice selection is required");
      }
      const index = Number(choiceIndex);
      isCorrect = question.choices[index] === question.answer;
    } else {
      isCorrect =
        question.answer.trim().toLowerCase() ===
        (answer || "").trim().toLowerCase();
    }

    //jos oikein, merkitään ratkaistuksi, muuten lisätään yritys
    if (isCorrect) {
      await prisma.attempt.create({
        data: { userId, questionId: qId, isCorrect: true },
      });
    } else {
      await prisma.attempt.create({
        data: { userId, questionId: qId, isCorrect: false },
      });
    }

    //palautetaan vastaus, yritysten ja ratkaisujen määrä
    const attemptCount = await prisma.attempt.count({
      where: { questionId: qId },
    });

    //käyttäjän oikein ratkaistujen kysymysten määrä
    const solvedCount = await prisma.attempt.count({
      where: { userId, isCorrect: true },
    });

    res.json({
      questionId: qId, //mikä kyssäri
      correct: isCorrect, //onko oikein
      solved: isCorrect, //päivitä solved
      correctAnswer: question.answer, //lähetä oikea vastaus
      attemptCount, //lukumäärät
      solvedCount,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
