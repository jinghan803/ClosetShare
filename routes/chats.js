const express = require("express");

const BorrowRequest = require("../models/BorrowRequest");
const ChatMessage = require("../models/ChatMessage");

const {
  requireLogin
} = require("../middleware/auth");

const {
  validateObjectId
} = require("../middleware/validateObjectId");

const router = express.Router();

function getIdString(value) {
  if (!value) {
    return "";
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
}

// GET /chats/:requestId
router.get(
  "/:requestId",
  requireLogin,
  validateObjectId("requestId"),
  async (req, res) => {
    try {
      const currentUserId = req.session.user.id;

      const request = await BorrowRequest.findById(
        req.params.requestId
      )
        .populate("itemId")
        .populate("requesterId", "username avatarURL")
        .populate("ownerId", "username avatarURL");

      if (!request) {
        return res.status(404).render("errors/error", {
          statusCode: 404,
          title: "Borrow Request Not Found",
          message:
            "The borrow request could not be found."
        });
      }

      const requesterId = getIdString(
        request.requesterId
      );

      const ownerId = getIdString(
        request.ownerId
      );

      const canView =
        requesterId === currentUserId ||
        ownerId === currentUserId;

      if (!canView) {
        return res.status(403).render("errors/error", {
          statusCode: 403,
          title: "Forbidden",
          message:
            "You are not allowed to view this chat."
        });
      }

      const canSend =
        request.status === "Accepted";

      const messages = await ChatMessage.find({
        borrowRequestId: request._id
      })
        .populate("senderId", "username")
        .sort({
          createdAt: 1
        });

      const otherUser =
        requesterId === currentUserId
          ? request.ownerId
          : request.requesterId;

      // 查询当前用户相关的所有聊天，用于左侧聊天列表
      const relatedRequests = await BorrowRequest.find({
        $or: [
          {
            requesterId: currentUserId
          },
          {
            ownerId: currentUserId
          }
        ]
      })
        .populate("itemId")
        .populate("requesterId", "username avatarURL")
        .populate("ownerId", "username avatarURL");

      const relatedRequestIds = relatedRequests.map(
        (relatedRequest) => relatedRequest._id
      );

      const latestMessages = await ChatMessage.find({
        borrowRequestId: {
          $in: relatedRequestIds
        }
      }).sort({
        createdAt: -1
      });

      const latestMessageMap = {};

      latestMessages.forEach((message) => {
        const key =
          message.borrowRequestId.toString();

        if (!latestMessageMap[key]) {
          latestMessageMap[key] = message;
        }
      });

      const chatList = relatedRequests.map(
        (relatedRequest) => {
          const relatedRequesterId =
            getIdString(
              relatedRequest.requesterId
            );

          const relatedOwnerId =
            getIdString(
              relatedRequest.ownerId
            );

          const relatedOtherUser =
            relatedRequesterId === currentUserId
              ? relatedRequest.ownerId
              : relatedRequest.requesterId;

          const requestKey =
            relatedRequest._id.toString();

          return {
            request: relatedRequest,
            otherUser: relatedOtherUser,
            item: relatedRequest.itemId,
            latestMessage:
              latestMessageMap[requestKey] || null,
            isActive:
              requestKey ===
              req.params.requestId
          };
        }
      );

      chatList.sort((first, second) => {
        const firstTime = first.latestMessage
          ? new Date(
              first.latestMessage.createdAt
            ).getTime()
          : new Date(
              first.request.createdAt
            ).getTime();

        const secondTime = second.latestMessage
          ? new Date(
              second.latestMessage.createdAt
            ).getTime()
          : new Date(
              second.request.createdAt
            ).getTime();

        return secondTime - firstTime;
      });

      const backUrl =
        requesterId === currentUserId
          ? "/requests/mine"
          : "/requests/received";

      return res.render("chats/show", {
        request,
        messages,
        canSend,
        currentUserId,
        otherUser,
        chatList,
        backUrl,
        currentUser: req.session.user
      });
    } catch (error) {
      console.error(
        "Failed to load chat page:",
        error
      );

      return res.status(500).render("errors/error", {
        statusCode: 500,
        title: "Unable to Load Chat",
        message:
          "The chat page could not be loaded. Please try again later."
      });
    }
  }
);

// POST /chats/:requestId
router.post(
  "/:requestId",
  requireLogin,
  validateObjectId("requestId"),
  async (req, res) => {
    try {
      const request = await BorrowRequest.findById(
        req.params.requestId
      );

      if (!request) {
        return res.status(404).render("errors/error", {
          statusCode: 404,
          title: "Borrow Request Not Found",
          message:
            "The borrow request could not be found."
        });
      }

      const requesterId =
        request.requesterId.toString();

      const ownerId =
        request.ownerId.toString();

      const currentUserId = req.session.user.id;

      const canView =
        requesterId === currentUserId ||
        ownerId === currentUserId;

      if (!canView) {
        return res.status(403).render("errors/error", {
          statusCode: 403,
          title: "Forbidden",
          message:
            "You are not allowed to send messages in this chat."
        });
      }

      if (request.status !== "Accepted") {
        return res.status(403).render("errors/error", {
          statusCode: 403,
          title: "Chat Is Read-Only",
          message:
            "Messages can only be sent when the borrow request is Accepted."
        });
      }

      const message = req.body.message
        ? req.body.message.trim()
        : "";

      if (!message) {
        return res.status(400).render("errors/error", {
          statusCode: 400,
          title: "Empty Message",
          message:
            "Message cannot be empty."
        });
      }

      if (message.length > 500) {
        return res.status(400).render("errors/error", {
          statusCode: 400,
          title: "Message Too Long",
          message:
            "Message cannot be longer than 500 characters."
        });
      }

      const newMessage = new ChatMessage({
        borrowRequestId: request._id,
        senderId: currentUserId,
        message
      });

      await newMessage.save();

      return res.redirect(
        `/chats/${request._id}`
      );
    } catch (error) {
      console.error(
        "Failed to send chat message:",
        error
      );

      return res.status(500).render("errors/error", {
        statusCode: 500,
        title: "Unable to Send Message",
        message:
          "The message could not be sent. Please try again later."
      });
    }
  }
);

module.exports = router;
