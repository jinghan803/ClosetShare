const mongoose = require("mongoose");

// 检查路由参数是否为合法 MongoDB ObjectId
function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).render("errors/error", {
        statusCode: 400,
        title: "Invalid ID",
        message: "The requested ID is not valid."
      });
    }

    next();
  };
}

module.exports = {
  validateObjectId
};