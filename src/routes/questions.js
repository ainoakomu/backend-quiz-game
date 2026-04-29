const express= require('express');
const router =express.Router();
const prisma=require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer=require("multer");
const path= require("path");

const storage=multer.diskStorage({
    destination: path.join(__dirname,"..","..","public","uploads"),
    filename: (req,file,cb)=>{
        const ext=path.extname(file.originalname);
        const newName=`${Date.now()}-${Math.round(Math.random().toString(36).slice(2,8))}${ext}`;
        cb(null,newName);
    }
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
    keywords: question.keywords.map((k) => k.name), // Extract keyword names
    userName:question.user ? question.user.name :null,  // Include user name if available
    attempted: question.attempts && question.attempts.length > 0,   // Check if the user has attempted the question
    attemptCount:question._count.attempts ?? 0, // Include the count of attempts
    user:undefined, // Exclude the user 
    _count:undefined, // Exclude the _count
    attempts:undefined, // Exclude the attempts
  };
}


router.use(authenticate);

//GET /api/questions/,/api/questions\keyword=geography&page=1&limit=5
router.get("/", async (req, res)=>{
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
            attempts:{where : {userId: req.user.userId},take:1},
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

});

//GET /api/questions/:qId
router.get("/:qId",async (req,res) => {
    const qId = Number(req.params.qId);
    const question=await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId},take:1},
            _count:{select: {attempts:true} }, },
       
    });

    if(!question){
        return res.status(404).json({msg: "Question not found"});
    }
    res.json(formatQuestion(question));
})

//POST /api/questions/
router.post("/",upload.single("image"),async (req,res)=> {
   
    const {id, question, answer, keywords}=req.body;
    if ( !question || !answer){
        return res.status(400).json({msg:"question and answer are required"});
    }

    const keywordsArray=Array.isArray(keywords)? keywords: [];
    const imageUrl=req.file ? `/uploads/${req.file.filename}` : null;
    const newQuestion= await prisma.question.create({
        data: {
            question,
            answer,
            imageUrl,
            userId: req.user.userId,
            keywords: {
                connectOrCreate: keywordsArray.map((k) => ({
                    where: { name: k },
                    create: { name: k },
                })),
            },
        },
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId},take:1}, _count:{select: {attempts:true} }, },
    });

    
    res.status(201).json(formatQuestion(newQuestion));
});

//PUT /api/questions/:qId
router.put("/:qId",isOwner,async (req,res) =>{
    const qId = Number(req.params.qId);
    const {question, answer, keywords}=req.body;

    const q= await prisma.question.findUnique({
        where: { id: qId },
    });

    if(!q){
        return res.status(404).json({msg: "Question not found"});
    }

    
    if ( !question || !answer){
        return res.status(400).json({msg:"question and answer are required"});
    }

   const keywordsArray=Array.isArray(keywords)? keywords: [];
    const imageUrl=req.file ? `/uploads/${req.file.filename}` : null;
   
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
        },
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId},take:1}, _count:{select: {attempts:true} }, },
    });
    res.json(formatQuestion(updatedQuestion));
});


//DELETE /api/questions/:qId
router.delete("/:qId", isOwner, async(req,res) => {
    const qId = Number(req.params.qId);
    const question= await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true, user: true, attempts:{where : {userId: req.user.userId},take:1}, _count:{select: {attempts:true} }, },
    });

    if(!question){
        return res.status(404).json({msg: "Question not found"});
    }
    await prisma.question.delete({
        where: { id: qId },
    });

    res.json({ 
        msg: "Question deleted successfully",
        question: formatQuestion(question),
    }); 
});

//POST /api/questions/:qId/attempt
router.post("/:qId/attempt", async (req,res) => {

    const qId=Number(req.params.qId);
    const question= await prisma.question.findUnique({
        where: { id: qId },
    });
    if(!question){
        return res.status(404).json({msg: "Question not found"});
    }

    const attempt=await prisma.attempt.upsert({
        where: {userId_questionId: { userId: req.user.userId, questionId: qId } },
        update:{},
        create:{ userId: req.user.userId, questionId: qId },
    })

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

});

//DELETE /api/questions/:qId/attempt
router.delete("/:qId/attempt", async (req,res) => {

    const qId=Number(req.params.qId);
    const question= await prisma.question.findUnique({
        where: { id: qId },
    });
    if(!question){
        return res.status(404).json({msg: "Question not found"});
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

});
module.exports=router;