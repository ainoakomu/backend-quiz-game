const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const seedQuestions = [
  {
    question: "What is the capital of Finland?",
    answer: "Helsinki",
    keywords: ["question", "geography"],
  },
  {
    question: "Where is IKEA from originally?",
    answer: "Sweden",
    keywords: ["question", "geography"],
  },
  {
    question: "What famous couple founded the Artek furniture company?",
    answer: "Alvar and Aino Aalto",
    keywords: ["question", "furniture"],
  },
  {
    question:
      "What famous duo is celebrating their 10th anniversary with a Arena show in Helsinki in 20.11.2026?",
    answer: "Viki ja Köpi",
    keywords: ["question", "people"],
  },
  {
    question:
      "Who says: I got a jar of dirt, i got a jar of dirt, and guess what's inside it?",
    answer: "Jack Sparrow",
    keywords: ["question", "movies"],
  },
];

async function main() {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("0000", 10);

  const user = await prisma.user.create({
    data: {
      email: "example@example.com",
      password: hashedPassword,
      name: "John Doe",
    },
  });

  console.log("User created:", user.email);

  for (const q of seedQuestions) {
    await prisma.question.create({
      data: {
        question: q.question,
        answer: q.answer,
        userId: user.id,
        keywords: {
          connectOrCreate: q.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());