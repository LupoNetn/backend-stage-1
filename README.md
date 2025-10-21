# 🧠 String Analyzer API

A simple RESTful API built with **Node.js**, **Express**, and **Prisma** to analyze and store strings along with their computed properties such as character frequency, word count, palindrome status, and more.

---

## 🚀 Features

* Add new strings with computed properties.
* Fetch all strings stored in the database.
* Retrieve detailed information about a specific string.
* Delete strings by value.
* Perform **natural language filtering** like:

  * `all single word palindromic strings`
  * `all multi word strings`
  * `all strings with more than 10 characters`
* Uses **Prisma ORM** and **SQLite/PostgreSQL** for database handling.

---

## 🧩 Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** Prisma ORM (SQLite/PostgreSQL)
* **Language:** JavaScript (ESM)
* **Environment:** dotenv
* **Utilities:** crypto, CORS

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/string-analyzer-api.git
cd string-analyzer-api
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Configure environment variables

Create a `.env` file in the project root and add:

```env
DATABASE_URL="file:./dev.db"   # For SQLite
PORT=5000
```

### 4️⃣ Setup Prisma and database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5️⃣ Start the development server

```bash
npm run dev
```

The server should start on:

```
http://localhost:5000
```

---

## 🧠 API Endpoints

### 1️⃣ Add a String

**POST** `/strings`

#### Request Body:

```json
{
  "string_value": "racecar"
}
```

#### Response:

```json
{
  "message": "String added successfully",
  "data": {
    "id": 1,
    "string_value": "racecar",
    "length": 7,
    "is_palindrome": true,
    "character_frequency": {
      "r": 2,
      "a": 2,
      "c": 2,
      "e": 1
    }
  }
}
```

---

### 2️⃣ Get All Strings

**GET** `/strings`

#### Response:

```json
{
  "count": 3,
  "data": [
    { "string_value": "racecar", "is_palindrome": true },
    { "string_value": "hello", "is_palindrome": false },
    { "string_value": "madam", "is_palindrome": true }
  ]
}
```

---

### 3️⃣ Get a Specific String

**GET** `/strings/:string_value`

#### Example:

```
GET /strings/hello
```

#### Response:

```json
{
  "string_value": "hello",
  "length": 5,
  "word_count": 1,
  "is_palindrome": false,
  "character_frequency": {
    "h": 1,
    "e": 1,
    "l": 2,
    "o": 1
  }
}
```

---

### 4️⃣ Delete a String

**DELETE** `/strings/:string_value`

#### Example:

```
DELETE /strings/racecar
```

#### Response:

```json
{
  "message": "String deleted successfully"
}
```

---

### 5️⃣ Filter by Natural Language

**GET** `/strings/filter-by-natural-language?query={query}`

#### Example Query:

```
GET /strings/filter-by-natural-language?query=all single word palindromic strings
```

#### Possible Queries:

* `all single word palindromic strings`
* `all multi word strings`
* `all strings with more than 10 characters`
* `all palindromic strings`
* `all strings with fewer than 5 characters`

#### Response:

```json
{
  "results": [
    {
      "string_value": "madam",
      "is_palindrome": true
    },
    {
      "string_value": "level",
      "is_palindrome": true
    }
  ]
}
```

---

## 🧮 Utility Function

A helper function computes the frequency of each character in a string:

const characterFrequency = (value) => {
  const data = value.toLowerCase();
  const frequency = {};
  for (const char of data) frequency[char] = (frequency[char] || 0) + 1;
  return frequency;
};


## 📁 Project Structure


📦 string-analyzer-api
├── prisma/
│   ├── schema.prisma
├── db.js
├── server.js
├── package.json
├── .env
└── README.md


## 🧪 Example Prisma Schema
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model StringData {
  id                  Int      @id @default(autoincrement())
  string_value        String   @unique
  length              Int
  word_count          Int
  is_palindrome       Boolean
  character_frequency Json
  createdAt           DateTime @default(now())
}

