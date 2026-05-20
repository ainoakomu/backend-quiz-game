const express = require("express");
const https = require("https");
const router = express.Router();
const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} = require("../lib/errors");

const SECRET = process.env.JWT_SECRET;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;

function verifyCaptcha(token) {
  return new Promise((resolve, reject) => {
    if (!RECAPTCHA_SECRET) return resolve();
    if (!token) return reject(new ValidationError("CAPTCHA token is required"));

    const postData = new URLSearchParams({
      secret: RECAPTCHA_SECRET,
      response: token,
    }).toString();

    const options = {
      hostname: "www.google.com",
      path: "/recaptcha/api/siteverify",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data.success) {
            resolve(data);
          } else {
            reject(new ValidationError("CAPTCHA verification failed"));
          }
        } catch (err) {
          reject(new ValidationError("CAPTCHA verification failed"));
        }
      });
    });

    request.on("error", (error) => reject(new ValidationError("CAPTCHA verification failed")));
    request.write(postData);
    request.end();
  });
}

//POST /api/auth/register
router.post("/register", async (req, res,next) => {
  try{
  const { email, password, name, captchaToken } = req.body;

  if (!email || !password || !name) {
    throw new ValidationError("email, name and password are required");
  }

  if (RECAPTCHA_SECRET) {
    await verifyCaptcha(captchaToken);
  }

  //check if the user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ConflictError("email already registered");
  }

  //hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  //Create the user
  const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
  });
  

  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.status(201).json({
    message: "User registered successfully",
    token,
  });
}catch (err) {
  if (err?.code === "P2002") {
    next(new ConflictError("email already registered"));
  } else {
    next(err);
  }
}
});

//POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try{
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError("email and password are required");
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Verify the password
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.json({ token });
} catch (err){
  next(err)
}
});

module.exports = router;
