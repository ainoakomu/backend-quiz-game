
const {resetDb, registerAndLogin, createQuestion, request, app,prisma} = require("./helpers");



describe("question tests", () => {
    beforeEach(resetDb);

it("returns 401 without token", async () => {
    const res=await request(app).get("/api/questions");
    expect(res.status).toBe(401);
});


it("return 404 for unknown question", async () => {
    const token = await registerAndLogin(); //user tästä

    const res = await request(app).get("/api/questions/9999999")    //random qid
    .set("Authorization", `Bearer ${token}`);   //headers

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
});

it("returns 400 for invalid question body", async () => {
    const token = await registerAndLogin();

    const res = await request(app).post("/api/questions")
    .set("Authorization", `Bearer ${token}`)
    .send({ question: "Q" }); //puuttuu answer

    expect(res.status).toBe(400);
});

it("returns 403 when editing another user's question", async () => {
    const Atoken = await registerAndLogin("a@test.io","A");
    const question = await createQuestion(Atoken, { question: "What is 2+2?", answer: "4" });

    const Btoken = await registerAndLogin("b@test.io","B");
    const res= await request(app).put(`/api/questions/${question}`)
    .set("Authorization", `Bearer ${Btoken}`)
    .send({ question: "What is 2+2?", answer: "changed by B" });

    expect(res.status).toBe(403);
    const after =await prisma.question.findUnique({ where: { id: question } });
    expect(after.answer).toBe("4"); //ei muutu
});

it("return 403 when deleting another user's question", async () => {
    const Atoken = await registerAndLogin("a@test.io","A");
    const question = await createQuestion(Atoken, { question: "What is 2+2?", answer: "4" });

    const Btoken = await registerAndLogin("b@test.io","B");
    const res= await request(app).delete(`/api/questions/${question}`)
    .set("Authorization", `Bearer ${Btoken}`);

    expect(res.status).toBe(403);
    const after =await prisma.question.findUnique({ where: { id: question } });
    expect(after).not.toBeNull(); //ei muutu
});


});