const express= require('express');
const router =express.Router();

const questions=require("../data/questions");

//GET /api/questions/
router.get("/", (req, res)=>{
    res.json(questions);
});

module.exports=router;