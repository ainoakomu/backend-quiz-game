const express= require('express');
const router =express.Router();

const questions=require("../data/questions");

//GET /api/questions/,/api/questions\keyword=geography
router.get("/", (req, res)=>{
    const {keyword}=req.query;
    if(!keyword){
        return res.json(questions);
    }
    const filteredQuestions=questions.filter(q=>q.keywords.includes(keyword));
    res.json(filteredQuestions);
});

//GET /api/questions/:qId
router.get("/:qId",(req,res) => {
    const qId = Number(req.params.qId);

    const question=questions.find(q=>q.id===qId);

    if(!question){
        return res.status(404).json({msg: "Question not found"});
    }
    res.json(question);
})

//POST /api/questions/
router.post("/",(req,res)=> {
    const {id, question, answer, keywords}=req.body;
    if ( !question || !answer){
        return res.status(400).json({msg:"question and answer are required"});
    }
    const existingIds=questions.map(q=>q.id);// [1,2,3,4,5]
    const maxId=Math.max(...existingIds);
    const newQuestion= {
        id: questions.length ? maxId+1:1,
        question, answer,
        keywords:Array.isArray(keywords)? keywords: []
    }
    questions.push(newQuestion);
    res.status(201).json(newQuestion);
})

//PUT /api/questions/:qId
router.put("/:qId",(req,res) =>{
    const qId = Number(req.params.qId);
    const q=questions.find(q=>q.id===qId); //refecence to the og question object in the array

    if(!q){
        return res.status(404).json({msg: "Question not found"});
    }

    const {question, answer, keywords}=req.body;
    if ( !question || !answer){
        return res.status(400).json({msg:"question and answer are required"});
    }

    q.question=question;
    q.answer=answer;
    q.keywords=Array.isArray(keywords)? keywords: [];

    res.json(q);
});

//DELETE /api/questions/:qId
router.delete("/:qId",(req,res) => {
    const qId = Number(req.params.qId);
    const qindex=questions.findIndex(q=>q.id===qId);
    if(qindex===-1){
        return res.status(404).json({msg: "Question not found"});
    }
    const deleteQuestion=questions.splice(qindex,1);
    res.json({ 
        msg: "Question deleted successfully",
        question: deleteQuestion
    }); 
});
module.exports=router;