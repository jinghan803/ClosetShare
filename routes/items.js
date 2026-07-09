const express = require("express");

const ClothingItem = require("../models/ClothingItem");
const { requireLogin } = require("../middleware/auth");
const Review = require("../models/Review");

const {
  validateObjectId
} = require("../middleware/validateObjectId");

const router = express.Router();

/*
  GET /items
  显示、搜索、筛选和排序所有衣服
*/
router.get("/", async (req, res) => {
  try {
    // 获取搜索框中的关键词
    const keyword = req.query.search
      ? req.query.search.trim()
      : "";

    // 获取筛选条件
    const category = req.query.category || "";
    const size = req.query.size || "";

    const color = req.query.color
      ? req.query.color.trim()
      : "";

    const condition = req.query.condition || "";
    const availability = req.query.availability || "";

    // 获取价格范围
    const minPriceValue = req.query.minPrice || "";
    const maxPriceValue = req.query.maxPrice || "";

    // 获取排序方式
    const sortOption = req.query.sort || "latest";

    // MongoDB 查询条件对象
    const searchCondition = {};

    // 用户输入关键词时进行搜索
    if (keyword) {
      // 防止用户输入特殊正则表达式符号
      const safeKeyword = keyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // 在名称、品牌或描述中搜索
      searchCondition.$or = [
        {
          title: {
            $regex: safeKeyword,
            $options: "i"
          }
        },
        {
          brand: {
            $regex: safeKeyword,
            $options: "i"
          }
        },
        {
          description: {
            $regex: safeKeyword,
            $options: "i"
          }
        }
      ];
    }

    // 按类别筛选
    if (category) {
      searchCondition.category = category;
    }

    // 按尺码筛选
    if (size) {
      searchCondition.size = size;
    }

    // 按颜色筛选
    if (color) {
      const safeColor = color.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      searchCondition.color = {
        $regex: `^${safeColor}$`,
        $options: "i"
      };
    }

    // 按新旧程度筛选
    if (condition) {
      searchCondition.condition = condition;
    }

    // 按是否可以借用筛选
    if (availability === "true") {
      searchCondition.isAvailable = true;
    } else if (availability === "false") {
      searchCondition.isAvailable = false;
    }

    // 创建价格筛选条件
    const priceCondition = {};

    // 验证最低价格
    if (minPriceValue !== "") {
      const minPrice = Number(minPriceValue);

      if (
        !Number.isFinite(minPrice) ||
        minPrice < 0
      ) {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Minimum Price",
            message:
              "Minimum price must be a number greater than or equal to 0."
          }
        );
      }

      priceCondition.$gte = minPrice;
    }

    // 验证最高价格
    if (maxPriceValue !== "") {
      const maxPrice = Number(maxPriceValue);

      if (
        !Number.isFinite(maxPrice) ||
        maxPrice < 0
      ) {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Maximum Price",
            message:
              "Maximum price must be a number greater than or equal to 0."
          }
        );
      }

      priceCondition.$lte = maxPrice;
    }

    // 最低价格不能大于最高价格
    if (
      priceCondition.$gte !== undefined &&
      priceCondition.$lte !== undefined &&
      priceCondition.$gte > priceCondition.$lte
    ) {
      return res.status(400).render(
        "errors/error",
        {
          statusCode: 400,
          title: "Invalid Price Range",
          message:
            "Minimum price cannot be greater than maximum price."
        }
      );
    }

    // 用户输入价格范围时添加查询条件
    if (Object.keys(priceCondition).length > 0) {
      searchCondition.rentalPrice = priceCondition;
    }

    // 默认按照最新发布时间排序
    let sortCondition = {
      createdAt: -1
    };

    // 价格从低到高
    if (sortOption === "price-low") {
      sortCondition = {
        rentalPrice: 1
      };
    }

    // 价格从高到低
    else if (sortOption === "price-high") {
      sortCondition = {
        rentalPrice: -1
      };
    }

    // 评分从高到低
    else if (sortOption === "rating-high") {
      sortCondition = {
        averageRating: -1,
        ratingCount: -1,
        createdAt: -1
      };
    }

    // 根据搜索和筛选条件查询衣服
    const items = await ClothingItem.find(
      searchCondition
    ).sort(sortCondition);

    // 将衣服和当前筛选条件传给 list.ejs
    return res.render("items/list", {
      items,
      keyword,

      filters: {
        category,
        size,
        color,
        condition,
        availability,
        minPrice: minPriceValue,
        maxPrice: maxPriceValue,
        sort: sortOption
      }
    });
  } catch (error) {
    console.error(
      "Failed to load clothing items:",
      error
    );

    return res.status(500).render(
      "errors/error",
      {
        statusCode: 500,
        title: "Unable to Load Clothing",
        message:
          "The clothing list could not be loaded. Please try again later."
      }
    );
  }
});

/*
  GET /items/new
  显示发布衣服页面
*/
router.get(
  "/new",
  requireLogin,
  (req, res) => {
    return res.render("items/create");
  }
);

/*
  POST /items
  创建并保存新衣服
*/
router.post(
  "/",
  requireLogin,
  async (req, res) => {
    try {
      // 清理衣服名称
      const title = req.body.title
        ? req.body.title.trim()
        : "";

      // 清理衣服描述
      const description = req.body.description
        ? req.body.description.trim()
        : "";

      // 处理衣服类别
      const category =
        req.body.category === "Other"
          ? req.body.categoryOther
            ? req.body.categoryOther.trim()
            : ""
          : req.body.category || "";

      // 处理衣服尺码
      const size =
        req.body.size === "Other"
          ? req.body.sizeOther
            ? req.body.sizeOther.trim()
            : ""
          : req.body.size || "";

      // 处理衣服颜色
      const color =
        req.body.color === "Other"
          ? req.body.colorOther
            ? req.body.colorOther.trim()
            : ""
          : req.body.color || "";

      // 处理衣服品牌
      const brand =
        req.body.brand === "Other"
          ? req.body.brandOther
            ? req.body.brandOther.trim()
            : "Unknown"
          : req.body.brand
            ? req.body.brand.trim()
            : "Unknown";

      const condition = req.body.condition || "";

      const imageUrl = req.body.imageUrl
        ? req.body.imageUrl.trim()
        : "";

      const rentalPrice = Number(
        req.body.rentalPrice
      );

      // 验证必填字段不能为空
      if (
        !title ||
        !description ||
        !category ||
        !size ||
        !color ||
        !condition
      ) {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Input",
            message:
              "Please complete all required clothing fields."
          }
        );
      }

      // 验证价格
      if (
        req.body.rentalPrice === "" ||
        req.body.rentalPrice === undefined ||
        !Number.isFinite(rentalPrice) ||
        rentalPrice < 0
      ) {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Price",
            message:
              "Rental price must be a number greater than or equal to 0."
          }
        );
      }

      // 保留原来的 new ClothingItem 创建方式
      const newItem = new ClothingItem({
        title,
        description,
        category,
        size,
        color,
        brand,
        condition,
        imageUrl,
        rentalPrice,
        isAvailable: true,

        // 当前登录用户是衣服发布者
        ownerId: req.session.user.id
      });

      await newItem.save();

      console.log(
        "Saved clothing item:",
        newItem
      );

      return res.redirect("/items");
    } catch (error) {
      console.error(
        "Failed to save clothing item:",
        error
      );

      // Mongoose Schema 验证错误
      if (error.name === "ValidationError") {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Clothing Information",
            message:
              "Some clothing information is invalid. Please check the form and try again."
          }
        );
      }

      // 数据库或其他服务器错误
      return res.status(500).render(
        "errors/error",
        {
          statusCode: 500,
          title: "Database Error",
          message:
            "Unable to save the clothing item. Please try again later."
        }
      );
    }
  }
);

/*
  GET /items/:id/edit
  显示编辑衣服页面
*/
router.get(
  "/:id/edit",
  requireLogin,
  validateObjectId("id"),
  async (req, res) => {
    try {
      const item = await ClothingItem.findById(
        req.params.id
      );

      // 找不到衣服时显示 404
      if (!item) {
        return res.status(404).render(
          "errors/error",
          {
            statusCode: 404,
            title: "Clothing Item Not Found",
            message:
              "The requested clothing item could not be found."
          }
        );
      }

      // 只有发布者可以进入编辑页面
      if (
        !item.ownerId ||
        item.ownerId.toString() !==
          req.session.user.id
      ) {
        return res.status(403).render(
          "errors/error",
          {
            statusCode: 403,
            title: "Forbidden",
            message:
              "You are not allowed to edit this clothing item."
          }
        );
      }

      return res.render("items/edit", {
        item
      });
    } catch (error) {
      console.error(
        "Failed to open edit page:",
        error
      );

      return res.status(500).render(
        "errors/error",
        {
          statusCode: 500,
          title: "Unable to Open Edit Page",
          message:
            "The edit page could not be loaded. Please try again later."
        }
      );
    }
  }
);

/*
  PUT /items/:id
  更新衣服信息
*/
router.put(
  "/:id",
  requireLogin,
  validateObjectId("id"),
  async (req, res) => {
    try {
      // 更新前先查询衣服
      const item = await ClothingItem.findById(
        req.params.id
      );

      // 找不到衣服时显示 404
      if (!item) {
        return res.status(404).render(
          "errors/error",
          {
            statusCode: 404,
            title: "Clothing Item Not Found",
            message:
              "The requested clothing item could not be found."
          }
        );
      }

      // 只有衣服发布者可以更新
      if (
        !item.ownerId ||
        item.ownerId.toString() !==
          req.session.user.id
      ) {
        return res.status(403).render(
          "errors/error",
          {
            statusCode: 403,
            title: "Forbidden",
            message:
              "You are not allowed to update this clothing item."
          }
        );
      }

      // 清理衣服名称
      const title = req.body.title
        ? req.body.title.trim()
        : "";

      // 清理衣服描述
      const description = req.body.description
        ? req.body.description.trim()
        : "";

      const category = req.body.category || "";
      const size = req.body.size || "";

      const color = req.body.color
        ? req.body.color.trim()
        : "";

      const brand = req.body.brand
        ? req.body.brand.trim()
        : "Unknown";

      const condition = req.body.condition || "";

      const imageUrl = req.body.imageUrl
        ? req.body.imageUrl.trim()
        : "";

      const rentalPrice = Number(
        req.body.rentalPrice
      );

      // 转换 Available/Unavailable 为布尔值
      const availabilityValue =
        req.body.isAvailable === "true"
          ? true
          : req.body.isAvailable === "false"
            ? false
            : item.isAvailable;

      // 验证必填字段
      if (
        !title ||
        !description ||
        !category ||
        !size ||
        !color ||
        !condition
      ) {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Input",
            message:
              "Please complete all required clothing fields."
          }
        );
      }

      // 验证价格
      if (
        req.body.rentalPrice === "" ||
        req.body.rentalPrice === undefined ||
        !Number.isFinite(rentalPrice) ||
        rentalPrice < 0
      ) {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Price",
            message:
              "Rental price must be a number greater than or equal to 0."
          }
        );
      }

      // 保留原来的 findByIdAndUpdate 更新方式
      const updatedItem =
        await ClothingItem.findByIdAndUpdate(
          req.params.id,
          {
            title,
            description,
            category,
            size,
            color,
            brand,
            condition,
            imageUrl,
            rentalPrice,

            // 保存转换后的布尔值
            isAvailable: availabilityValue
          },
          {
            returnDocument: "after",
            runValidators: true
          }
        );

      if (!updatedItem) {
        return res.status(404).render(
          "errors/error",
          {
            statusCode: 404,
            title: "Clothing Item Not Found",
            message:
              "The requested clothing item could not be found."
          }
        );
      }

      console.log(
        "Database value:",
        updatedItem.isAvailable
      );

      return res.redirect("/items");
    } catch (error) {
      console.error(
        "Failed to update clothing item:",
        error
      );

      // Mongoose Schema 验证错误
      if (error.name === "ValidationError") {
        return res.status(400).render(
          "errors/error",
          {
            statusCode: 400,
            title: "Invalid Clothing Information",
            message:
              "Some clothing information is invalid. Please check the form and try again."
          }
        );
      }

      // 数据库或其他服务器错误
      return res.status(500).render(
        "errors/error",
        {
          statusCode: 500,
          title: "Database Error",
          message:
            "Unable to update the clothing item. Please try again later."
        }
      );
    }
  }
);

/*
  GET /items/:id
  显示单件衣服详情
  包含评分、评论和推荐功能
*/
router.get(
  "/:id",
  validateObjectId("id"),
  async (req, res) => {
    try {
      // 获取当前衣服
      const item = await ClothingItem.findById(
        req.params.id
      ).populate(
        "ownerId",
        "username email avatarUrl averageRating ratingCount"
      );

      // 找不到衣服时显示 404
      if (!item) {
        return res.status(404).render(
          "errors/error",
          {
            statusCode: 404,
            title: "Clothing Item Not Found",
            message:
              "The requested clothing item could not be found."
          }
        );
      }

      // 获取当前衣服的所有评价
      const reviews = await Review.find({
        itemId: item._id
      })
        .populate(
          "reviewerId",
          "username avatarUrl"
        )
        .sort({
          createdAt: -1
        });

      // 查询除当前衣服之外的其他衣服
      const otherItems = await ClothingItem.find({
        _id: {
          $ne: item._id
        }
      });

      // 统一字符串格式，方便比较
      const normalizeValue = (value) => {
        return String(value || "")
          .trim()
          .toLowerCase();
      };

      // 为其他衣服计算推荐分数
      const scoredItems = otherItems.map(
        (otherItem) => {
          let score = 0;

          // 相同类别：+3
          if (
            normalizeValue(otherItem.category) ===
            normalizeValue(item.category)
          ) {
            score += 3;
          }

          // 相同尺码：+3
          if (
            normalizeValue(otherItem.size) ===
            normalizeValue(item.size)
          ) {
            score += 3;
          }

          // 相同颜色：+1
          if (
            normalizeValue(otherItem.color) ===
            normalizeValue(item.color)
          ) {
            score += 1;
          }

          // 相同品牌：+1
          if (
            normalizeValue(otherItem.brand) ===
            normalizeValue(item.brand)
          ) {
            score += 1;
          }

          // 平均评分超过 4 星：+2
          if (
            Number(
              otherItem.averageRating || 0
            ) > 4
          ) {
            score += 2;
          }

          // 当前可以借用：+1
          if (otherItem.isAvailable) {
            score += 1;
          }

          return {
            item: otherItem,
            score
          };
        }
      );

      // 按推荐分数、评分和发布时间排序
      const similarItems = scoredItems
        .filter((result) => {
          return result.score > 0;
        })
        .sort((first, second) => {
          // 首先按推荐分数排序
          if (second.score !== first.score) {
            return second.score - first.score;
          }

          // 推荐分数相同时，按平均评分排序
          const ratingDifference =
            Number(
              second.item.averageRating || 0
            ) -
            Number(
              first.item.averageRating || 0
            );

          if (ratingDifference !== 0) {
            return ratingDifference;
          }

          // 评分相同时，按发布时间排序
          const secondCreatedAt =
            second.item.createdAt
              ? new Date(
                  second.item.createdAt
                ).getTime()
              : 0;

          const firstCreatedAt =
            first.item.createdAt
              ? new Date(
                  first.item.createdAt
                ).getTime()
              : 0;

          return (
            secondCreatedAt -
            firstCreatedAt
          );
        })
        .slice(0, 4);

      // 传递衣服、评价和推荐结果
      return res.render("items/detail", {
        item,
        reviews,
        similarItems
      });
    } catch (error) {
      console.error(
        "Failed to load clothing item:",
        error
      );

      // validateObjectId 已经处理非法 ID
      // 这里处理数据库或渲染错误
      return res.status(500).render(
        "errors/error",
        {
          statusCode: 500,
          title: "Unable to Load Clothing Item",
          message:
            "The clothing item could not be loaded. Please try again later."
        }
      );
    }
  }
);

/*
  DELETE /items/:id
  删除衣服
*/
router.delete(
  "/:id",
  requireLogin,
  validateObjectId("id"),
  async (req, res) => {
    try {
      // 先查找衣服，不要立即删除
      const item = await ClothingItem.findById(
        req.params.id
      );

      // 找不到衣服时显示 404
      if (!item) {
        return res.status(404).render(
          "errors/error",
          {
            statusCode: 404,
            title: "Clothing Item Not Found",
            message:
              "The requested clothing item could not be found."
          }
        );
      }

      // 只有发布者可以删除
      if (
        !item.ownerId ||
        item.ownerId.toString() !==
          req.session.user.id
      ) {
        return res.status(403).render(
          "errors/error",
          {
            statusCode: 403,
            title: "Forbidden",
            message:
              "You are not allowed to delete this clothing item."
          }
        );
      }

      // 权限检查通过后再删除
      await ClothingItem.findByIdAndDelete(
        req.params.id
      );

      return res.redirect("/items");
    } catch (error) {
      console.error(
        "Failed to delete clothing item:",
        error
      );

      return res.status(500).render(
        "errors/error",
        {
          statusCode: 500,
          title: "Unable to Delete Clothing Item",
          message:
            "The clothing item could not be deleted. Please try again later."
        }
      );
    }
  }
);

module.exports = router;

