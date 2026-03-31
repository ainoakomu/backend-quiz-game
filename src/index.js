//import the express dependency
const express = require('express');
const app = express();  //creates the app

const questionsRouter=require("./routes/questions");
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (will be useful in later steps)
app.use(express.json());
//everything in questions
app.use("/api/questions", questionsRouter);
app.use((req,res)=> {
  res.status(404).json({msg: "Not found"});
})

// Start the server by listening on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
