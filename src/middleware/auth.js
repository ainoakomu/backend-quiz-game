const jwt = require("jsonwebtoken");
const { ForbiddenError, UnauthorizedError } = require("../lib/errors");
const SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided");
  }
  //actual token after bearer
  const token = authHeader.split(" ")[1];

  //making the verification
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next(); //if okay

<<<<<<< HEAD
  } catch (err) {
    req.log.warn({},"Error authenticating");
    throw new ForbiddenError("Invalid or expired token");
  }
}
=======
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }
    //actual token after bearer
    const token = authHeader.split(" ")[1];

    //making the verification
    try {
        const decoded = jwt.verify(token, SECRECT);
        req.user = decoded;
        next(); //if okay
    } catch (err) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
};
>>>>>>> b97310d (fixed typos and postman working correctly)

module.exports = authenticate;
