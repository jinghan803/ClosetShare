//已登陆：继续访问页面
//未登录：跳转到登陆页面

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

module.exports = {
  requireLogin
};