const express= require('express');
const router =express.Router();
const prisma=require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");




function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName:question.user ? question.user.name :null,
    user:undefined, // Exclude the user 
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
        include: { keywords: true, user: true },
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
        include: { keywords: true, user: true }
    });

    if(!question){
        return res.status(404).json({msg: "Question not found"});
    }
    res.json(formatQuestion(question));
})

//POST /api/questions/
router.post("/",async (req,res)=> {
    const {id, question, answer, keywords}=req.body;
    if ( !question || !answer){
        return res.status(400).json({msg:"question and answer are required"});
    }

    const keywordsArray=Array.isArray(keywords)? keywords: [];
  
    const newQuestion= await prisma.question.create({
        data: {
            question,
            answer,
            keywords: {
                connectOrCreate: keywordsArray.map((k) => ({
                    where: { name: k },
                    create: { name: k },
                })),
            },
        },
        include: { keywords: true,user: true },
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
        },
        include: { keywords: true },
    });
    res.json(formatQuestion(updatedQuestion));
});


//DELETE /api/questions/:qId
router.delete("/:qId", isOwner, async(req,res) => {
    const qId = Number(req.params.qId);
    const question= await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true, user: true },
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

module.exports=router;