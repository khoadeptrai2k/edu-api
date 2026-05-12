const https = require("https");
const bcrypt = require("bcrypt");
const Users = require("../models/userModel");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const AI_EMAIL = process.env.AI_ASSISTANT_EMAIL || "ai-learning-assistant@edusocial.local";
const AI_USERNAME = process.env.AI_ASSISTANT_USERNAME || "learning_ai";

const requestOpenAI = (payload) => new Promise((resolve, reject) => {
  const body = JSON.stringify(payload);
  const req = https.request({
    hostname: "api.openai.com",
    path: "/v1/responses",
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 20000,
  }, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        if (res.statusCode >= 400) {
          return reject(new Error(json.error?.message || "OpenAI request failed."));
        }
        return resolve(json);
      } catch (err) {
        return reject(err);
      }
    });
  });

  req.on("timeout", () => req.destroy(new Error("OpenAI request timed out.")));
  req.on("error", reject);
  req.write(body);
  req.end();
});

const extractOutputText = (response) => {
  if (response.output_text) return response.output_text.trim();

  const parts = [];
  (response.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    });
  });

  return parts.join("\n").trim();
};

const getAIAssistantUser = async () => {
  let user = await Users.findOne({ email: AI_EMAIL });
  if (user) return user;

  const password = await bcrypt.hash(`${Date.now()}-${AI_EMAIL}`, 10);
  user = await Users.create({
    fullname: "Learning AI Assistant",
    username: AI_USERNAME,
    email: AI_EMAIL,
    password,
    role: "admin",
    avatar: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5Fy2CcEklNju2NfUSaKt7cRAwVJRhwZkS2w&s",
    story: "AI tutor focused on study support.",
  });

  return user;
};

const buildLearningPrompt = ({ content, focus }) => ([
  {
    role: "system",
    content: [
      "You are EduSocial Learning AI, a concise study tutor.",
      "Only answer in the context of learning, studying, explaining concepts, practice suggestions, and academic guidance.",
      "Do not provide unrelated entertainment, medical, legal, financial, or harmful instructions.",
      "If the post is not educational, gently redirect the learner to frame it as a study question.",
      "Reply in Vietnamese unless the post is clearly in another language.",
      "Keep the answer under 140 words, practical, supportive, and include one next learning step."
    ].join(" ")
  },
  {
    role: "user",
    content: `Learning focus: ${focus || "general"}\nStudent post: ${content}`
  }
]);

const buildLearningChatPrompt = ({ message, focus }) => ([
  {
    role: "system",
    content: [
      "You are EduSocial Premium AI, a private study chat tutor.",
      "Only help with learning, studying, concept explanations, practice plans, quizzes, writing feedback, and academic guidance.",
      "If the learner asks for unrelated topics, redirect them to a study-focused question.",
      "Do not provide medical, legal, financial, sexual, violent, harmful, cheating, or policy-evading instructions.",
      "Reply in Vietnamese unless the learner clearly uses another language.",
      "Keep replies practical, clear, and under 220 words. Include one suggested next step."
    ].join(" ")
  },
  {
    role: "user",
    content: `Learning focus: ${focus || "general"}\nStudent message: ${message}`
  }
]);

const generateLearningComment = async ({ content, focus }) => {
  if (!process.env.OPENAI_API_KEY || !content || !content.trim()) return null;

  const response = await requestOpenAI({
    model: DEFAULT_MODEL,
    input: buildLearningPrompt({ content, focus }),
    temperature: 0.35,
    max_output_tokens: 220,
  });

  return {
    text: extractOutputText(response),
    model: DEFAULT_MODEL,
  };
};

const generateLearningChatReply = async ({ message, focus }) => {
  if (!process.env.OPENAI_API_KEY || !message || !message.trim()) return null;

  const response = await requestOpenAI({
    model: DEFAULT_MODEL,
    input: buildLearningChatPrompt({ message, focus }),
    temperature: 0.35,
    max_output_tokens: 360,
  });

  return {
    text: extractOutputText(response),
    model: DEFAULT_MODEL,
  };
};

module.exports = {
  getAIAssistantUser,
  generateLearningComment,
  generateLearningChatReply,
};
