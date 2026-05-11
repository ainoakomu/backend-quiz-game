const { resetDb,request,prisma,app } = require("./helpers");
const bcrypt = require("bcrypt");


beforeEach(resetDb);

it("registers, hashes password and returns token", async() =>{


    const res= await request(app).post("/api/auth/register")
    .send({email:"a@test.io", name:"A", password:"password"});

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));


    const user=await prisma.user.findUnique({where:{email:"a@test.io"}});
    expect(user.password).not.toBe("password");

    const comparison = await bcrypt.compare("password", user.password);
    expect(comparison).toBe(true);
});

it("returns 409 when registering with an already registered email", async () => {

    //first register
  await request(app).post("/api/auth/register")
    .send({email:"a@test.io", name:"A", password:"password"});

    //second register
  const res = await request(app).post("/api/auth/register")
    .send({email:"a@test.io", name:"A", password:"password"});

    //expected to fail
  expect(res.status).toBe(409);
  expect(res.body.message).toBe("email already registered");
});