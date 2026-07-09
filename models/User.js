const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,//该字段不可以为空
      unique: true,//用户名唯一
      trim: true//会删除用户输入内容时出现的空格
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true//自动转为小写
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true//允许空值
    },

    password: {
      type: String,
      // 普通注册用户必须有密码，Google 用户不需要
      required: function () {
        return !this.googleId;
      }
    },

    // 新增：添加一个字段来存储用户的头像 URL
    avatarUrl: {
      type: String,
      trim: true,
      default: ""
    },

    // 新增：添加一个字段来存储用户的个人简介
    bio: {
      type: String,
      trim: true,
      maxlength: 500,//限制最大长度为500个字符
      default: ""
    },

    //新增：添加用户常用的尺码信息
    usualSize: {
      type: String,
      enum: [
        "",
        "XXS",
        "XS",
        "S",
        "M",
        "L",
        "XL",
        "XXL",
        "XXXL",
        "One Size"
      ],
      default: ""
    },

    // 用户喜欢的穿衣风格
    preferredStyle: {
      type: String,
      trim: true,
      maxlength: 50,//限制最大长度为50个字符
      default: ""
    },

    // 用户平均评分
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },

    // 用户收到评分的数量
    ratingCount: {
      type: Number,
      min: 0,
      default: 0
    },

  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;