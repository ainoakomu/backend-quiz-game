const prisma = require("../src/lib/prisma");
const request = require("supertest");
const app = require("../src/app");

async function resetDb(){
    await prisma.attempt.deleteMany();
    await prisma.question.deleteMany();
    await prisma.keyword.deleteMany();
    await prisma.user.deleteMany();
}
async function registerAndLogin(email="a@test.io",name="A"){
    await request(app).post("/api/auth/register").send({email,name,password:"password"});
    const res = await request(app).post("/api/auth/login").send({email,password:"password"});
    return res.body.token;
}


async function createQuestion(token, overrides = {}) {
  const res = await request(app).post("/api/questions")
    .set("Authorization", `Bearer ${token}`)
    .send({ question: "Q", answer: "A", ...overrides });
  return res.body.id;
}

async function deleteQuestion(token, qId, overrides={} ){
  const res= await request(app).delete("/api/questions/"+qId)
  .set("Authorization", `Bearer ${token}`)
  .send({...overrides});
  return res; 
}
module.exports = { resetDb, registerAndLogin, createQuestion,request,prisma,app,deleteQuestion };