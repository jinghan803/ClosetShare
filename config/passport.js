require("dotenv").config();

const passport = require("passport");

const GoogleStrategy =
  require("passport-google-oauth20").Strategy;

const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,

      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET,

      callbackURL:
        process.env.GOOGLE_CALLBACK_URL
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        // 获取 Google 账户邮箱
        const email =
          profile.emails &&
          profile.emails[0]
            ? profile.emails[0].value.toLowerCase()
            : "";

        if (!email) {
          return done(
            new Error(
              "Google account did not provide an email."
            )
          );
        }

        // 先根据 Google ID 查找用户
        let user = await User.findOne({
          googleId: profile.id
        });

        if (user) {
          return done(null, user);
        }

        // 检查是否已经有相同邮箱的普通账户
        user = await User.findOne({ email });

        if (user) {
          // 将 Google 账户关联到原来的账户
          user.googleId = profile.id;

          // 原账户没有头像时，使用 Google 头像
          if (
            !user.avatarUrl &&
            profile.photos &&
            profile.photos[0]
          ) {
            user.avatarUrl =
              profile.photos[0].value;
          }

          await user.save();

          return done(null, user);
        }

        // 根据邮箱生成用户名
        let baseUsername =
          email.split("@")[0];

        baseUsername = baseUsername
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 24);

        if (!baseUsername) {
          baseUsername = "googleuser";
        }

        let username = baseUsername;
        let number = 1;

        // 防止用户名重复
        while (
          await User.exists({ username })
        ) {
          username =
            `${baseUsername}${number}`;

          number += 1;
        }

        // 获取 Google 头像
        const avatarUrl =
          profile.photos &&
          profile.photos[0]
            ? profile.photos[0].value
            : "";

        // 创建新的 Google 用户
        user = await User.create({
          username,
          email,
          googleId: profile.id,
          avatarUrl
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

module.exports = passport;