const mongoose = require("mongoose");

// 借用请求模型
const borrowRequestSchema = new mongoose.Schema(
  {
    // 申请借用衣服的用户
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 被借用的衣服
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClothingItem",
      required: true,
    },

    // 衣服发布者
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 借用开始日期
    startDate: {
      type: Date,
      required: true,
    },

    // 借用结束日期
    endDate: {
      type: Date,
      required: true,
    },

    // 申请者留言
    message: {
      type: String,
      required: true,
      maxlength: 500,
      default: "",
    },

    // 申请状态
    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Rejected",
        "Completed"
      ],
      default: "Pending",
    },

    /*
      新增：衣服快照

      作用：
      即使原来的 ClothingItem 被删除，
      Borrow Request 页面仍然可以显示当时借用的衣服内容。
    */
    itemSnapshot: {
      title: {
        type: String,
        default: "",
      },

      description: {
        type: String,
        default: "",
      },

      category: {
        type: String,
        default: "",
      },

      size: {
        type: String,
        default: "",
      },

      color: {
        type: String,
        default: "",
      },

      brand: {
        type: String,
        default: "",
      },

      condition: {
        type: String,
        default: "",
      },

      imageUrl: {
        type: String,
        default: "",
      },

      rentalPrice: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

const BorrowRequest = mongoose.model(
  "BorrowRequest",
  borrowRequestSchema
);

module.exports = BorrowRequest;