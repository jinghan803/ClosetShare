const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    borrowRequestId: {//所属借阅请求id
      type: mongoose.Schema.Types.ObjectId,
      ref: "BorrowRequest",
      required: true,
      index: true
    },

    senderId: {//发送者id
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    message: {//聊天内容
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  {
    timestamps: true//自动添加创建时间和更新时间
  }
);

module.exports = mongoose.model(
  "ChatMessage",//1模型名称
  chatMessageSchema//2模型Schema
);