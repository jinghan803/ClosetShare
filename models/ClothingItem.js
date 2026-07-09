const mongoose = require("mongoose");//引入mongoose模块

const clothingItemSchema = new mongoose.Schema(
	{
		//衣服名称
		title: {
			type: String,
			required: true,
			trim: true,//需要修剪
		},

		//衣服描述
		description: {
			type: String,
			required: true,
			trim: true,
		},

		//衣服类别
		category: {
			type: String,
			required: true,
			enum: [
				"T-Shirt",
				"Shirt",
				"Sweater",
				"Hoodie",
				"Jacket",
				"Coat",
				"Jeans",
				"Pants",
				"Shorts",
				"Skirt",
				"Dress",
				"Shoes",
				"Accessories",
				"Other",//其他
			],
		},

		//衣服尺寸
		size: {
			type: String,
			required: true,
			enum: [
				"XS",
				"XXS",
				"S",
				"M",
				"L",
				"XL",
				"XXL",
				"XXXL",
				"One Size",
			],
		},

		//衣服颜色
		color: {
			type: String,
			required: true,
			trim: true,
		},

		//衣服品牌
		brand: {
			type: String,
			required: true,
			default: "Unknown",
		},

		//衣服新旧程度
		condition: {
			type: String,
			required: true,
			enum: [
				"New With Tags",
				"New Without Tags",
				"Like New",
				"Good",
				"Fair",
				"Poor",
			],
		},

		//衣服图片链接
		imageUrl: {
			type: String,
			trim: true,
			default: "",
		},

		//租借价格
		rentalPrice: {
			type: Number,
			min: 0,
			default: 0,
		},

		//衣服所有者
		ownerId: {
			 type: mongoose.Schema.Types.ObjectId,
			 ref: "User",
			 required: true,
		},

		//是否可以借用
		isAvailable: {
			type: Boolean,
			default: true,
		},

		//衣服平均评分
		averageRating: {
			type: Number,
			min: 0,
			max: 5,
			default: 0,
		},

		//衣服评分次数
		ratingCount: {
			type: Number,
			min: 0,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

const ClothingItem = mongoose.model(
	"ClothingItem", 
	clothingItemSchema
);

module.exports = ClothingItem;