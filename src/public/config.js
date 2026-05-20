const CONFIG = {
  API_URL: "",
  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    QUESTIONS: "/api/questions",
  },
  FIELDS: {
    LOGIN: ["email", "password"],
    REGISTER: ["email", "password", "name"],
    QUESTION: ["question", "answer", "keywords"],
  },
  QUESTIONS_PER_PAGE: 5,
  STORAGE_KEY: "jwt_token",
  RECAPTCHA_SITE_KEY: "6LcW_vMsAAAAAGR3bV9xlRw57b2maU_ekUXvm8Zp",
  API_FIELDS: {
    AttemptCount: "attemptCount",
    SOLVED: "solved",
  },
};
