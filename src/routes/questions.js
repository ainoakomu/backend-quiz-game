const express= require('express');
const router =express.Router();
const prisma=require("../lib/prisma");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer=require("multer");
const storage = multer.memoryStorage();
const {NotFoundError, ValidationError}=require("../lib/errors");
const {z}=require("zod");

const PostInput= z.object({
    question:z.string().min(1),
    answer:z.string().min(1),
    keywords:z.union([z.string(),z.array(z.string())]).optional(),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});


function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name), // keyword nimet
    userName:question.user ? question.user.name :null,  // user name jos on
    attemptCount: question._count?.attempts ?? 0, //yritysten määrä
    solved: question.attempts.some(a => a.isCorrect), //onko ratkaistu
    user:undefined, 
    _count:undefined, 
    attempts:undefined, 
  };
}


router.use(authenticate);

//GET /api/questions/,/api/questions\keyword=geography&page=1&limit=5
router.get("/", async (req, res,next)=>{
    try{
    const {keyword}=req.query;

    const where =keyword ?
    { keywords: { some: { name: keyword } } } : {};

    const page=Math.max(1,parseInt(req.query.page) || 1);
    const limit=Math.max(1, Math.min(100,parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;


    const [filteredQuestions, total] = await Promise.all([
        prisma.question.findMany({
        where,
        include: { 
            keywords: true, 
            user: true, 
            attempts:{where : {userId: req.user.userId}},
            _count:{select: {attempts:true} },
        },
        orderBy: { id: "asc" },
        skip,
        take:limit,
    }),prisma.question.count({ where }),]);

    res.json({
        data:filteredQuestions.map(formatQuestion),
        page,
        limit,
        total,
        totalPages: Math.ceil(total/limit),
    });
    }catch (err){
        next(err)
    }
});

//GET /api/questions/:qId
router.get("/:qId",async (req,res,next) => {
    try{
    const qId = Number(req.params.qId);
    //etsi kysymys
    const question=await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true, user: true, 
            attempts:{where : {userId: req.user.userId}},
            _count:{select: {attempts:true} }, },
       
    });

    if(!question){
        throw new NotFoundError("Question not found");
    }
    res.json(formatQuestion(question));
}catch (err){
    next(err)
}
})

//POST /api/questions/
router.post("/",upload.single("image"),async (req,res,next)=> {
  try {
    const {id, question, answer, keywords}=PostInput.parse(req.body);

    const keywordsArray=Array.isArray(keywords)? keywords: [];
    let imageUrl = null;
let imagePublicId = null;

if (req.file) {
  const uploadedImage = await uploadToCloudinary(req.file.buffer);

  imageUrl = uploadedImage.secure_url;
  imagePublicId = uploadedImage.public_id;
}

    const newQuestion= await prisma.question.create({
        data: {
            question,
            answer,
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
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId}}, _count:{select: {attempts:true} }, },
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
router.put("/:qId",isOwner,upload.single("image"),async (req,res,next) =>{
    try{
    const qId = Number(req.params.qId);
    const {id, question, answer, keywords}=PostInput.parse(req.body);

    const q= await prisma.question.findUnique({
        where: { id: qId },
    });

    if(!q){
        throw new NotFoundError("Question not found");
    }

    
    if ( !question || !answer){
        throw new ValidationError("Question and answer are mandatory");
    }

   const keywordsArray=Array.isArray(keywords)? keywords: [];
let imageUrl = q.imageUrl;
let imagePublicId = q.imagePublicId;

if (req.file) {
  const uploadedImage = await uploadToCloudinary(req.file.buffer);

  imageUrl = uploadedImage.secure_url;
  imagePublicId = uploadedImage.public_id;
}

    const updatedQuestion= await prisma.question.update({
        where: { id: qId },
        data: {
            question,
            answer,
            keywords: {
                connectOrCreate: keywordsArray.map((k) => ({
                    where: { name: k },
                    create: { name: k },
                })),
            },
            imageUrl,
            imagePublicId,
        },
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId}}, _count:{select: {attempts:true} }, },
    });
    res.json(formatQuestion(updatedQuestion));
} catch(err){
    next(err)
}
});


//DELETE /api/questions/:qId
router.delete("/:qId", isOwner, async(req,res,next) => {
    try{
    const qId = Number(req.params.qId);
    const question= await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId}}, _count:{select: {attempts:true} }, },
    });

    if(!question){
        throw new NotFoundError("Question not found");
    }
    if (question.imagePublicId) {
  await cloudinary.uploader.destroy(question.imagePublicId);
}

    await prisma.question.delete({
        where: { id: qId },
    });

    res.json({ 
        msg: "Question deleted successfully",
        question: formatQuestion(question),
    }); 
}catch(err){
    next(err)
}
});

//POST /api/questions/:qId/attempt
router.post("/:qId/attempt", async (req,res,next) => {

    try{
    const qId=Number(req.params.qId);
    //etsi kysymys
    const question= await prisma.question.findUnique({
        where: { id: qId },
    });

    if(!question){
        throw new NotFoundError("Question not found");
    }
    //yritys
    const attempt=await prisma.attempt.upsert({
        where: {userId_questionId: { userId: req.user.userId, questionId: qId } },
        update:{},
        create:{ userId: req.user.userId, questionId: qId },
    })

    //yritysten määrä
    const attemptCount= await prisma.attempt.count({
        where: { questionId: qId },
    });

    
    res.status(201).json({
        id: attempt.id,
        questionId: qId,
        attempted: true,
        attemptCount,
        createdAt: attempt.createdAt,
    });
    }catch(err){
        next(err)
    }
});

//DELETE /api/questions/:qId/attempt
router.delete("/:qId/attempt", async (req,res,next) => {
    try{

    const qId=Number(req.params.qId);
    const question= await prisma.question.findUnique({
        where: { id: qId },
    });
    if(!question){
        throw new NotFoundError("Question not found");
    }

    try {
        const attempt=await prisma.attempt.delete({
            where: {userId_questionId: { userId: req.user.userId, questionId: qId } },
        });
    } catch (error) {
        if (error.code === 'P2025') {
            // Record not found
            const attemptCount= await prisma.attempt.count({
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

    const attemptCount= await prisma.attempt.count({
        where: { questionId: qId },
    });

    res.json({
        questionId: qId,
        attempted: false,
        attemptCount,
    });
    }catch(err){
        next(err)
    }
});

//POST /api/questions/:qId/play
router.post("/:qId/play", async (req, res,next) => {
    try{
  const userId = req.user.userId;
  const qId = Number(req.params.qId);
  const { answer } = req.body;

  //etsi kysymys
  const question = await prisma.question.findUnique({
    where: { id: qId },
  });
  if (!question) {
       throw new NotFoundError("Question not found");
  }
  
  //tarkistetaan vastaus
  const isCorrect =
    question.answer.trim().toLowerCase() === (answer || "").trim().toLowerCase();

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
    questionId: qId,    //mikä kyssäri
    correct: isCorrect,  //onko oikein
    solved: isCorrect,  //päivitä solved
    correctAnswer: question.answer, //lähetä oikea vastaus
    attemptCount,   //lukumäärät
    solvedCount,
  });
}catch(err){
    next(err)
}
});

module.exports=router;