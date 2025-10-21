import express from "express";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./db.js";
dotenv.config();

const app = express();
const port = process.env.PORT;

//middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//utility mapping function
const characterFrequency = (value) => {
  const data = value.toLowerCase();
  const frequency = {};

  for (const char of data) {
    frequency[char] = (frequency[char] || 0) + 1;
  }

  return frequency;
};

//routes

//natural language query endpoint
app.get("/strings/filter-by-natural-language", async (req, res) => {
  try {
    const { query } = req.query;

    // 1️⃣ Validate query existence
    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: "Missing or invalid 'query' parameter in request",
      });
    }

    const q = query.toLowerCase().trim();
    const parsedFilters = {};

    // 2️⃣ Parse filters
    if (q.includes("palindromic") || q.includes("palindrome"))
      parsedFilters.is_palindrome = true;

    if (q.includes("single word")) parsedFilters.word_count = 1;
    if (q.includes("two words")) parsedFilters.word_count = 2;
    if (q.includes("three words")) parsedFilters.word_count = 3;

    const longerMatch = q.match(/longer than (\d+) characters?/);
    if (longerMatch) parsedFilters.min_length = parseInt(longerMatch[1]) + 1;

    const shorterMatch = q.match(/shorter than (\d+) characters?/);
    if (shorterMatch) parsedFilters.max_length = parseInt(shorterMatch[1]) - 1;

    const containsMatch =
      q.match(/containing the letter (\w)/) || q.match(/letter ([a-z])/);
    if (containsMatch) parsedFilters.contains_character = containsMatch[1];

    if (q.includes("first vowel")) parsedFilters.contains_character = "a";
    if (q.includes("contains z")) parsedFilters.contains_character = "z";

    if (q.includes("vowel palindrome")) {
      parsedFilters.is_palindrome = true;
      parsedFilters.contains_character = "a";
    }

    // 3️⃣ Handle no recognized filter
    if (Object.keys(parsedFilters).length === 0) {
      return res
        .status(400)
        .json({ message: "Unable to parse natural language query" });
    }

    // 4️⃣ Handle conflicts
    if (q.includes("palindromic") && q.includes("non-palindromic")) {
      return res.status(422).json({
        message: "Query parsed but resulted in conflicting filters",
      });
    }

    // 5️⃣ Build Prisma filters
    const filters = {};
    const propertiesFilter = {};

    if (parsedFilters.is_palindrome !== undefined)
      propertiesFilter.is_palindrome = parsedFilters.is_palindrome;

    if (parsedFilters.word_count !== undefined)
      propertiesFilter.word_count = parsedFilters.word_count;

    if (parsedFilters.min_length)
      propertiesFilter.length = { gte: parsedFilters.min_length };

    if (parsedFilters.max_length)
      propertiesFilter.length = {
        ...(propertiesFilter.length || {}),
        lte: parsedFilters.max_length,
      };

    if (parsedFilters.contains_character)
      filters.value = {
        contains: parsedFilters.contains_character,
        mode: "insensitive",
      };

    // 6️⃣ Fetch from DB (fixed nested relation filter)
    const results = await prisma.data.findMany({
      where: {
        ...filters,
        properties: {
          is: { ...propertiesFilter },
        },
      },
      include: { properties: true },
      orderBy: { created_at: "desc" },
    });

    // 7️⃣ Response
    return res.status(200).json({
      data: results,
      count: results.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
    });
  } catch (error) {
    console.error("❌ Error in natural language filter:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

//create value endpoint
app.post("/strings", async (req, res) => {
  const { value } = req.body;

  // 1. Validate request
  if (!value) {
    return res.status(400).json({
      message: 'Invalid request body or missing "value" field',
    });
  }

  if (typeof value !== "string") {
    return res.status(422).json({
      message: 'Invalid data type for "value" (must be string)',
    });
  }

  // 2. Check if already exists
  const existingValue = await prisma.data.findUnique({ where: { value } });
  if (existingValue) {
    return res.status(409).json({
      message: "String already exists in the system",
    });
  }

  try {
    // 3. Compute properties
    const sha256_hash = crypto.createHash("sha256").update(value).digest("hex");
    const length = value.length;

    const normalized = value.toLowerCase().replace(/\s+/g, "");
    const is_palindrome =
      normalized === normalized.split("").reverse().join("");

    const unique_characters = new Set(value).size;
    const word_count =
      value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
    const frequency_map = characterFrequency(value);

    // 4. Save to DB
    const data = await prisma.data.create({
      data: {
        id: sha256_hash,
        value,
        properties: {
          create: {
            length,
            is_palindrome,
            unique_characters,
            word_count,
            sha256_hash,
            character_frequency_map: frequency_map,
          },
        },
        created_at: new Date(),
      },
      include: { properties: true },
    });

    // 5. Respond
    res.status(201).json({
      id: data.id,
      value: data.value,
      properties: data.properties,
      created_at: data.created_at.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

//filter query endpoint
app.get("/strings", async (req, res) => {
  try {
    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character,
    } = req.query;

    if (
      (is_palindrome && !["true", "false"].includes(is_palindrome)) ||
      (min_length && isNaN(parseInt(min_length))) ||
      (max_length && isNaN(parseInt(max_length))) ||
      (word_count && isNaN(parseInt(word_count))) ||
      (contains_character && contains_character.length !== 1)
    ) {
      return res.status(400).json({
        message: "Invalid query parameter values or types",
      });
    }

    const filters = {};
    const propertiesFilter = {};

    if (is_palindrome) {
      propertiesFilter.is_palindrome = is_palindrome === "true";
    }

    if (min_length) {
      propertiesFilter.length = { gte: parseInt(min_length) };
    }

    if (max_length) {
      propertiesFilter.length = {
        ...propertiesFilter.length,
        lte: parseInt(max_length),
      };
    }

    if (word_count) {
      propertiesFilter.word_count = parseInt(word_count);
    }

    if (contains_character) {
      filters.value = { contains: contains_character, mode: "insensitive" };
    }

    const data = await prisma.data.findMany({
      where: {
        ...filters,
        properties: { ...propertiesFilter },
      },
      include: { properties: true },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      data,
      count: data.length,
      filters_applied: {
        ...(is_palindrome && { is_palindrome: is_palindrome === "true" }),
        ...(min_length && { min_length: parseInt(min_length) }),
        ...(max_length && { max_length: parseInt(max_length) }),
        ...(word_count && { word_count: parseInt(word_count) }),
        ...(contains_character && { contains_character }),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

//value query endpoint
app.get("/strings/:string_value", async (req, res) => {
  const { string_value } = req.params;

  try {
    const data = await prisma.data.findUnique({
      where: { value: string_value },
      include: { properties: true },
    });

    if (!data) {
      return res.status(404).json({
        message: "string does not exist in the system",
      });
    }

    res.status(200).json({
      id: data.id,
      value: data.value,
      properties: data.properties,
      created_at: data.created_at,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

//delete query endpoint
app.delete("/strings/:string_value", async (req, res) => {
  try {
    const { string_value } = req.params;

    // 🔍 Check if the string exists
    const stringExists = await prisma.data.findUnique({
      where: { value: string_value },
    });

    if (!stringExists) {
      return res.status(404).json({
        message: "String does not exist in the system",
      });
    }

    // 🗑️ Delete the record
    await prisma.data.delete({
      where: { value: string_value },
    });

    // ✅ Return 204 No Content (empty body)
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});


app.listen(port, (err) => {
  if (err) return console.log(`something went wrong: ${err}`);

  console.log(`Server running on port: ${port}`);
});
