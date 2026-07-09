const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // 对应哪一次借用申请
    borrowRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BorrowRequest",
      required: true,
      unique: true
    },

    // 写评价的用户
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // 被评价的衣服
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClothingItem",
      required: true
    },

    // 1 到 5 星
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },

    // 评论内容
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

const Review = mongoose.model(
  "Review",
  reviewSchema
);

module.exports = Review;