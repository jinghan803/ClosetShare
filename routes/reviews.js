const express = require("express");

const Review = require("../models/Review");
const BorrowRequest = require("../models/BorrowRequest");
const ClothingItem = require("../models/ClothingItem");

const {
  requireLogin
} = require("../middleware/auth");

const router = express.Router();

/*
  重新计算一件衣服的平均评分和评论数量
*/
async function updateItemRating(itemId) {
  const reviews = await Review.find({
    itemId
  }).select("rating");

  const ratingCount = reviews.length;

  let averageRating = 0;

  if (ratingCount > 0) {
    const totalRating = reviews.reduce(
      (total, review) => {
        return total + review.rating;
      },
      0
    );

    averageRating = totalRating / ratingCount;
  }

  await ClothingItem.findByIdAndUpdate(
    itemId,
    {
      averageRating: Number(
        averageRating.toFixed(2)
      ),
      ratingCount
    },
    {
      runValidators: true
    }
  );
}

/*
  GET /reviews/new/:requestId
  显示评价页面
*/
router.get(
  "/new/:requestId",
  requireLogin,
  async (req, res) => {
    try {
      const borrowRequest =
        await BorrowRequest.findById(
          req.params.requestId
        ).populate("itemId");

      if (!borrowRequest) {
        return res
          .status(404)
          .send("Borrow request not found.");
      }

      // 只有申请人本人可以评价
      if (
        !borrowRequest.requesterId ||
        borrowRequest.requesterId.toString() !==
          req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You are not allowed to review this borrowing."
          );
      }

      // 不能评价自己的衣服
      if (
        borrowRequest.ownerId &&
        borrowRequest.ownerId.toString() ===
          req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You cannot review your own clothing item."
          );
      }

      // 必须完成借用后才能评价
      if (borrowRequest.status !== "Completed") {
        return res
          .status(400)
          .send(
            "You can only review a completed borrowing."
          );
      }

      // 衣服可能已经被删除
      if (!borrowRequest.itemId) {
        return res
          .status(404)
          .send("Clothing item not found.");
      }

      // 检查是否已经评价过
      const existingReview =
        await Review.findOne({
          borrowRequestId: borrowRequest._id
        });

      if (existingReview) {
        return res
          .status(400)
          .send(
            "You have already reviewed this borrowing."
          );
      }

      return res.render("reviews/new", {
        borrowRequest,
        item: borrowRequest.itemId,
        error: null,
        values: {
          rating: "",
          comment: ""
        }
      });
    } catch (error) {
      console.error(
        "Failed to open review page:",
        error
      );

      return res
        .status(400)
        .send("Unable to open review page.");
    }
  }
);

/*
  POST /reviews/:requestId
  保存评分和评论
*/
router.post(
  "/:requestId",
  requireLogin,
  async (req, res) => {
    try {
      const borrowRequest =
        await BorrowRequest.findById(
          req.params.requestId
        ).populate("itemId");

      if (!borrowRequest) {
        return res
          .status(404)
          .send("Borrow request not found.");
      }

      if (
        !borrowRequest.requesterId ||
        borrowRequest.requesterId.toString() !==
          req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You are not allowed to review this borrowing."
          );
      }

      if (
        borrowRequest.ownerId &&
        borrowRequest.ownerId.toString() ===
          req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You cannot review your own clothing item."
          );
      }

      if (borrowRequest.status !== "Completed") {
        return res
          .status(400)
          .send(
            "You can only review a completed borrowing."
          );
      }

      if (!borrowRequest.itemId) {
        return res
          .status(404)
          .send("Clothing item not found.");
      }

      const rating = Number(req.body.rating);

      const comment = req.body.comment
        ? req.body.comment.trim()
        : "";

      // 评分必须是 1、2、3、4 或 5
      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).render(
          "reviews/new",
          {
            borrowRequest,
            item: borrowRequest.itemId,
            error:
              "Please select a rating from 1 to 5.",
            values: {
              rating: req.body.rating || "",
              comment
            }
          }
        );
      }

      if (comment.length > 1000) {
        return res.status(400).render(
          "reviews/new",
          {
            borrowRequest,
            item: borrowRequest.itemId,
            error:
              "The comment cannot exceed 1000 characters.",
            values: {
              rating: req.body.rating || "",
              comment
            }
          }
        );
      }

      const existingReview =
        await Review.findOne({
          borrowRequestId: borrowRequest._id
        });

      if (existingReview) {
        return res
          .status(400)
          .send(
            "You have already reviewed this borrowing."
          );
      }

      await Review.create({
        borrowRequestId: borrowRequest._id,
        reviewerId: req.session.user.id,
        itemId: borrowRequest.itemId._id,
        rating,
        comment
      });

      // 更新衣服的平均评分和评论数量
      await updateItemRating(
        borrowRequest.itemId._id
      );

      return res.redirect(
        `/items/${borrowRequest.itemId._id}`
      );
    } catch (error) {
      console.error(
        "Failed to submit review:",
        error
      );

      // 防止同时提交两次造成重复评价
      if (error.code === 11000) {
        return res
          .status(400)
          .send(
            "You have already reviewed this borrowing."
          );
      }

      return res
        .status(400)
        .send("Unable to submit review.");
    }
  }
);

module.exports = router;