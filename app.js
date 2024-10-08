const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");
const { OpenAI } = require("openai");
const { default: axios } = require("axios");
require("dotenv").config();

const app = express();
const port = 8000;

app.use(cors());

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.send("hello world!");
});

// open ai
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// ai/ml
const aiml = new OpenAI({
  apiKey: process.env.TEMP_KEY,
  baseURL: "https://api.aimlapi.com/v1",
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to make a request with retry logic in case of a 429 (RateLimitError)
async function makeRequestWithRetry(
  api,
  requestData,
  retries = 3,
  delay = 1000
) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await api.chat.completions.create(requestData);
      return response;
    } catch (error) {
      if (error.status === 429) {
        console.log(
          `Rate limit hit. Waiting for ${delay}ms before retrying...`
        );
        await wait(delay);
        delay *= 2; // use to increase delay after each retry
      } else {
        throw error; // Re-throw error if it's not a rate limit error
      }
    }
  }
  throw new Error("Max retries reached. Could not complete the request.");
}

app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    let extractedText = "";

    if (file.mimetype === "text/plain") {
      extractedText = await fs.promises.readFile(file.path, "utf-8");
    } else if (file.mimetype === "application/pdf") {
      const dataBuffer = await fs.promises.readFile(file.path);
      const pdfData = await pdf(dataBuffer);
      extractedText = pdfData.text;
    } else {
      return res
        .status(400)
        .json({ message: "Unsupported file type. Upload a text or PDF file." });
    }

    // Delete the uploaded file after reading it(upload folder)
    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
    });

    console.log("Extracted Text:", extractedText);

    const systemPrompt =
      "You are an expert interview assistant specialized in generating personalized interview questions and answers based on resumes. Your goal is to help candidates prepare for interviews by crafting thoughtful, tailored questions that focus on their key skills, experiences, and achievements.";

    // const userPrompt = `Using the provided resume information, generate 10-15 interview questions that are specific to their role, skills, experiences, and achievements. For each question, provide a detailed, personalized answer that reflects their background, aligning with industry standards and best practices. Resume Information: ${extractedText}`;

    const userPrompt = `Using the provided resume information, generate 10-15 interview questions and answers tailored to the candidate's role, skills, experiences, and achievements. Resume Information: ${extractedText}`;

    const requestData = {
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      // model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 512,
    };

    // Call the API with retry logic to handle rate limits
    const completion = await makeRequestWithRetry(aiml, requestData);

    const generatedText = completion.choices[0].message.content;
    res.status(200).json({ generatedText });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
    console.error("Error processing file:", error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
