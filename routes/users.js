const express = require("express");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const ClothingItem = require("../models/ClothingItem");
const passport = require("../config/passport");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

/*
  GET /register
  显示注册页面
*/
router.get("/register", (req, res) => {
  // 已登录用户不需要再次注册
  if (req.session.user) {
    return res.redirect("/");
  }

  res.render("auth/register", {
    error: null,
    values: {
      username: "",
      email: ""
    }
  });
});

/*
  POST /register
  处理注册
*/
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmPassword
    } = req.body;

    const cleanedUsername =
      username ? username.trim() : "";

    const cleanedEmail =
      email ? email.trim().toLowerCase() : "";

    // 检查是否填写完整
    if (
      !cleanedUsername ||
      !cleanedEmail ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).render("auth/register", {
        error: "Please complete all fields.",
        values: {
          username: cleanedUsername,
          email: cleanedEmail
        }
      });
    }

    // 新增：检查邮箱格式
    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanedEmail)) {
      return res.status(400).render("auth/register", {
        error: "Please enter a valid email address.",
        values: {
          username: cleanedUsername,
          email: cleanedEmail
        }
      });
    }

    // 检查用户名长度
    if (
      cleanedUsername.length < 2 ||
      cleanedUsername.length > 30
    ) {
      return res.status(400).render("auth/register", {
        error:
          "Username must contain between 2 and 30 characters.",
        values: {
          username: cleanedUsername,
          email: cleanedEmail
        }
      });
    }

    // 检查密码是否一致
    if (password !== confirmPassword) {
      return res.status(400).render("auth/register", {
        error: "The two passwords do not match.",
        values: {
          username: cleanedUsername,
          email: cleanedEmail
        }
      });
    }

    // 检查密码长度
    if (password.length < 6) {
      return res.status(400).render("auth/register", {
        error:
          "Password must contain at least 6 characters.",
        values: {
          username: cleanedUsername,
          email: cleanedEmail
        }
      });
    }

    // 检查用户名或邮箱是否已存在
    const existingUser = await User.findOne({
      $or: [
        { username: cleanedUsername },
        { email: cleanedEmail }
      ]
    });

    if (existingUser) {
      let errorMessage =
        "The username or email is already registered.";

      if (existingUser.username === cleanedUsername) {
        errorMessage = "This username is already in use.";
      } else if (existingUser.email === cleanedEmail) {
        errorMessage = "This email is already registered.";
      }

      return res.status(400).render("auth/register", {
        error: errorMessage,
        values: {
          username: cleanedUsername,
          email: cleanedEmail
        }
      });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 保存用户
    await User.create({
      username: cleanedUsername,
      email: cleanedEmail,
      password: hashedPassword
    });

    // 注册完成后前往登录页面
    return res.redirect("/login?registered=1");
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(400).render("auth/register", {
        error:
          "The username or email is already registered.",
        values: {
          username: req.body.username || "",
          email: req.body.email || ""
        }
      });
    }

    return res.status(500).render("auth/register", {
      error: "Registration failed. Please try again.",
      values: {
        username: req.body.username || "",
        email: req.body.email || ""
      }
    });
  }
});

/*
  GET /login
  显示登录页面
*/
router.get("/login", (req, res) => {
  // 已登录用户不需要再次登录
  if (req.session.user) {
    return res.redirect("/");
  }

  res.render("auth/login", {
    error: null,
    registered: req.query.registered === "1",
    values: {
      email: ""
    }
  });
});

/*
  GET /auth/google
  进入 Google 登录页面
*/
router.get("/auth/google",passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })
);

/*
  POST /login
  处理邮箱和密码登录
*/
router.post("/login", async (req, res, next) => {
  try {
    const email =
      req.body.email
        ? req.body.email.trim().toLowerCase()
        : "";

    const password = req.body.password || "";

    // 检查是否填写
    if (!email || !password) {
      return res.status(400).render("auth/login", {
        error: "Please enter your email and password.",
        registered: false,
        values: {
          email
        }
      });
    }

    // 根据邮箱查找用户
    const user = await User.findOne({ email });

    // 邮箱不存在时使用相同的错误信息
    if (!user) {
      return res.status(401).render("auth/login", {
        error: "Invalid email or password.",
        registered: false,
        values: {
          email
        }
      });
    }

    // 比较明文密码和数据库中的 bcrypt 哈希
    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).render("auth/login", {
        error: "Invalid email or password.",
        registered: false,
        values: {
          email
        }
      });
    }
    

    // 登录成功后重新生成 Session
    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      // Session 中只保存必要的用户信息
      req.session.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl || ""
      };

      // 保存 Session 后再跳转
      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.redirect("/");
      });
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).render("auth/login", {
      error: "Login failed. Please try again.",
      registered: false,
      values: {
        email: req.body.email || ""
      }
    });
  }
});

/*
  POST /logout
  退出登录
*/
router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("closet.sid");

    return res.redirect("/");
  });
});

/*
  GET /auth/google/callback
  Google 登录完成后的回调
*/
router.get("/auth/google/callback",passport.authenticate("google", {
    failureRedirect: "/login",
    session: false
  }),

  (req, res, next) => {
    // 重新生成 Session
    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      // 使用和普通登录相同的 Session 结构
      req.session.user = {
        id: req.user._id.toString(),
        username: req.user.username,
        email: req.user.email,
        avatarUrl: req.user.avatarUrl || ""
      };

      // 保存 Session 后返回首页
      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.redirect("/");
      });
    });
  }
);

/*
  GET /profile
  必须登录才能访问
*/
router.get("/profile", requireLogin, async (req, res) => {
  try {
    // 根据 Session 中的用户 ID 查询完整用户资料
    const user = await User.findById(req.session.user.id).select("-password -googleId");

    if (!user) {
      return res.status(404).send("User not found.");
    }

    // 查询当前用户发布的所有衣服
    const items = await ClothingItem.find({
      ownerId: user._id
    }).sort({
      createdAt: -1
    });

    // 将完整用户资料和发布的衣服传给 profile.ejs
    return res.render("auth/profile", {
      user: user,
      items: items
    });
  } catch (error) {
    console.error("Failed to load profile:", error);

    return res
      .status(500)
      .send("Unable to load profile.");
  }
});

/*
  GET /profile/edit
  显示编辑个人资料页面
*/
router.get("/profile/edit", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(
      req.session.user.id
    ).select("-password -googleId");

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res.render("auth/edit-profile", {
      user,
      error: null
    });
  } catch (error) {
    console.error(
      "Failed to open profile edit page:",
      error
    );

    return res
      .status(500)
      .send("Unable to open profile edit page.");
  }
});

/*
  PUT /profile
  保存用户修改后的个人资料
*/
router.put("/profile",requireLogin,async (req, res) => {
    try {
      const user = await User.findById(
        req.session.user.id
      ).select("-password -googleId");

      if (!user) {
        return res
          .status(404)
          .send("User not found.");
      }

      // 保存头像链接
      user.avatarUrl = req.body.avatarUrl
        ? req.body.avatarUrl.trim()
        : "";

      // 保存个人简介
      user.bio = req.body.bio
        ? req.body.bio.trim()
        : "";

      // 保存常用尺码
      user.usualSize =
        req.body.usualSize || "";

      // 保存喜欢的风格
      user.preferredStyle =
        req.body.preferredStyle
          ? req.body.preferredStyle.trim()
          : "";

      await user.save();

      return res.redirect("/profile");
    } catch (error) {
      console.error(
        "Failed to update profile:",
        error
      );

      return res
        .status(400)
        .send(error.message);
    }
  }
);

/*
  GET /dashboard
  必须登录才能访问
*/
router.get("/dashboard", requireLogin, (req, res) => {
  res.render("auth/dashboard", {
    user: req.session.user
  });
});

module.exports = router;