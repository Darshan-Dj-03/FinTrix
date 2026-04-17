const path = require("path");
const dotenv = require("dotenv");
const Joi = require("joi");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const schema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(5000),
  MONGO_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default("7d"),
  CORS_ORIGIN: Joi.string().allow("", "*").default("*"),
  EMAIL_SERVICE: Joi.string().allow("").default("gmail"),
  EMAIL_USER: Joi.string().allow("").default(""),
  EMAIL_PASSWORD: Joi.string().allow("").default(""),
  NODE_CRON_ENABLED: Joi.string().valid("true", "false").default("true"),
  SWAGGER_ENABLED: Joi.string().valid("true", "false").default("true"),
}).unknown();

const { error, value } = schema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false,
});

if (error) {
  throw new Error(
    `Environment validation failed: ${error.details
      .map((detail) => detail.message)
      .join(", ")}`
  );
}

module.exports = value;
