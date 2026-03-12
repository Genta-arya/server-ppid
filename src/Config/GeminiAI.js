import { GoogleGenerativeAI } from "@google/generative-ai";

const key =
  process.env.GEMINI_API_KEY || "AIzaSyDG32JaoVRJHv594wbfWj2zBtWO_6TzHTo";

if (!key) {
  console.warn("GEMINI_API_KEY is not set. Gemini AI features will not work.");
}
const genAI = new GoogleGenerativeAI(key);

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
});


export { model };
