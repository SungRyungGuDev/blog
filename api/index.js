const express = require("express");
const app = express();
const cors = require("cors");
const port = 4000;

app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json());

// connect to database
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
mongoose
  .connect(
    "mongodb+srv://ryan:qwer1234@cluster0.r17mj2j.mongodb.net/Blog?retryWrites=true&w=majority"
  )
  .then(() => {
    console.log("Database connection established");
  })
  .catch((err) => {
    console.log("Error connecting to database: " + err.message);
  });

// receive UserSchema for using and storing schema in database
const User = require("./models/User");

// create a hashed password we need to bcryptjs
const bcrypt = require("bcryptjs");
// generate salt for combination with password
const salt = bcrypt.genSaltSync(10);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  // one of the functions of mongoose 'create for making new user in database
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (err) {
    res.status(400).json(err);
  }
});

// jsonwebtoken
const jwt = require("jsonwebtoken");
const secret = "ryan";

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  // by using the findOne function, can find one specific user in the database
  const userDoc = await User.findOne({ username });
  // in userDoc, that password already was hashed
  // we need to compare the password with the hashed password
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in successfully After login, need to create token
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json("Wrong credentials");
  }
});

// After login, need to check if user already have credentials
// with middleware cookieParser, can check this

const cookieParser = require("cookie-parser");
app.use(cookieParser());

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  // this token is also combined with secret word so we need to verify this
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

// logout function

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

// create a new post
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const Post = require("./models/Post");

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
    });
    res.json(postDoc);
  });
});

// edit my posts
app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
  let newPath = null;
  if (req.file) {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path+'.'+ext;
    fs.renameSync(path, newPath);
  }

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });

});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createAt: -1 })
      .limit(20)
  );
});

// using upload file
app.use("/uploads", express.static(__dirname + "/uploads"));

app.get("/post/:id", async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
