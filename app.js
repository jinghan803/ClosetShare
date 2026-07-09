const express = require("express");//创建服务器接口

const mongoose = require("mongoose");//引入mongoose模块
const path = require("path");//Node.js 的 path 模块提供了一些用于处理文件路径的小工具

const app = express();//创建服务对象
const PORT = 3000;//端口是什么

const itemRoutes = require("./routes/items");
const methodOverride = require("method-override");//引入method-override模块
const userRoutes = require("./routes/users");
const session = require("express-session");
const passport = require("./config/passport");
const requestRoutes = require("./routes/requests");
const reviewRoutes = require("./routes/reviews");

require("dotenv").config();//引入dotenv模块，读取.env文件中的环境变量

// 检查 Session 密钥
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from .env");
}

// 设置 EJS 模板引擎
app.set("view engine", "ejs");//所有的渲染使用的是ejs引擎
app.set("views", path.join(__dirname, "views"));

// 允许访问 public 文件夹
app.use(express.static(path.join(__dirname, "public")));

//表单解析
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 允许使用 put 和 delete
app.use(methodOverride("_method"));

const isProduction =
  process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

// Session 配置
app.use(
  session({
    name: "closet.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",

      // 登录状态保留 24 小时
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

// 初始化 Passport
app.use(passport.initialize());
//不需要添加section中间件，因为我们使用的是无状态的 Google 登录

// 将当前登录用户提供给所有 EJS 页面
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// 首页路由
app.get("/", (req, res) => {
  res.render("index");
});

app.use("/", userRoutes);
app.use("/items", itemRoutes);
app.use("/requests", requestRoutes);
app.use("/reviews", reviewRoutes);


// 没有匹配到任何路由
app.use((req, res) => {
  return res.status(404).render("errors/error", {
    statusCode: 404,
    title: "Page Not Found",
    message: "The page you requested does not exist."
  });
});

// 未被路由 catch 处理的服务器错误
app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  return res.status(500).render("errors/error", {
    statusCode: 500,
    title: "Server Error",
    message:
      "Something went wrong. Please try again later."
  });
});
// 启动服务器
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully.");

    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server is running at http://localhost:${process.env.PORT || 3000}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);
  }
}



startServer();

// 添加新的路由器
// 衣服列表
/*app.get("/items", (req, res) => {
	res.render("items/list");
})

// 发布衣服页面
app.get("/items/new", (req, res) => {
  res.render("items/create");
});
*/
/*//测试
app.post("/items", (req, res) => {
    console.log(req.body);

    res.send("Clothing posted successfully!");
});
*/
/*
// 登录页面
app.get("/login", (req, res) => {
  res.render("auth/login");
});

// 注册页面
app.get("/register", (req, res) => {
  res.render("auth/register");
});
*/