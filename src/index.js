//import the express dependency
const express = require('express');
const app = express();  //creates the app
const questionsRouter=require("./routes/questions");
const authRouter = require("./routes/auth");
const prisma = require("./lib/prisma");
const path= require("path");

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (will be useful in later steps)
app.use(express.json());

// Serve static files from the "public/quiz-frontend" directory
app.use(express.static(path.join(__dirname, "public", "quiz-frontend")));

//Routes
app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);

app.use((req,res)=> {
  res.status(404).json({msg: "Not found"});
})

// Start the server by listening on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
