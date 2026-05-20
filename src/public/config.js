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
  RECAPTCHA_SITE_KEY: "6LeNF_QsAAAAAGIx-U90z_4Cy75eFZGd0xAMMk-Q",
  API_FIELDS: {
    AttemptCount: "attemptCount",
    SOLVED: "solved",
  },
};
