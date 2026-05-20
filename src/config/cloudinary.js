const cloudinary=require("cloudinary").v2;  //import

cloudinary.config({
    //cloudinaryn omista tiedosta nämä env ja railwayihin
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports =cloudinary; //export