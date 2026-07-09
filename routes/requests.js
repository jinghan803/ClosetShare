const express = require("express");

const BorrowRequest = require("../models/BorrowRequest");
const ClothingItem = require("../models/ClothingItem");
const { requireLogin } = require("../middleware/auth");
const Review = require("../models/Review");

const router = express.Router();

/*
  GET /requests/new/:itemId
  显示借用申请页面
*/
router.get(
  "/new/:itemId",
  requireLogin,
  async (req, res) => {
    try {
      const item = await ClothingItem.findById(
        req.params.itemId
      );

      if (!item) {
        return res
          .status(404)
          .send("Clothing item not found.");
      }

      // 没有发布者信息的旧衣服不能申请
      if (!item.ownerId) {
        return res
          .status(400)
          .send("This clothing item has no owner information.");
      }

      // 发布者不能申请借用自己的衣服
      if (
        item.ownerId.toString() ===
        req.session.user.id
      ) {
        return res
          .status(403)
          .send("You cannot borrow your own clothing item.");
      }

      // 当前不可借用
      if (!item.isAvailable) {
        return res
          .status(400)
          .send("This clothing item is not available.");
      }

      return res.render("requests/new", {
        item,
        error: null,
        values: {
          startDate: "",
          endDate: "",
          message: ""
        }
      });
    } catch (error) {
      console.error(
        "Failed to open borrow request page:",
        error
      );

      return res
        .status(400)
        .send("Unable to open borrow request page.");
    }
  }
);

/*
  POST /requests/:itemId
  提交借用申请
*/
router.post(
  "/:itemId",
  requireLogin,
  async (req, res) => {
    try {
      const item = await ClothingItem.findById(
        req.params.itemId
      );

      if (!item) {
        return res
          .status(404)
          .send("Clothing item not found.");
      }

      if (!item.ownerId) {
        return res
          .status(400)
          .send("This clothing item has no owner information.");
      }

      // 不允许申请自己的衣服
      if (
        item.ownerId.toString() ===
        req.session.user.id
      ) {
        return res
          .status(403)
          .send("You cannot borrow your own clothing item.");
      }

      if (!item.isAvailable) {
        return res
          .status(400)
          .send("This clothing item is not available.");
      }

      const startDateValue =
        req.body.startDate || "";

      const endDateValue =
        req.body.endDate || "";

      const message = req.body.message
        ? req.body.message.trim()
        : "";

      // 检查日期是否填写
      if (!startDateValue || !endDateValue) {
        return res.status(400).render(
          "requests/new",
          {
            item,
            error:
              "Please select a start date and an end date.",
            values: {
              startDate: startDateValue,
              endDate: endDateValue,
              message
            }
          }
        );
      }

      const startDate = new Date(
        `${startDateValue}T00:00:00`
      );

      const endDate = new Date(
        `${endDateValue}T00:00:00`
      );

      // 检查日期是否有效
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return res.status(400).render(
          "requests/new",
          {
            item,
            error: "Please enter valid dates.",
            values: {
              startDate: startDateValue,
              endDate: endDateValue,
              message
            }
          }
        );
      }

      // 结束日期不能早于开始日期
      if (endDate < startDate) {
        return res.status(400).render(
          "requests/new",
          {
            item,
            error:
              "The end date cannot be earlier than the start date.",
            values: {
              startDate: startDateValue,
              endDate: endDateValue,
              message
            }
          }
        );
      }

      // 防止同一用户重复提交未处理的申请
      const existingRequest =
        await BorrowRequest.findOne({
          requesterId: req.session.user.id,
          itemId: item._id,
          status: {
            $in: ["Pending", "Accepted"]
          }
        });

      if (existingRequest) {
        return res.status(400).render(
          "requests/new",
          {
            item,
            error:
              "You already have an active request for this item.",
            values: {
              startDate: startDateValue,
              endDate: endDateValue,
              message
            }
          }
        );
      }

      // 创建借用申请
      await BorrowRequest.create({
        requesterId: req.session.user.id,
        itemId: item._id,
        ownerId: item.ownerId,
        startDate,
        endDate,
        message,
        status: "Pending",

        itemSnapshot: {
          title: item.title,
          description: item.description,
          category: item.category,
          size: item.size,
          color: item.color,
          brand: item.brand,
          condition: item.condition,
          imageUrl: item.imageUrl,
          rentalPrice: item.rentalPrice,
        },
      });

      return res.redirect("/requests/mine");
    } catch (error) {
      console.error(
        "Failed to submit borrow request:",
        error
      );

      return res
        .status(400)
        .send("Unable to submit borrow request.");
    }
  }
);

/*
  GET /requests/mine
  查看当前用户发出的借用申请
*/
router.get(
  "/mine",
  requireLogin,
  async (req, res) => {
    try {
      const requests =
        await BorrowRequest.find({
          requesterId: req.session.user.id
        })
          .populate("itemId")
          .populate(
            "ownerId",
            "username email avatarUrl"
          )
          .sort({
            createdAt: -1
          });

      /*
        获取当前用户给这些借用申请提交过的评分。
        这样 mine.ejs 可以读取：
        request.review.rating
        request.review.comment
      */
      const requestIds = requests.map((request) => {
        return request._id;
      });

      const reviews = await Review.find({
        borrowRequestId: {
          $in: requestIds
        },
        reviewerId: req.session.user.id
      }).select(
        "borrowRequestId rating comment createdAt"
      );

      const reviewMap = {};

      reviews.forEach((review) => {
        reviewMap[review.borrowRequestId.toString()] =
          review;
      });

      const requestsWithReviews = requests.map((request) => {
        const requestObject = request.toObject();

        requestObject.review =
          reviewMap[request._id.toString()] || null;

        return requestObject;
      });

      return res.render("requests/mine", {
        requests: requestsWithReviews
      });
    } catch (error) {
      console.error(
        "Failed to load borrow requests:",
        error
      );

      return res
        .status(500)
        .send("Unable to load borrow requests.");
    }
  }
);

/*
  GET /requests/received
  发布者查看收到的借用申请
*/
router.get(
  "/received",
  requireLogin,
  async (req, res) => {
    try {
      const requests =
        await BorrowRequest.find({
          ownerId: req.session.user.id
        })
          .populate(
            "requesterId",
            "username email avatarUrl"
          )
          .populate("itemId")
          .sort({
            createdAt: -1
          });

      /*
        给每个 borrow request 加上对应的 review。
        这样 received.ejs 才能读取：
        request.review.rating
        request.review.comment
      */
      const requestIds = requests.map((request) => {
        return request._id;
      });

      const reviews = await Review.find({
        borrowRequestId: {
          $in: requestIds
        }
      }).select(
        "borrowRequestId rating comment reviewerId createdAt"
      );

      const reviewMap = {};

      reviews.forEach((review) => {
        reviewMap[review.borrowRequestId.toString()] =
          review;
      });

      const requestsWithReviews = requests.map((request) => {
        const requestObject = request.toObject();

        requestObject.review =
          reviewMap[request._id.toString()] || null;

        return requestObject;
      });

      return res.render(
        "requests/received",
        {
          requests: requestsWithReviews
        }
      );
    } catch (error) {
      console.error(
        "Failed to load received requests:",
        error
      );

      return res
        .status(500)
        .send(
          "Unable to load received requests."
        );
    }
  }
);

/*
  PUT /requests/:id/accept
  发布者接受借用申请
*/
/*
申请状态：Pending → Accepted
衣服状态：Available → Unavailable
其他 Pending 申请：自动变成 Rejected
*/
router.put(
  "/:id/accept",
  requireLogin,
  async (req, res) => {
    try {
      const request =
        await BorrowRequest.findById(
          req.params.id
        );

      if (!request) {
        return res
          .status(404)
          .send("Borrow request not found.");
      }

      // 只有衣服发布者可以接受申请
      if (
        request.ownerId.toString() !==
        req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You are not allowed to accept this request."
          );
      }

      // 只有 Pending 可以被接受
      if (request.status !== "Pending") {
        return res
          .status(400)
          .send(
            "Only pending requests can be accepted."
          );
      }

      const item =
        await ClothingItem.findById(
          request.itemId
        );

      if (!item) {
        return res
          .status(404)
          .send("Clothing item not found.");
      }

      // 再次确认衣服属于当前发布者
      if (
        !item.ownerId ||
        item.ownerId.toString() !==
          req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You are not the owner of this clothing item."
          );
      }

      // 衣服已经不可借时，不能再接受新的申请
      if (!item.isAvailable) {
        return res
          .status(400)
          .send(
            "This clothing item is no longer available."
          );
      }

      // 接受当前申请
      request.status = "Accepted";
      await request.save();

      // 接受后将衣服设置为不可借
      item.isAvailable = false;
      await item.save();

      // 同一件衣服的其他 Pending 申请自动拒绝
      await BorrowRequest.updateMany(
        {
          itemId: item._id,
          _id: {
            $ne: request._id
          },
          status: "Pending"
        },
        {
          $set: {
            status: "Rejected"
          }
        }
      );

      return res.redirect(
        "/requests/received"
      );
    } catch (error) {
      console.error(
        "Failed to accept borrow request:",
        error
      );

      return res
        .status(400)
        .send(
          "Unable to accept borrow request."
        );
    }
  }
);

/*
  PUT /requests/:id/reject
  发布者拒绝借用申请
*/
/*
申请状态：Pending → Rejected
衣服状态：仍然 Available
*/
router.put(
  "/:id/reject",
  requireLogin,
  async (req, res) => {
    try {
      const request =
        await BorrowRequest.findById(
          req.params.id
        );

      if (!request) {
        return res
          .status(404)
          .send("Borrow request not found.");
      }

      // 只有发布者可以拒绝
      if (
        request.ownerId.toString() !==
        req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You are not allowed to reject this request."
          );
      }

      // 只有 Pending 可以拒绝
      if (request.status !== "Pending") {
        return res
          .status(400)
          .send(
            "Only pending requests can be rejected."
          );
      }

      request.status = "Rejected";
      await request.save();

      return res.redirect(
        "/requests/received"
      );
    } catch (error) {
      console.error(
        "Failed to reject borrow request:",
        error
      );

      return res
        .status(400)
        .send(
          "Unable to reject borrow request."
        );
    }
  }
);

/*
  PUT /requests/:id/complete
  发布者确认借用完成
*/
/*
申请状态：Accepted → Completed
衣服状态：Unavailable → Available
*/
router.put(
  "/:id/complete",
  requireLogin,
  async (req, res) => {
    try {
      const request =
        await BorrowRequest.findById(
          req.params.id
        );

      if (!request) {
        return res
          .status(404)
          .send("Borrow request not found.");
      }

      // 只有发布者可以标记完成
      if (
        request.ownerId.toString() !==
        req.session.user.id
      ) {
        return res
          .status(403)
          .send(
            "You are not allowed to complete this request."
          );
      }

      // 只有 Accepted 可以完成
      if (request.status !== "Accepted") {
        return res
          .status(400)
          .send(
            "Only accepted requests can be completed."
          );
      }

      const item =
        await ClothingItem.findById(
          request.itemId
        );

      request.status = "Completed";
      await request.save();

      // 衣服仍然存在时，重新设为可借
      if (item) {
        item.isAvailable = true;
        await item.save();
      }

      return res.redirect(
        "/requests/received"
      );
    } catch (error) {
      console.error(
        "Failed to complete borrow request:",
        error
      );

      return res
        .status(400)
        .send(
          "Unable to complete borrow request."
        );
    }
  }
);

module.exports = router;


