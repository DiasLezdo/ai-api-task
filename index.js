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

// open ai

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ai/ml

// const aiml = new OpenAI({
//   apiKey: process.env.TEMP_KEY,
//   baseURL: "https://api.aimlapi.com/v1",
// });

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

    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
    });

    console.log("first", extractedText);

    // ------------------------OPEN  AI-------------------------

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an interview questions and answer Generator.Provide tailored answers based on their resume",
        },
        {
          role: "user",
          content: `Generate 10-15 interview questions and answers related to their experience, achievements, and skills.Provide tailored answers based on their resume. Resume: ${extractedText}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const generatedText = gptResponse.choices[0].message.content;
    res.status(200).json({ generatedText });

    // -------------------------------------AI/ML------------------------

    // const systemPrompt =
    //   "You are an expert interview assistant specialized in generating personalized interview questions and answers based on resumes. Your goal is to help candidates prepare for interviews by crafting thoughtful, tailored questions that focus on their key skills, experiences, and achievements.";

    // const userPrompt = `Using the provided resume information, generate 10-15 interview questions that are specific to their role, skills, experiences, and achievements. For each question, provide a detailed, personalized answer that reflects their background, aligning with industry standards and best practices. Resume Information: ${extractedText}`;

    // // const userPrompt = `Using the provided resume information, generate 10-15 interview questions tailored to the candidate's role, skills, experiences, and achievements. Format it in a way where each answer directly follows its respective question without labeling them as "Question" or "Answer." Resume Information: ${extractedText}`;

    // const completion = await aiml.chat.completions.create({
    //   model: "mistralai/Mistral-7B-Instruct-v0.2",
    //   messages: [
    //     {
    //       role: "system",
    //       content: systemPrompt,
    //     },
    //     {
    //       role: "user",
    //       content: userPrompt,
    //     },
    //   ],
    //   temperature: 0.7,
    //   max_tokens: 256,
    // });

    // const generatedText = completion.choices[0].message.content;
    // // const generatedText = gptResponse.choices[0].message.content;
    // res.status(200).json({ generatedText });

    // ---------------------------------------------HUG free--------------------------------

    // const prompt = `Generate 10-15 interview questions related to their experience, achievements, and skills.Provide tailored answers based on their resume. Resume: ${extractedText}`;

    // try {
    //   const response = await axios.post(
    //     "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
    //     {
    //       inputs: prompt,
    //     },
    //     {
    //       headers: {
    //         Authorization: `Bearer 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`,
    //       },
    //     }
    //   );
    //   console.log("first", response.data);
    //   res.status(200).json({ generatedText: response.data[0]?.generated_text });
    // } catch (e) {
    //   console.error("Error making API request:", e);
    //   return res.status(500).json({ message: "Error making API request" });
    // }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error processing file", error: error?.message });
    console.error("Error processing file:", error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
