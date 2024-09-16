const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const cors = require("cors");
const { OpenAI } = require("openai");
const { default: axios } = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const port = 8000;

app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

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

// GOOGLE GEMINI API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeRequestWithRetry(
  api,
  requestData,
  retries = 5,
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
      extractedText = file.buffer.toString("utf-8");
    } else if (file.mimetype === "application/pdf") {
      const pdfData = await pdf(file.buffer);
      extractedText = pdfData.text;
    } else {
      return res
        .status(400)
        .json({ message: "Unsupported file type. Upload a text or PDF file." });
    }

    console.log("Extracted Text:", extractedText);

    const systemPrompt =
      "You are an expert interview assistant specialized in generating personalized interview questions and answers based on resumes. Your goal is to help candidates prepare for interviews by crafting thoughtful, tailored questions that focus on their key skills, experiences, and achievements.";

    const userPrompt = `Using the provided resume information, generate 10-15 interview questions and answers tailored to the candidate's role, skills, experiences, and achievements. Resume Information: ${extractedText}`;

    const prompt = `You will be provided with text delimited by triple dashs.If it contains a sequence of instructions,re-write those instructions in the following format:

1.Question:....

Answer:....

--- ${userPrompt} ---`;

    const requestData = {
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      // model: "zero-one-ai/Yi-34B-Chat",
      // model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
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

app.post("/uploadAxios", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    let extractedText = "";

    if (file.mimetype === "text/plain") {
      extractedText = file.buffer.toString("utf-8");
    } else if (file.mimetype === "application/pdf") {
      const pdfData = await pdf(file.buffer);
      extractedText = pdfData.text;
    } else {
      return res
        .status(400)
        .json({ message: "Unsupported file type. Upload a text or PDF file." });
    }

    console.log("Extracted Text:", extractedText);

    const systemPrompt =
      "You are an expert interview assistant specialized in generating personalized interview questions and answers based on resumes. Your goal is to help candidates prepare for interviews by crafting thoughtful, tailored questions that focus on their key skills, experiences, and achievements.";

    const userPrompt = `Using the provided resume information, generate 10-15 interview questions and answers tailored to the candidate's role, skills, experiences, and achievements. Resume Information: ${extractedText}`;

    const prompt = `You will be provided with text delimited by triple dashs.If it contains a sequence of instructions,re-write those instructions in the following format:

1.Question:....

Answer:....

--- ${userPrompt} ---`;

    try {
      const response = await axios.post(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
        {
          inputs: prompt,
          parameters: {
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 512,
            temperature: 0.1,
          },
        },
        {
          headers: {
            Authorization: `Bearer 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`,
          },
        }
      );

      const generatedText = response.data[0].generated_text;
      console.log("response", response.data);
      console.log("generatedText", generatedText);
      res.status(200).json({ generatedText });
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
    console.error("Error processing file:", error);
  }
});

app.post("/uploadGoogle", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    let extractedText = "";

    if (file.mimetype === "text/plain") {
      extractedText = file.buffer.toString("utf-8");
    } else if (file.mimetype === "application/pdf") {
      const pdfData = await pdf(file.buffer);
      extractedText = pdfData.text;
    } else {
      return res
        .status(400)
        .json({ message: "Unsupported file type. Upload a text or PDF file." });
    }

    console.log("Extracted Text:", extractedText);

    const userPrompt = `Using the provided resume information, generate 10-15 interview questions and answers tailored to the candidate's role, skills, experiences, and achievements. Resume Information: ${extractedText}`;

    const prompt = `You will be provided with text delimited by triple dashs.If it contains a sequence of instructions,re-write those instructions in the following format:

1.Question:....

Answer:....

--- ${userPrompt} ---`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.1,
      },
    });
    const generatedText = result.response.text();
    console.log("google", generatedText);
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
